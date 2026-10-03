"use server";

import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import { trocarSenha } from "@/lib/services/senhas";

/**
 * Troca autenticada de senha (5.9). A sessão vem do cookie: a tela não escolhe de
 * quem é a senha, e o serviço só grava quando a senha atual confere.
 */

export interface EstadoTrocaSenha {
  ok: boolean;
  erro?: string;
  /** Campo ao qual a mensagem pertence, para o erro aparecer no campo. */
  campo?: "senha" | "confirmacao" | "senhaAtual";
  mensagem?: string;
}

export async function trocarSenhaAction(
  senhaAtual: string,
  senha: string,
  confirmacao: string,
): Promise<EstadoTrocaSenha> {
  const usuario = await usuarioDaRequisicaoObrigatorio();
  const resultado = await trocarSenha(usuario, senhaAtual, senha, confirmacao);

  if (!resultado.ok) return { ok: false, erro: resultado.erro, campo: resultado.campo };

  return { ok: true, mensagem: resultado.mensagem };
}
