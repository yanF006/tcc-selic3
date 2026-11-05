"use server";

import { revalidatePath } from "next/cache";

import { exigirAlgumDosPapeis } from "@/lib/auth/guard";
import { decidirSolicitacao } from "@/lib/services/administracao";
import { mensagemSeguraParaUsuario } from "@/lib/services/erros";

/**
 * Ações da fila de cadastros pendentes (5.6). A coordenação e a administração
 * decidem com motivo registrado; a decisão libera ou mantém o cadastro inativo.
 */

const PAPEIS = ["coordenador_estagio", "coordenador_curso", "administrador"] as const;

export interface ResultadoDecisao {
  ok: boolean;
  erro?: string;
}

export async function decidirSolicitacaoAction(
  solicitacaoId: string,
  decisao: "autorizado" | "recusado",
  motivo: string,
): Promise<ResultadoDecisao> {
  try {
    const usuario = await exigirAlgumDosPapeis([...PAPEIS], "/solicitacoes");
    await decidirSolicitacao(solicitacaoId, decisao, usuario.id, motivo);
    revalidatePath("/solicitacoes");

    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: mensagemSeguraParaUsuario(erro) };
  }
}
