import { redirect } from "next/navigation";

import { rotaInicial, usuarioDaRequisicao } from "@/lib/auth/sessao-servidor";

/** A raiz leva para a área do papel do usuário ou, sem sessão, para o login. */
export default async function Raiz() {
  redirect(rotaInicial(await usuarioDaRequisicao()));
}
