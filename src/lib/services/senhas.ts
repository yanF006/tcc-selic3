import { definirSenha, conferirSenha } from "./credenciais";
import { agora } from "./store";
import { usuarioPorEmail } from "./administracao";
import { esquemaSenha } from "@/lib/domain/schemas";
import type { Usuario } from "@/lib/domain/types";
import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { bancoConfigurado } from "@/lib/db/prisma";
import { obterAutenticacao } from "@/lib/auth/autenticacao";
import { carregarConfiguracaoAutenticacao } from "@/lib/auth/configuracao";
import { traduzirErroPersistencia } from "@/lib/db/erros";

/**
 * Senha do usuário (5.8 e 5.9): pedido de redefinição com link de uso único e
 * troca autenticada exigindo a senha atual.
 *
 * Regras que a implementação respeita:
 *
 * - a confirmação do pedido é **idêntica** exista ou não conta com o e-mail
 *   informado, para não revelar quem tem cadastro;
 * - o link vale por uma hora e é de **uso único**: reutilizá-lo é recusado e
 *   exige nova solicitação;
 * - link inválido, expirado e já usado recebem a mesma mensagem;
 * - a troca autenticada só grava quando a senha atual confere, então uma senha
 *   atual errada mantém a anterior;
 * - com banco, todas as operações usam os métodos padrão do Better Auth;
 *   mapas e credenciais locais pertencem exclusivamente à simulação.
 */

/** Validade do link de redefinição, em minutos. */
export const VALIDADE_LINK_MINUTOS = 60;

/** Confirmação do pedido, igual para e-mail cadastrado e para e-mail inexistente. */
export const CONFIRMACAO_REDEFINICAO =
  "Se houver um cadastro com este e-mail, você receberá um link para definir uma nova senha. Confira também a caixa de spam.";

export const LINK_INVALIDO =
  "Este link é inválido, expirou ou já foi utilizado. Solicite uma nova redefinição de senha.";

interface LinkRedefinicao {
  token: string;
  email: string;
  criadoEm: string;
  /** Vencimento em epoch, para a comparação não depender de formatação de data. */
  expiraEm: number;
  usadoEm: string | null;
}

export interface PedidoRedefinicao {
  confirmacao: string;
  /**
   * Presente somente na demonstração sem banco. O modo persistente nunca
   * devolve o link ou o token na resposta pública.
   */
  link?: string;
  enviadoEm: string;
}

export type CampoSenha = "senha" | "confirmacao" | "senhaAtual" | "link";

export type ResultadoSenha =
  { ok: true; mensagem: string } | { ok: false; campo: CampoSenha; erro: string };

export type ResultadoTrocaSenha =
  | { ok: true; mensagem: string }
  | { ok: false; campo: "senha" | "confirmacao" | "senhaAtual"; erro: string };

const links = new Map<string, LinkRedefinicao>();

function novoToken(): string {
  return `rst_${globalThis.crypto.randomUUID()}`;
}

/**
 * Pedido de redefinição. O link é gerado para qualquer e-mail informado, sem
 * conferir se há conta: a confirmação é a mesma nos dois casos e é a entrega que
 * diferencia o e-mail cadastrado do e-mail que não existe, como faria o
 * Nodemailer.
 */
export async function solicitarRedefinicao(
  email: string,
  cabecalhos?: Headers,
): Promise<PedidoRedefinicao> {
  const alvo = email.trim().toLowerCase();
  if (bancoConfigurado()) {
    const auth = await obterAutenticacao();
    const configuracao = carregarConfiguracaoAutenticacao();
    await auth.api.requestPasswordReset({
      body: { email: alvo, redirectTo: `${configuracao.origem}/redefinir-senha` },
      headers: cabecalhos ?? (await headers()),
    });
    return { confirmacao: CONFIRMACAO_REDEFINICAO, enviadoEm: agora() };
  }
  const token = novoToken();
  const enviadoEm = agora();

  links.set(token, {
    token,
    email: alvo,
    criadoEm: enviadoEm,
    expiraEm: Date.now() + VALIDADE_LINK_MINUTOS * 60_000,
    usadoEm: null,
  });

  return {
    confirmacao: CONFIRMACAO_REDEFINICAO,
    link: `/redefinir-senha?token=${encodeURIComponent(token)}`,
    enviadoEm,
  };
}

/** Senha válida e confirmação coincidente; erro no campo quando falta. */
function conferirNovaSenha(
  senha: string,
  confirmacao: string,
): { ok: false; campo: "senha" | "confirmacao"; erro: string } | null {
  const valida = esquemaSenha.safeParse(senha);

  if (!valida.success) {
    return {
      ok: false,
      campo: "senha",
      erro: valida.error.issues[0]?.message ?? "Senha inválida.",
    };
  }

  if (senha !== confirmacao) {
    return { ok: false, campo: "confirmacao", erro: "A confirmação não bate com a senha." };
  }

  return null;
}

/**
 * Troca a senha pelo link de redefinição. O token só é consumido quando a nova
 * senha é aceita, para que um erro de digitação não queime o link.
 *
 * O link só vale para e-mail que já tem usuário no sistema: assim um link pedido
 * para endereço inexistente não cria senha órfã, que seria herdada por um
 * cadastro feito depois pela administração. A recusa usa a mesma mensagem de link
 * inválido, para não revelar que a conta não existe.
 */
export async function redefinirSenhaComLink(
  token: string,
  senha: string,
  confirmacao: string,
  cabecalhos?: Headers,
): Promise<ResultadoSenha> {
  const problema = conferirNovaSenha(senha, confirmacao);

  if (problema) return problema;

  if (bancoConfigurado()) {
    try {
      const auth = await obterAutenticacao();
      await auth.api.resetPassword({
        body: { token: token.trim(), newPassword: senha },
        headers: cabecalhos ?? (await headers()),
      });
      return { ok: true, mensagem: "Senha redefinida. Entre com a nova senha." };
    } catch (erro) {
      if (erro instanceof APIError && erro.body?.code === "INVALID_TOKEN") {
        return { ok: false, campo: "link", erro: LINK_INVALIDO };
      }
      throw traduzirErroPersistencia(erro);
    }
  }

  const link = links.get(token.trim());

  if (!link || link.usadoEm !== null || link.expiraEm <= Date.now()) {
    return { ok: false, campo: "link", erro: LINK_INVALIDO };
  }

  const usuario = await usuarioPorEmail(link.email);

  if (!usuario) {
    link.usadoEm = agora();

    return { ok: false, campo: "link", erro: LINK_INVALIDO };
  }

  link.usadoEm = agora();

  await definirSenha(usuario.email, senha, "redefinicao");

  return { ok: true, mensagem: "Senha redefinida. Entre com a nova senha." };
}

/** true quando o link existe, não foi usado e não venceu. */
export function linkValido(token: string): boolean {
  if (bancoConfigurado())
    throw new Error("Tokens persistentes são validados somente pelo provedor.");
  const link = links.get(token.trim());

  return Boolean(link && link.usadoEm === null && link.expiraEm > Date.now());
}

/**
 * Troca autenticada: só grava quando a senha atual confere, então senha atual
 * errada mantém a anterior (5.9).
 */
export async function trocarSenha(
  usuario: Usuario,
  senhaAtual: string,
  senha: string,
  confirmacao: string,
  cabecalhos?: Headers,
): Promise<ResultadoTrocaSenha> {
  const problema = conferirNovaSenha(senha, confirmacao);

  if (problema) return problema;

  if (bancoConfigurado()) {
    try {
      const auth = await obterAutenticacao();
      const atuais = cabecalhos ?? (await headers());
      const sessao = await auth.api.getSession({
        headers: atuais,
        query: { disableCookieCache: true, disableRefresh: true },
      });
      if (!sessao || sessao.user.id !== usuario.id) {
        return { ok: false, campo: "senhaAtual", erro: "Sessão expirada. Entre novamente." };
      }
      await auth.api.changePassword({
        headers: atuais,
        body: { currentPassword: senhaAtual, newPassword: senha, revokeOtherSessions: true },
      });
      return { ok: true, mensagem: "Senha alterada. Use a nova senha no próximo acesso." };
    } catch (erro) {
      if (erro instanceof APIError && erro.body?.code === "INVALID_PASSWORD") {
        return { ok: false, campo: "senhaAtual", erro: "A senha atual não confere." };
      }
      throw traduzirErroPersistencia(erro);
    }
  }

  if (!(await conferirSenha(usuario.email, senhaAtual))) {
    return { ok: false, campo: "senhaAtual", erro: "A senha atual não confere." };
  }

  await definirSenha(usuario.email, senha, "troca_autenticada");

  return { ok: true, mensagem: "Senha alterada. Use a nova senha no próximo acesso." };
}

/** Descarta os links em memória; usado pelos testes. */
export function limparLinks(): void {
  links.clear();
}
