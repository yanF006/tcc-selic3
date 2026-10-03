"use server";

import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import { atualizarDadosPessoais, type ResultadoDadosPessoais } from "@/lib/services/aluno";
import type { DadosPessoais } from "@/lib/domain/types";

export async function atualizarPerfilAction(dados: DadosPessoais): Promise<ResultadoDadosPessoais> {
  const usuario = await usuarioDaRequisicaoObrigatorio();

  return atualizarDadosPessoais(usuario, dados);
}
