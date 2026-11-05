"use server";

import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import { atualizarDadosPessoais, type ResultadoDadosPessoais } from "@/lib/services/aluno";
import type { DadosPessoais } from "@/lib/domain/types";
import { mensagemSeguraParaUsuario } from "@/lib/services/erros";

export async function atualizarPerfilAction(dados: DadosPessoais): Promise<ResultadoDadosPessoais> {
  try {
    const usuario = await usuarioDaRequisicaoObrigatorio();

    return await atualizarDadosPessoais(usuario, dados);
  } catch (erro) {
    return { ok: false, erro: mensagemSeguraParaUsuario(erro), erros: {} };
  }
}
