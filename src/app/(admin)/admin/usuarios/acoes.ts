"use server";

import { revalidatePath } from "next/cache";

import { exigirPapeis } from "@/lib/auth/guard";
import { mensagemSeguraParaUsuario } from "@/lib/services/erros";
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

function erroDaAcao(erro: unknown): ResultadoAcao {
  return { ok: false, erro: mensagemSeguraParaUsuario(erro) };
}

export async function cadastrarUsuarioAction(cadastro: CadastroUsuario): Promise<ResultadoAcao> {
  try {
    await exigirPapeis(["administrador"]);
    await cadastrarUsuario(cadastro);
  } catch (erro) {
    return erroDaAcao(erro);
  }

  revalidatePath("/admin/usuarios");

  return { ok: true };
}

export async function editarUsuarioAction(
  id: string,
  alteracoes: Partial<CadastroUsuario> & { situacao?: SituacaoUsuario },
): Promise<ResultadoAcao> {
  try {
    await exigirPapeis(["administrador"]);
    await editarUsuario(id, alteracoes);
  } catch (erro) {
    return erroDaAcao(erro);
  }

  revalidatePath("/admin/usuarios");

  return { ok: true };
}

export async function inativarUsuarioAction(id: string): Promise<ResultadoAcao> {
  try {
    await exigirPapeis(["administrador"]);
    await inativarUsuario(id);
  } catch (erro) {
    return erroDaAcao(erro);
  }

  revalidatePath("/admin/usuarios");

  return { ok: true };
}

export async function reativarUsuarioAction(id: string): Promise<ResultadoAcao> {
  try {
    await exigirPapeis(["administrador"]);
    await reativarUsuario(id);
  } catch (erro) {
    return erroDaAcao(erro);
  }

  revalidatePath("/admin/usuarios");

  return { ok: true };
}

export async function excluirUsuarioAction(id: string): Promise<ResultadoAcao> {
  try {
    await exigirPapeis(["administrador"]);
    await excluirUsuario(id);
  } catch (erro) {
    return erroDaAcao(erro);
  }

  revalidatePath("/admin/usuarios");

  return { ok: true };
}

/** Papéis disponíveis no formulário; o aluno exige matrícula. */
export async function papeisDisponiveisAction(): Promise<Papel[]> {
  try {
    await exigirPapeis(["administrador"]);
  } catch {
    return [];
  }

  return ["aluno", "coordenador_estagio", "coordenador_curso", "administrador"];
}
