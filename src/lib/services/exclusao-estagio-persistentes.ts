import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { Estagio, SolicitacaoExclusaoEstagio, Usuario } from "@/lib/domain/types";
import { estagioLiberado } from "@/lib/domain/fluxo-estagio";
import { carregarCliente } from "@/lib/db/prisma";
import { executarTransacao } from "@/lib/db/transacoes";
import { paraDominioEstagio, podeConsultarEstagioNoBanco } from "@/lib/db/repositorios/estagios";
import { ErroDeRegra } from "./erros";
import { registrarRemocao } from "./remocao-dados-pessoais-persistentes";
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
 * Exclusão feita pelo coordenador de curso do aluno, pelo coordenador de
 * estágio ou pelo administrador do campus ocorre diretamente e fica
 * registrada apenas no log de remoções. A exclusão é definitiva: o estágio e
 * tudo que depende dele são apagados, liberando convênio e responsáveis.
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
      // O acesso de administrador e coordenador de estágio (mesmo campus) já foi conferido acima.
      if (!coordenadorDoCurso && autor.papel !== "administrador" && autor.papel !== "coordenador_estagio") throw new ErroDeRegra("Exclusão indisponível para este usuário.", "acesso_negado");
    }

    const momento = new Date();
    await apagarEstagioDefinitivo(tx, estagioId);
    await registrarRemocao(tx, modo === "cancelar" ? "estagio_cancelado" : "estagio_excluido", estagioId, momento);

    return {
      ...estagio,
      excluidoEm: momento.toISOString(),
      ...(modo === "cancelar" ? { canceladoEm: momento.toISOString() } : {}),
      nomeAlunoHistorico: aluno.nome,
    };
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

/**
 * Apaga fisicamente o estágio e os registros dependentes, na ordem exigida
 * pelas chaves estrangeiras (filhos antes dos pais).
 */
export async function apagarEstagioDefinitivo(tx: Transacao, estagioId: string) {
  const documentos = await tx.documentoPreenchido.findMany({ where: { estagioId }, select: { id: true } });
  const ids = documentos.map((documento) => documento.id);
  if (ids.length > 0) {
    const doc = { documentoId: { in: ids } };
    await tx.envioExterno.deleteMany({ where: doc });
    await tx.pedidoEnvioDocumento.deleteMany({ where: doc });
    await tx.parecer.deleteMany({ where: doc });
    await tx.observacaoDocumento.deleteMany({ where: doc });
    await tx.arquivo.deleteMany({ where: doc });
  }
  await tx.submissaoDocumento.deleteMany({
    where: { OR: [{ estagioId }, ...(ids.length > 0 ? [{ documentoId: { in: ids } }] : [])] },
  });
  if (ids.length > 0) await tx.documentoPreenchido.deleteMany({ where: { id: { in: ids } } });
  // Correções apontam para o lançamento original: desfaz o vínculo antes de apagar.
  await tx.lancamentoHoras.updateMany({ where: { estagioId, corrigeId: { not: null } }, data: { corrigeId: null } });
  await tx.lancamentoHoras.deleteMany({ where: { estagioId } });
  await tx.solicitacaoExclusaoEstagio.deleteMany({ where: { estagioId } });
  await tx.estagio.deleteMany({ where: { id: estagioId } });
}

export interface PedidoExclusaoPendente {
  id: string;
  estagioId: string;
  nomeAluno: string;
  nomeSolicitante: string;
  motivo?: string;
  criadoEm: string;
}

/** Pedidos pendentes de estágios que o usuário pode consultar (recorte por campus/curso). */
export async function listarExclusoesPendentesPersistente(usuario: Usuario): Promise<PedidoExclusaoPendente[]> {
  const { prisma } = await carregarCliente();
  const linhas = await prisma.solicitacaoExclusaoEstagio.findMany({
    where: { situacao: "pendente" },
    orderBy: { criadoEm: "asc" },
    include: { solicitante: { select: { nome: true } }, estagio: { select: { nomeAlunoHistorico: true, aluno: { select: { nome: true } } } } },
  });
  const pedidos: PedidoExclusaoPendente[] = [];
  for (const linha of linhas) {
    if (!(await podeConsultarEstagioNoBanco(prisma, usuario.id, linha.estagioId))) continue;
    pedidos.push({
      id: linha.id,
      estagioId: linha.estagioId,
      nomeAluno: linha.estagio.nomeAlunoHistorico ?? linha.estagio.aluno.nome,
      nomeSolicitante: linha.solicitante.nome,
      motivo: linha.motivo ?? undefined,
      criadoEm: linha.criadoEm.toISOString(),
    });
  }
  return pedidos;
}

/** Recusa um pedido pendente, registrando responsável e data; o estágio é preservado. */
export async function recusarExclusaoPersistente(solicitacaoId: string, autor: Usuario): Promise<void> {
  const { prisma } = await carregarCliente();
  const pedido = await prisma.solicitacaoExclusaoEstagio.findUnique({ where: { id: solicitacaoId } });
  if (!pedido || !(await podeConsultarEstagioNoBanco(prisma, autor.id, pedido.estagioId)))
    throw new ErroDeRegra("Solicitação não encontrada.", "acesso_negado");
  const efeitos = await prisma.solicitacaoExclusaoEstagio.updateMany({
    where: { id: solicitacaoId, situacao: "pendente" },
    data: { situacao: "recusado", decididoPorId: autor.id, decididoEm: new Date() },
  });
  if (efeitos.count === 0) throw new ErroDeRegra("A solicitação já foi decidida.", "solicitacao_decidida");
}
