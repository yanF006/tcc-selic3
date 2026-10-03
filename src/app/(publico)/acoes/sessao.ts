"use server";

import { redirect } from "next/navigation";

import { gravarSessao, encerrarSessao, rotaInicial } from "@/lib/auth/sessao-servidor";
import { entrar, contasDeDesenvolvimento } from "@/lib/services/sessao";
import { usuarioPorId } from "@/lib/services/administracao";

/**
 * Server Actions da sessão simulada (D3). O cookie é gravado no servidor para
 * que o layout de servidor e a tela leiam o mesmo estado; o Better Auth vai
 * substituir estas ações.
 */

export interface EstadoLogin {
  erro?: string;
  ok: boolean;
}

export async function entrarAction(email: string, senha: string): Promise<EstadoLogin> {
  const resultado = await entrar(email, senha);

  if (!resultado.ok) return { ok: false, erro: resultado.erro };

  const conta = contasDeDesenvolvimento().find(
    (candidata) => candidata.email.toLowerCase() === email.trim().toLowerCase(),
  );

  if (!conta) return { ok: false, erro: "Conta de desenvolvimento não encontrada." };

  await gravarSessao(conta.id);
  redirect(rotaInicial(await usuarioPorId(conta.id)));
}

/** Troca a sessão para outra conta, para demonstrar as quatro áreas. */
export async function trocarSessaoAction(usuarioId: string, destino: string): Promise<void> {
  const usuario = await usuarioPorId(usuarioId);

  if (!usuario || usuario.situacao !== "ativo") redirect("/login");

  await gravarSessao(usuario.id);
  redirect(destino);
}

export async function sairAction(): Promise<void> {
  await encerrarSessao();
  redirect("/login");
}
