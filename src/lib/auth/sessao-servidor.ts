import "server-only";

import { cookies } from "next/headers";

import { areaDe } from "@/lib/auth/permissions";
import type { Usuario } from "@/lib/domain/types";
import { usuarioPorId } from "@/lib/services/administracao";

/**
 * Sessão simulada em cookie (D3). Layouts de servidor e componentes de cliente
 * leem o mesmo estado porque a sessão não vive em contexto React.
 *
 * O cookie guarda apenas o identificador do usuário: o backend vai trocar isto
 * por cookie assinada do Better Auth.
 */

export const COOKIE_SESSAO = "selic-sessao";

/** Usuário da requisição atual, ou null quando não há sessão válida. */
export async function usuarioDaRequisicao(): Promise<Usuario | null> {
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
