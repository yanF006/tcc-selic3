"use server";

import { redirect } from "next/navigation";

import { gravarSessao, encerrarSessao, rotaInicial } from "@/lib/auth/sessao-servidor";
import { entrar } from "@/lib/services/sessao";
import { usuarioPorEmail, usuarioPorId } from "@/lib/services/administracao";
import { mensagemSeguraParaUsuario } from "@/lib/services/erros";
import type { Usuario } from "@/lib/domain/types";

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
  let usuario: Usuario | null;

  try {
    const resultado = await entrar(email, senha);

    if (!resultado.ok) return { ok: false, erro: resultado.erro };

    // O usuário vem do estado pelo e-mail, e não da conta de desenvolvimento: a
    // senha pode ter sido redefinida (5.8) ou o cadastro pode ter vindo do
    // cadastro público, e o login continua valendo.
    usuario = await usuarioPorEmail(email);
  } catch (erro) {
    return { ok: false, erro: mensagemSeguraParaUsuario(erro) };
  }

  if (!usuario) return { ok: false, erro: "E-mail ou senha inválidos." };

  await gravarSessao(usuario.id);
  redirect(rotaInicial(usuario));
}

/** Troca a sessão para outra conta, para demonstrar as quatro áreas. */
export async function trocarSessaoAction(usuarioId: string, destino: string): Promise<void> {
  let usuario: Usuario | null;

  try {
    usuario = await usuarioPorId(usuarioId);
  } catch {
    redirect("/login");
  }

  if (!usuario || usuario.situacao !== "ativo") redirect("/login");

  await gravarSessao(usuario.id);
  redirect(destino);
}

export async function sairAction(): Promise<void> {
  await encerrarSessao();
  redirect("/login");
}
