"use server";

import { validarEtapaUm, concluirCadastro } from "@/lib/services/cadastro";

import type {
  EtapaDoisCadastro,
  PreviaCadastro,
  ResultadoCadastro,
  ResultadoConclusao,
} from "@/lib/services/cadastro";

/**
 * Server Actions do cadastro público (5.2 a 5.7). Cada etapa é uma ação: a
 * primeira devolve a prévia validada, a segunda grava o cadastro em memória.
 */

export type { PreviaCadastro };

export async function validarEtapaUmAction(dados: {
  matricula: string;
  email: string;
  senha: string;
  confirmacao: string;
}): Promise<ResultadoCadastro> {
  return validarEtapaUm(dados);
}

export async function concluirCadastroAction(
  previaId: string,
  dados: EtapaDoisCadastro,
): Promise<ResultadoConclusao> {
  return concluirCadastro(previaId, dados);
}
