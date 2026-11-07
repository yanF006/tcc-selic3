"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { APIError } from "better-auth/api";

import { gravarSessao, encerrarSessao, rotaInicial } from "@/lib/auth/sessao-servidor";
import { entrar } from "@/lib/services/sessao";
import { usuarioPorEmail, usuarioPorId } from "@/lib/services/administracao";
import { mensagemSeguraParaUsuario } from "@/lib/services/erros";
import type { Usuario } from "@/lib/domain/types";
import { bancoConfigurado } from "@/lib/db/prisma";
import { entrarComSenha } from "@/lib/auth/sessao-persistente";

/**
 * Com banco, as ações delegam a senha/cookies ao Better Auth. A simulação
 * permanece um caminho separado, sem ser usada como recuperação de falhas.
 */

export interface EstadoLogin {
  erro?: string;
  ok: boolean;
}

export async function entrarAction(email: string, senha: string): Promise<EstadoLogin> {
  let usuario: Usuario | null;

  try {
    if (bancoConfigurado()) {
      usuario = await entrarComSenha(email, senha, await headers());
    } else {
      const resultado = await entrar(email, senha);

      if (!resultado.ok) return { ok: false, erro: resultado.erro };

      // O usuário vem do estado pelo e-mail, e não da conta de desenvolvimento: a
      // senha pode ter sido redefinida (5.8) ou o cadastro pode ter vindo do
      // cadastro público, e o login continua valendo.
      usuario = await usuarioPorEmail(email);
    }
  } catch (erro) {
    if (erro instanceof APIError && erro.body?.code === "CONTA_PENDENTE") {
      return { ok: false, erro: "Cadastro pendente de autorização." };
    }
    if (erro instanceof APIError && erro.statusCode === 401) {
      return { ok: false, erro: "E-mail ou senha inválidos." };
    }
    return { ok: false, erro: mensagemSeguraParaUsuario(erro) };
  }

  if (!usuario) return { ok: false, erro: "E-mail ou senha inválidos." };

  if (!bancoConfigurado()) await gravarSessao(usuario.id);
  redirect(rotaInicial(usuario));
}

/** Troca a sessão para outra conta, para demonstrar as quatro áreas. */
export async function trocarSessaoAction(usuarioId: string, destino: string): Promise<void> {
  if (bancoConfigurado()) redirect("/login");
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
