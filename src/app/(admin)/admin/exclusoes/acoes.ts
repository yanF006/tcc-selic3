"use server";

import { revalidatePath } from "next/cache";

import { exigirPapeis } from "@/lib/auth/guard";
import { mensagemSeguraParaUsuario } from "@/lib/services/erros";
import { decidirExclusaoEstagio } from "@/lib/services/estagios";

export async function decidirExclusaoAction(
  solicitacaoId: string,
  autorizar: boolean,
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const usuario = await exigirPapeis(["administrador"]);
    await decidirExclusaoEstagio(solicitacaoId, usuario, autorizar);
  } catch (erro) {
    return { ok: false, erro: mensagemSeguraParaUsuario(erro) };
  }
  revalidatePath("/admin/exclusoes");
  revalidatePath("/coordenacao/estagios");
  revalidatePath("/estagio");
  return { ok: true };
}
