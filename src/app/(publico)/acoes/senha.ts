"use server";

import { esquemaEmail } from "@/lib/domain/schemas";
import { mensagemSeguraParaUsuario } from "@/lib/services/erros";
import {
  redefinirSenhaComLink,
  solicitarRedefinicao,
  type CampoSenha,
} from "@/lib/services/senhas";

/**
 * Server Actions de senha (5.8 e 5.9). O pedido de redefinição e a troca pelo
 * link são públicos; a troca autenticada fica em `app/(conta)/conta/senha/acoes.ts`,
 * porque exige a sessão do cookie.
 *
 * Nenhuma delas guarda a senha: no modo persistente, a biblioteca controla
 * hash, verificação e consumo do token.
 */

export interface EstadoRecuperacao {
  ok: boolean;
  erro?: string;
  /** Mensagem genérica, idêntica para e-mail cadastrado e inexistente. */
  confirmacao?: string;
  /** Link de demonstração, disponível exclusivamente no modo sem banco. */
  link?: string;
}

export interface EstadoRedefinicao {
  ok: boolean;
  erro?: string;
  /** Campo ao qual a mensagem pertence; `link` vira a tela de link não utilizável. */
  campo?: CampoSenha;
  mensagem?: string;
}

export type { CampoSenha };

export async function solicitarRedefinicaoAction(email: string): Promise<EstadoRecuperacao> {
  const valido = esquemaEmail.safeParse(email);

  if (!valido.success) {
    return { ok: false, erro: valido.error.issues[0]?.message ?? "Informe um e-mail válido." };
  }

  try {
    const pedido = await solicitarRedefinicao(valido.data);
    return {
      ok: true,
      confirmacao: pedido.confirmacao,
      ...(pedido.link ? { link: pedido.link } : {}),
    };
  } catch (erro) {
    return { ok: false, erro: mensagemSeguraParaUsuario(erro) };
  }
}

export async function redefinirSenhaAction(
  token: string,
  senha: string,
  confirmacao: string,
): Promise<EstadoRedefinicao> {
  try {
    const resultado = await redefinirSenhaComLink(token, senha, confirmacao);
    if (!resultado.ok) return { ok: false, erro: resultado.erro, campo: resultado.campo };
    return { ok: true, mensagem: resultado.mensagem };
  } catch (erro) {
    return { ok: false, erro: mensagemSeguraParaUsuario(erro) };
  }
}
