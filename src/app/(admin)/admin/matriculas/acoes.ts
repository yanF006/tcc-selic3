"use server";

import { revalidatePath } from "next/cache";

import { exigirPapeis } from "@/lib/auth/guard";
import {
  importarMatriculas,
  registrarMatricula,
  type LinhaImportacao,
} from "@/lib/services/administracao";
import type { ResultadoImportacao } from "@/lib/domain/types";
import { ErroDeRegra } from "@/lib/services/erros";

/**
 * Lançamento manual de matrícula válida (5.6 e bloco 8.4). Enquanto não houver
 * integração com o SIGAA, é este registro que faz a matrícula do aluno valer.
 */

export interface ResultadoAcao {
  ok: boolean;
  erro?: string;
  resultado?: ResultadoImportacao;
}

export async function registrarMatriculaAction(linha: LinhaImportacao): Promise<ResultadoAcao> {
  await exigirPapeis(["administrador"]);

  try {
    await registrarMatricula(linha);
  } catch (erro) {
    if (erro instanceof ErroDeRegra || erro instanceof Error) {
      return { ok: false, erro: erro.message };
    }

    throw erro;
  }

  revalidatePath("/admin/matriculas");
  revalidatePath("/admin/usuarios");

  return { ok: true };
}

/**
 * Importação manual por arquivo (11.10). O relatório devolve cada linha como
 * válida, rejeitada ou ignorada, com o motivo quando houver.
 */
export async function importarMatriculasAction(
  arquivo: string,
  linhas: LinhaImportacao[],
): Promise<ResultadoAcao> {
  await exigirPapeis(["administrador"]);

  try {
    if (linhas.length === 0) throw new Error("O arquivo não possui linhas para importar.");
    const resultado = await importarMatriculas(arquivo, linhas);
    revalidatePath("/admin/matriculas");
    revalidatePath("/admin/usuarios");
    return { ok: true, resultado };
  } catch (erro) {
    if (erro instanceof ErroDeRegra || erro instanceof Error) {
      return { ok: false, erro: erro.message };
    }

    throw erro;
  }
}
