"use server";

import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import { criarEstagio, selecionarDocumentos, type NovoEstagio } from "@/lib/services/estagios";
import { ErroDeRegra } from "@/lib/services/erros";

export async function criarEstagioAction(dados: NovoEstagio) {
  try {
    const usuario = await usuarioDaRequisicaoObrigatorio();
    const estagio = await criarEstagio(usuario, dados);
    return { ok: true, estagioId: estagio.id };
  } catch (erro) {
    if (erro instanceof ErroDeRegra) {
      return { ok: false, erro: erro.message };
    }
    return { ok: false, erro: "Erro ao cadastrar estágio." };
  }
}

export async function selecionarDocumentosAction(estagioId: string, templateIds: string[]) {
  try {
    await selecionarDocumentos(estagioId, templateIds);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroDeRegra) {
      return { ok: false, erro: erro.message };
    }
    return { ok: false, erro: "Erro ao selecionar documentos." };
  }
}
