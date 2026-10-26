"use server";

import { revalidatePath } from "next/cache";
import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import { marcarNotificacoesLidas } from "@/lib/services/sessao";

export async function marcarNotificacoesLidasAction() {
  const usuario = await usuarioDaRequisicaoObrigatorio();
  marcarNotificacoesLidas(usuario.id);
  revalidatePath("/", "layout");
}
