import "server-only";

import { cookies, headers } from "next/headers";

import { areaDe } from "@/lib/auth/permissions";
import type { Usuario } from "@/lib/domain/types";
import { usuarioPorId } from "@/lib/services/administracao";
import { bancoConfigurado } from "@/lib/db/prisma";
import { obterAutenticacao } from "./autenticacao";
import { consultarUsuarioAutenticado } from "./sessao-persistente";

/**
 * Com banco, valida a sessão persistida e consulta a conta atual em cada
 * requisição. O cookie de ID existe exclusivamente no adapter simulado.
 */

export const COOKIE_SESSAO = "selic-sessao";

/** Usuário da requisição atual, ou null quando não há sessão válida. */
export async function usuarioDaRequisicao(): Promise<Usuario | null> {
  if (bancoConfigurado()) return consultarUsuarioAutenticado(await headers());
  const usuarioId = (await cookies()).get(COOKIE_SESSAO)?.value;

  if (!usuarioId) return null;

  const usuario = await usuarioPorId(usuarioId);

  // Inativo não entra mais; cadastro pendente entra e vê apenas o aviso (5.7).
  if (!usuario || usuario.situacao === "inativo") return null;

  return usuario;
}

/** Usuário da requisição atual, com o grava garantido em Server Action. */
export async function usuarioDaRequisicaoObrigatorio(): Promise<Usuario> {
  const usuario = await usuarioDaRequisicao();

  if (!usuario) throw new Error("Sessão expirada: entre novamente.");

  return usuario;
}

export async function gravarSessao(usuarioId: string): Promise<void> {
  if (bancoConfigurado()) throw new Error("Sessão persistente exige autenticação pelo provedor.");
  const loja = await cookies();

  loja.set(COOKIE_SESSAO, usuarioId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Sem `secure` para funcionar em http://localhost durante a demonstração.
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
  });
}

export async function encerrarSessao(): Promise<void> {
  if (bancoConfigurado()) {
    const auth = await obterAutenticacao();
    await auth.api.signOut({ headers: await headers() });
    return;
  }
  (await cookies()).delete(COOKIE_SESSAO);
}

/** Caminho inicial de cada área, usado depois do login e do logout. */
export function rotaInicial(usuario: Usuario | null): string {
  switch (areaDe(usuario)) {
    case "admin":
      return "/admin/usuarios";
    case "coordenacao":
      return "/coordenacao/estagios";
    case "aluno":
      return "/documentos";
    default:
      return "/login";
  }
}
