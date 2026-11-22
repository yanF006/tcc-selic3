"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { APIError } from "better-auth/api";

import { gravarSessao, encerrarSessao, rotaInicial } from "@/lib/auth/sessao-servidor";
import { entrar } from "@/lib/services/sessao";
import { usuarioPorEmail } from "@/lib/services/administracao";
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
    if (erro instanceof APIError && erro.body?.code === "CADASTRO_RECUSADO") {
      return { ok: false, erro: erro.body.message ?? "Cadastro recusado." };
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

export async function sairAction(): Promise<void> {
  await encerrarSessao();
  redirect("/login");
}
