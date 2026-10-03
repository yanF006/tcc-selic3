import "server-only";

import { redirect } from "next/navigation";

import { avaliarAcesso, podeAcessarAlgum } from "@/lib/auth/permissions";
import { usuarioDaRequisicao } from "@/lib/auth/sessao-servidor";
import type { Papel, Usuario } from "@/lib/domain/types";

/**
 * Guarda única (D1). Cada route group chama uma destas funções no seu layout;
 * nenhuma tela repete a verificação de papel.
 */

/** Exige sessão ativa; sem ela, redireciona para o login preservando o destino. */
export async function exigirSessao(destino?: string): Promise<Usuario> {
  const usuario = await usuarioDaRequisicao();

  if (!usuario) {
    redirect(destino ? `/login?redirect=${encodeURIComponent(destino)}` : "/login");
  }

  return usuario;
}

/**
 * Exige sessão com pelo menos um dos papéis informados (áreas que servem a mais
 * de um cargo, como a coordenação).
 */
export async function exigirAlgumDosPapeis(
  papeisExigidos: Papel[],
  destino?: string,
): Promise<Usuario> {
  const usuario = await exigirSessao(destino);

  if (!podeAcessarAlgum(usuario, papeisExigidos)) redirect("/nao-autorizado");

  return usuario;
}

/**
 * Guarda das áreas (D1):resolve a sessão e aplica a exigência de papéis de uma
 * vez. O cadastro pendente atravessa a guarda para ver apenas o aviso de aguardo
 * (5.7); nenhuma tela recebe dados dele, porque a casca troca `children` pelo
 * aviso.
 */
export async function exigirArea({
  papeisExigidos,
  destino,
  qualquerPapel,
}: {
  papeisExigidos: Papel[];
  destino: string;
  qualquerPapel?: boolean;
}): Promise<Usuario> {
  const usuario = await exigirSessao(destino);

  // O cadastro pendente atravessa somente a guarda da área do aluno, onde a
  // casca troca `children` pelo aviso de aguardo (5.7). Qualquer outra área
  // continua negada.
  if (usuario.situacao === "pendente") {
    if (papeisExigidos.includes("aluno")) return usuario;

    redirect("/nao-autorizado");
  }

  const acesso = qualquerPapel
    ? podeAcessarAlgum(usuario, papeisExigidos)
    : avaliarAcesso(usuario, papeisExigidos).permitido;

  if (!acesso) redirect("/nao-autorizado");

  return usuario;
}

/** Exige sessão com os papéis informados; sem permissão, vai para /nao-autorizado. */
export async function exigirPapeis(papeisExigidos: Papel[], destino?: string): Promise<Usuario> {
  const usuario = await exigirSessao(destino);
  const acesso = avaliarAcesso(usuario, papeisExigidos);

  if (!acesso.permitido) redirect("/nao-autorizado");

  return usuario;
}
