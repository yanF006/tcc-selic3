"use server";

import { revalidatePath } from "next/cache";

import { exigirPapeis } from "@/lib/auth/guard";
import { registrarMatricula, type LinhaImportacao } from "@/lib/services/administracao";
import { ErroDeRegra } from "@/lib/services/erros";

/**
 * Lançamento manual de matrícula válida (5.6 e bloco 8.4). Enquanto não houver
 * integração com o SIGAA, é este registro que faz a matrícula do aluno valer.
 */

export interface ResultadoAcao {
  ok: boolean;
  erro?: string;
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
