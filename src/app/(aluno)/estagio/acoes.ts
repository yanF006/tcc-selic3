"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import {
  criarEstagio,
  editarEstagio,
  solicitarExclusaoEstagio,
  exigirAcessoEstagio,
  selecionarDocumentos,
  removerDocumentoEstagio,
  type NovoEstagio,
} from "@/lib/services/estagios";
import { ErroDeRegra } from "@/lib/services/erros";
import {
  corrigirLancamento,
  lancarHoras,
  lancamentoPorId,
  type NovoLancamento,
} from "@/lib/services/lancamentos";

export interface ResultadoEstagioAction {
  ok: boolean;
  estagioId?: string;
  erro?: string;
  erros?: Record<string, string>;
}

function errosDeCampos(erro: ZodError): Record<string, string> {
  return Object.fromEntries(erro.issues.map((issue) => [issue.path.join("."), issue.message]));
}

export async function criarEstagioAction(dados: NovoEstagio): Promise<ResultadoEstagioAction> {
  try {
    const usuario = await usuarioDaRequisicaoObrigatorio();
    const estagio = await criarEstagio(usuario, dados);
    revalidatePath("/estagio");
    return { ok: true, estagioId: estagio.id };
  } catch (erro) {
    if (erro instanceof ZodError)
      return { ok: false, erro: erro.issues[0].message, erros: errosDeCampos(erro) };
    if (erro instanceof ErroDeRegra) {
      return { ok: false, erro: erro.message };
    }
    return { ok: false, erro: "Erro ao cadastrar estágio." };
  }
}

export async function editarEstagioAction(
  estagioId: string,
  dados: NovoEstagio,
): Promise<ResultadoEstagioAction> {
  try {
    const usuario = await usuarioDaRequisicaoObrigatorio();
    await exigirAcessoEstagio(usuario, estagioId);
    await editarEstagio(estagioId, dados, usuario.id);
    revalidatePath("/estagio");
    revalidatePath("/coordenacao/estagios");
    return { ok: true };
  } catch (erro) {
    return {
      ok: false,
      erro:
        erro instanceof ZodError
          ? erro.issues[0].message
          : erro instanceof Error
            ? erro.message
            : "Não foi possível editar o estágio.",
      erros: erro instanceof ZodError ? errosDeCampos(erro) : undefined,
    };
  }
}

export async function solicitarExclusaoEstagioAction(estagioId: string, motivo: string) {
  try {
    const usuario = await usuarioDaRequisicaoObrigatorio();
    await exigirAcessoEstagio(usuario, estagioId);
    await solicitarExclusaoEstagio(estagioId, usuario.id, motivo);
    return { ok: true };
  } catch (erro) {
    return {
      ok: false,
      erro: erro instanceof Error ? erro.message : "Não foi possível solicitar a exclusão.",
    };
  }
}

export async function selecionarDocumentosAction(estagioId: string, templateIds: string[]) {
  try {
    await exigirAcessoEstagio(await usuarioDaRequisicaoObrigatorio(), estagioId);
    await selecionarDocumentos(estagioId, templateIds);
    revalidatePath("/estagio");
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
    await exigirAcessoEstagio(await usuarioDaRequisicaoObrigatorio(), estagioId);
    await removerDocumentoEstagio(estagioId, templateId);
    revalidatePath("/estagio");
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
    await exigirAcessoEstagio(await usuarioDaRequisicaoObrigatorio(), dados.estagioId);
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
    const lancamento = await lancamentoPorId(lancamentoId);
    if (!lancamento) return { ok: false, erro: "Lançamento não disponível." };
    await exigirAcessoEstagio(await usuarioDaRequisicaoObrigatorio(), lancamento.estagioId);
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
