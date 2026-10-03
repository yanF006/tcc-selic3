import { definirSenha, conferirSenha } from "./credenciais";
import { agora } from "./store";
import { usuarioPorEmail } from "./administracao";
import { esquemaSenha } from "@/lib/domain/schemas";
import type { Usuario } from "@/lib/domain/types";

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
 * - nada é gravado fora do processo do servidor (D4): a troca de senha depois
 *   desta etapa é o que o backend vai persistir.
 */

/** Validade do link de redefinição, em minutos. */
export const VALIDADE_LINK_MINUTOS = 60;

/** Confirmação do pedido, igual para e-mail cadastrado e para e-mail inexistente. */
export const CONFIRMACAO_REDEFINICAO =
  "Se houver um cadastro com este e-mail, enviamos um link para definir uma nova senha. Confira também a caixa de spam.";

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
   * Link de uso único entregue no e-mail. Sem servidor de e-mail nesta entrega,
   * a tela de confirmação o exibe para que o fluxo seja demonstrável de ponta a
   * ponta; com Nodemailer, este campo continua existindo e sai da interface.
   */
  link: string;
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
export async function solicitarRedefinicao(email: string): Promise<PedidoRedefinicao> {
  const alvo = email.trim().toLowerCase();
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
): Promise<ResultadoSenha> {
  const problema = conferirNovaSenha(senha, confirmacao);

  if (problema) return problema;

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
): Promise<ResultadoTrocaSenha> {
  const problema = conferirNovaSenha(senha, confirmacao);

  if (problema) return problema;

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
