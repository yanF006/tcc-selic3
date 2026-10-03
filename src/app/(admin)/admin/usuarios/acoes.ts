"use server";

import { revalidatePath } from "next/cache";

import { exigirPapeis } from "@/lib/auth/guard";
import { ErroDeRegra } from "@/lib/services/erros";
import {
  cadastrarUsuario,
  editarUsuario,
  excluirUsuario,
  inativarUsuario,
  reativarUsuario,
  type CadastroUsuario,
} from "@/lib/services/administracao";
import type { Papel, SituacaoUsuario } from "@/lib/domain/types";

/**
 * Ações da tela de usuários (8.2, 8.3). Cada ação exige o papel de administrador
 * antes de tocar no estado: a guarda não vive só na interface.
 */

export interface ResultadoAcao {
  ok: boolean;
  erro?: string;
}

function erroDaRegra(erro: unknown): ResultadoAcao {
  if (erro instanceof ErroDeRegra || erro instanceof Error) {
    return { ok: false, erro: erro.message };
  }

  return { ok: false, erro: "Não foi possível concluir a operação." };
}

export async function cadastrarUsuarioAction(
  cadastro: CadastroUsuario,
): Promise<ResultadoAcao> {
  await exigirPapeis(["administrador"]);

  try {
    await cadastrarUsuario(cadastro);
  } catch (erro) {
    return erroDaRegra(erro);
  }

  revalidatePath("/admin/usuarios");

  return { ok: true };
}

export async function editarUsuarioAction(
  id: string,
  alteracoes: Partial<CadastroUsuario> & { situacao?: SituacaoUsuario },
): Promise<ResultadoAcao> {
  await exigirPapeis(["administrador"]);

  try {
    await editarUsuario(id, alteracoes);
  } catch (erro) {
    return erroDaRegra(erro);
  }

  revalidatePath("/admin/usuarios");

  return { ok: true };
}

export async function inativarUsuarioAction(id: string): Promise<ResultadoAcao> {
  await exigirPapeis(["administrador"]);

  try {
    await inativarUsuario(id);
  } catch (erro) {
    return erroDaRegra(erro);
  }

  revalidatePath("/admin/usuarios");

  return { ok: true };
}

export async function reativarUsuarioAction(id: string): Promise<ResultadoAcao> {
  await exigirPapeis(["administrador"]);

  try {
    await reativarUsuario(id);
  } catch (erro) {
    return erroDaRegra(erro);
  }

  revalidatePath("/admin/usuarios");

  return { ok: true };
}

export async function excluirUsuarioAction(id: string): Promise<ResultadoAcao> {
  await exigirPapeis(["administrador"]);

  try {
    await excluirUsuario(id);
  } catch (erro) {
    return erroDaRegra(erro);
  }

  revalidatePath("/admin/usuarios");

  return { ok: true };
}

/** Papéis disponíveis no formulário; o aluno exige matrícula. */
export async function papeisDisponiveisAction(): Promise<Papel[]> {
  await exigirPapeis(["administrador"]);

  return ["aluno", "coordenador_estagio", "coordenador_curso", "administrador"];
}