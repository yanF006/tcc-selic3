"use server";

import { validarEtapaUm, concluirCadastro } from "@/lib/services/cadastro";
import { mensagemSeguraParaUsuario } from "@/lib/services/erros";

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
  try {
    return await validarEtapaUm(dados);
  } catch (erro) {
    return { ok: false, campo: "dados", erro: mensagemSeguraParaUsuario(erro) };
  }
}

export async function concluirCadastroAction(
  previaId: string,
  dados: EtapaDoisCadastro,
): Promise<ResultadoConclusao> {
  try {
    return await concluirCadastro(previaId, dados);
  } catch (erro) {
    return { ok: false, campo: "dados", erro: mensagemSeguraParaUsuario(erro) };
  }
}
