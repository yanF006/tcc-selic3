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
  cancelarSolicitacao,
  excluirEstagio,
  concluirEstagio,
  reabrirEstagio,
} from "@/lib/services/estagios";
import {
  confirmarAssinaturas,
  enviarParaAssinaturas,
  reabrirParaCorrecao,
  solicitarEncaminhamento,
} from "@/lib/services/fluxo-estagio";
import { registrarParecer } from "@/lib/services/documentos";
import { acrescentarObservacao } from "@/lib/services/observacoes";
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

async function executarFluxo(operacao: () => Promise<unknown>) {
  try {
    await operacao();
    revalidatePath("/estagio");
    revalidatePath("/coordenacao/estagios");
    revalidatePath("/coordenacao/documentos");
    return { ok: true };
  } catch (erro) {
    return {
      ok: false,
      erro: erro instanceof Error ? erro.message : "Não foi possível concluir a operação.",
    };
  }
}

export async function encaminharEstagioAction(estagioId: string) {
  return executarFluxo(async () =>
    solicitarEncaminhamento(estagioId, await usuarioDaRequisicaoObrigatorio()),
  );
}

export async function corrigirSolicitacaoAction(estagioId: string) {
  return executarFluxo(async () =>
    reabrirParaCorrecao(estagioId, await usuarioDaRequisicaoObrigatorio()),
  );
}

export async function confirmarAssinaturasAction(
  estagioId: string,
  confirmacoes: { documentoId: string; confirmado: boolean; observacao?: string }[],
) {
  return executarFluxo(async () =>
    confirmarAssinaturas(estagioId, await usuarioDaRequisicaoObrigatorio(), confirmacoes),
  );
}

export async function emitirParecerAction(
  documentoId: string,
  decisao: "aprovado" | "indeferido",
  observacao: string,
) {
  return executarFluxo(async () =>
    registrarParecer(documentoId, decisao, await usuarioDaRequisicaoObrigatorio(), observacao),
  );
}

export async function observarDocumentoAction(documentoId: string, conteudo: string) {
  return executarFluxo(async () => {
    const observacao = await acrescentarObservacao(
      documentoId,
      conteudo,
      await usuarioDaRequisicaoObrigatorio(),
    );
    revalidatePath("/documentos", "layout");
    return observacao;
  });
}

export async function enviarAssinaturasAction(documentoId: string) {
  return executarFluxo(async () =>
    enviarParaAssinaturas(documentoId, await usuarioDaRequisicaoObrigatorio()),
  );
}

export async function encerrarRegistroAction(estagioId: string, cancelar: boolean) {
  return executarFluxo(async () => {
    const usuario = await usuarioDaRequisicaoObrigatorio();
    return cancelar ? cancelarSolicitacao(estagioId, usuario) : excluirEstagio(estagioId, usuario);
  });
}

export async function alterarSituacaoAction(estagioId: string, concluir: boolean) {
  return executarFluxo(async () => {
    const usuario = await usuarioDaRequisicaoObrigatorio();
    return concluir
      ? concluirEstagio(estagioId, usuario.id)
      : reabrirEstagio(estagioId, usuario.id);
  });
}
