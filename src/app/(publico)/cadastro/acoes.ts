"use server";

import { validarEtapaUm, concluirCadastro } from "@/lib/services/cadastro";
import { mensagemSeguraParaUsuario } from "@/lib/services/erros";

import type {
  DadosCadastroCompleto,
  ResultadoCadastro,
  ResultadoConclusao,
} from "@/lib/services/cadastro";

/**
 * Server Actions do cadastro público (5.1 a 5.5). A primeira etapa apenas
 * confere disponibilidade; a segunda envia o formulário completo e revalida
 * tudo no servidor antes de gravar.
 */

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
  dados: DadosCadastroCompleto,
): Promise<ResultadoConclusao> {
  try {
    return await concluirCadastro(dados);
  } catch (erro) {
    return { ok: false, campo: "dados", erro: mensagemSeguraParaUsuario(erro) };
  }
}
