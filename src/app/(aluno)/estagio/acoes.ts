"use server";

import { revalidatePath } from "next/cache";

import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import { criarEstagio, selecionarDocumentos, removerDocumentoEstagio, type NovoEstagio } from "@/lib/services/estagios";
import { ErroDeRegra } from "@/lib/services/erros";
import {
  corrigirLancamento,
  lancarHoras,
  type NovoLancamento,
} from "@/lib/services/lancamentos";

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

export async function removerDocumentoEstagioAction(estagioId: string, templateId: string) {
  try {
    await removerDocumentoEstagio(estagioId, templateId);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroDeRegra) {
      return { ok: false, erro: erro.message };
    }
    return { ok: false, erro: "Erro ao remover documento." };
  }
}

export interface ResultadoHorasAction {
  ok: boolean;
  erro?: string;
}

/** Registra as horas de um dia do estágio conforme o aluno digita (8.19). */
export async function lancarHorasAction(dados: NovoLancamento): Promise<ResultadoHorasAction> {
  try {
    await usuarioDaRequisicaoObrigatorio();
    await lancarHoras(dados);
    revalidatePath("/estagio");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroDeRegra) {
      return { ok: false, erro: erro.message };
    }
    return { ok: false, erro: "Não foi possível lançar as horas." };
  }
}

/** Corrige um lançamento por correção, preservando o original (8.20). */
export async function corrigirLancamentoAction(
  lancamentoId: string,
  dados: Pick<NovoLancamento, "entrada" | "saida" | "almocoDesligado">,
): Promise<ResultadoHorasAction> {
  try {
    await usuarioDaRequisicaoObrigatorio();
    await corrigirLancamento(lancamentoId, dados);
    revalidatePath("/estagio");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroDeRegra) {
      return { ok: false, erro: erro.message };
    }
    return { ok: false, erro: "Não foi possível corrigir o lançamento." };
  }
}
