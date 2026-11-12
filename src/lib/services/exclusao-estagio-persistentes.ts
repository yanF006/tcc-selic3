import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { Estagio, SolicitacaoExclusaoEstagio, Usuario } from "@/lib/domain/types";
import { estagioLiberado } from "@/lib/domain/fluxo-estagio";
import { carregarCliente } from "@/lib/db/prisma";
import { executarTransacao } from "@/lib/db/transacoes";
import { buscarEstagio, paraDominioEstagio, podeConsultarEstagioNoBanco } from "@/lib/db/repositorios/estagios";
import { ErroDeRegra } from "./erros";
import { valoresSemDadosDoAluno } from "./dados-pessoais-estagio";
import { novoId } from "./store";

type Transacao = Prisma.TransactionClient;

/**
 * Mesma ordem de locks das demais mutações de estágio: aluno, depois estágio.
 * Uma segunda operação concorrente espera o commit e enxerga o estado final,
 * portanto não repete efeitos de exclusão ou de solicitação.
 */
async function bloquearEstagio(tx: Transacao, alunoId: string, estagioId: string) {
  await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${alunoId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM estagios WHERE id = ${estagioId} FOR UPDATE`;
}

async function ponteiroDoEstagio(estagioId: string): Promise<{ alunoId: string }> {
  const { prisma } = await carregarCliente();
  const ponteiro = await prisma.estagio.findUnique({ where: { id: estagioId }, select: { alunoId: true } });
  if (!ponteiro) throw new ErroDeRegra("Estágio não disponível.", "acesso_negado");
  return ponteiro;
}

/**
 * Cancelamento pelo aluno (antes da liberação) ou exclusão de estágio.
 * Exclusão feita pelo coordenador de curso do aluno ocorre diretamente e fica
 * registrada com responsável e data na solicitação de exclusão de situação
 * `autorizado`. Efeitos: estágio fora dos processos ativos, documentos
 * inativados, dados pessoais removidos do contexto e envios sem e-mail.
 */
export async function encerrarEstagioPersistente(estagioId: string, autor: Usuario, modo: "cancelar" | "excluir"): Promise<Estagio> {
  const { alunoId } = await ponteiroDoEstagio(estagioId);
  const { prisma } = await carregarCliente();

  return executarTransacao(async (tx) => {
    await bloquearEstagio(tx, alunoId, estagioId);
    const linha = await tx.estagio.findUnique({ where: { id: estagioId }, include: { templates: true } });
    if (!linha || linha.alunoId !== alunoId) throw new ErroDeRegra("Estágio não disponível.", "acesso_negado");
    if (!(await podeConsultarEstagioNoBanco(tx, autor.id, estagioId))) throw new ErroDeRegra("Estágio não disponível.", "acesso_negado");

    const estagio = paraDominioEstagio(linha);
    const aluno = await tx.usuario.findUniqueOrThrow({ where: { id: alunoId }, include: { dadosPessoaisAluno: true } });
    const titular = autor.id === alunoId;

    if (modo === "cancelar") {
      if (!titular) throw new ErroDeRegra("A exclusão cabe ao aluno titular.", "acesso_negado");
      if (estagio.situacao !== "em_preparacao" || estagioLiberado(estagio))
        throw new ErroDeRegra("Somente solicitações aguardando liberação podem ser canceladas.", "cancelamento_indisponivel");
    } else if (!titular) {
      const coordenadorDoCurso = autor.papel === "coordenador_curso" && !!autor.cursoId && autor.cursoId === aluno.dadosPessoaisAluno?.cursoId;
      if (!coordenadorDoCurso) throw new ErroDeRegra("Exclusão indisponível para este usuário.", "acesso_negado");
    }

    if (linha.excluidoEm) return estagio;

    const momento = new Date();
    const efeitos = await tx.estagio.updateMany({
      where: { id: estagioId, excluidoEm: null },
      data: {
        excluidoEm: momento,
        ...(modo === "cancelar" ? { canceladoEm: momento } : {}),
        nomeAlunoHistorico: aluno.nome,
        cursoIdHistorico: aluno.dadosPessoaisAluno?.cursoId ?? null,
      },
    });
    if (efeitos.count === 0) return (await buscarEstagio(tx, estagioId)) ?? estagio;

    const documentos = await tx.documentoPreenchido.findMany({ where: { estagioId } });
    for (const documento of documentos) {
      await tx.documentoPreenchido.update({
        where: { id: documento.id },
        data: {
          valores: valoresSemDadosDoAluno(documento.templateId, documento.versaoTemplate, documento.valores as Record<string, unknown>) as Prisma.InputJsonValue,
          situacao: "inativo",
          inativadoEm: momento,
        },
      });
    }
    const idsDocumentos = documentos.map((documento) => documento.id);
    if (idsDocumentos.length > 0) {
      await tx.envioExterno.updateMany({
        where: {
          documentoId: { in: idsDocumentos },
          OR: [{ destinatarioPapel: "aluno" }, { destinatarioEmail: aluno.email }],
        },
        data: { destinatarioEmail: "" },
      });
    }

    if (modo === "excluir") {
      await tx.solicitacaoExclusaoEstagio.updateMany({
        where: { estagioId, situacao: "pendente" },
        data: { situacao: "autorizado", decididoPorId: autor.id, decididoEm: momento },
      });
      await tx.solicitacaoExclusaoEstagio.create({
        data: {
          id: novoId("exc"),
          estagioId,
          solicitanteId: autor.id,
          situacao: "autorizado",
          decididoPorId: autor.id,
          decididoEm: momento,
        },
      });
    }

    return (await buscarEstagio(tx, estagioId)) ?? estagio;
  }, { cliente: prisma });
}

function paraSolicitacao(linha: { id: string; estagioId: string; solicitanteId: string; situacao: string; motivo: string | null; criadoEm: Date; decididoEm: Date | null }): SolicitacaoExclusaoEstagio {
  return {
    id: linha.id,
    estagioId: linha.estagioId,
    solicitanteId: linha.solicitanteId,
    situacao: linha.situacao as SolicitacaoExclusaoEstagio["situacao"],
    motivo: linha.motivo ?? undefined,
    criadoEm: linha.criadoEm.toISOString(),
    decididoEm: linha.decididoEm?.toISOString(),
  };
}

/** Registra um pedido de exclusão pendente; repetir o pedido devolve o pendente existente. */
export async function solicitarExclusaoPersistente(estagioId: string, solicitanteId: string, motivo?: string): Promise<SolicitacaoExclusaoEstagio> {
  const { alunoId } = await ponteiroDoEstagio(estagioId);
  const { prisma } = await carregarCliente();

  return executarTransacao(async (tx) => {
    await bloquearEstagio(tx, alunoId, estagioId);
    if (!(await podeConsultarEstagioNoBanco(tx, solicitanteId, estagioId))) throw new ErroDeRegra("Estágio não disponível.", "acesso_negado");
    const pendente = await tx.solicitacaoExclusaoEstagio.findFirst({ where: { estagioId, situacao: "pendente" } });
    if (pendente) return paraSolicitacao(pendente);
    const criada = await tx.solicitacaoExclusaoEstagio.create({
      data: { id: novoId("exc"), estagioId, solicitanteId, situacao: "pendente", motivo: motivo ?? null },
    });
    return paraSolicitacao(criada);
  }, { cliente: prisma });
}

export async function exclusaoPendentePersistente(estagioId: string): Promise<boolean> {
  const { prisma } = await carregarCliente();
  return (await prisma.solicitacaoExclusaoEstagio.count({ where: { estagioId, situacao: "pendente" } })) > 0;
}
