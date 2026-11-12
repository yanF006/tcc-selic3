import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { LancamentoHoras, Pagina } from "@/lib/domain/types";
import { LIMITE_HORAS_DIA, LIMITE_HORAS_SEMANA, arredondarMeiaHora, calcularHorasDia, esquemaLancamentoHoras } from "@/lib/domain/schemas";
import { lancamentosEfetivos } from "@/lib/domain/horas";
import { estagioEncerrado, estagioLiberado } from "@/lib/domain/fluxo-estagio";
import { chaveSemana } from "@/lib/format";
import { carregarCliente } from "@/lib/db/prisma";
import { executarTransacao } from "@/lib/db/transacoes";
import { buscarEstagio } from "@/lib/db/repositorios/estagios";
import { ErroDeRegra } from "./erros";
import { novoId } from "./store";
import type { NovoLancamento } from "./lancamentos";

type LinhaLancamento = { id: string; estagioId: string; alunoId: string; data: Date; entrada: string; saida: string; almocoDesligado: boolean; minutos: number; tipo: string; corrigeId: string | null; criadoEm: Date };

export function paraDominioLancamento(linha: LinhaLancamento): LancamentoHoras {
  return {
    id: linha.id, estagioId: linha.estagioId, alunoId: linha.alunoId, data: linha.data.toISOString().slice(0, 10),
    entrada: linha.entrada, saida: linha.saida, almocoDesligado: linha.almocoDesligado, horas: linha.minutos / 60,
    tipo: linha.tipo === "correcao" ? "correcao" : "lancamento", corrigeId: linha.corrigeId ?? undefined, criadoEm: linha.criadoEm.toISOString(),
  };
}

async function linhasDoEstagio(tx: Prisma.TransactionClient, estagioId: string) {
  return tx.lancamentoHoras.findMany({ where: { estagioId }, select: { id: true, estagioId: true, alunoId: true, data: true, entrada: true, saida: true, almocoDesligado: true, minutos: true, tipo: true, corrigeId: true, criadoEm: true }, orderBy: [{ data: "asc" }, { criadoEm: "asc" }, { id: "asc" }] });
}

function horasEfetivasDoDiaEm(linhas: LinhaLancamento[], data: string, ignorarId?: string) {
  const filtradas = linhas.filter((linha) => linha.data.toISOString().slice(0, 10) === data && (ignorarId === undefined || (linha.id !== ignorarId && linha.corrigeId !== ignorarId)));
  return lancamentosEfetivos(filtradas.map(paraDominioLancamento)).reduce((total, lancamento) => total + lancamento.horas, 0);
}

function horasDaSemanaEm(linhas: LinhaLancamento[], semana: string) {
  const dias = new Set(linhas.map((linha) => linha.data.toISOString().slice(0, 10)).filter((data) => chaveSemana(data) === semana));
  return [...dias].reduce((total, data) => total + horasEfetivasDoDiaEm(linhas, data), 0);
}

function validarHoras(horas: number) {
  if (horas <= 0) throw new ErroDeRegra("O horário informado não resulta em horas.", "horas_invalidas");
  if (horas > LIMITE_HORAS_DIA) throw new ErroDeRegra(`A jornada diária não pode passar de ${LIMITE_HORAS_DIA} horas (excluído o almoço).`, "limite_diario");
}

async function estagioAtual(tx: Prisma.TransactionClient, estagioId: string) {
  await tx.$queryRaw`SELECT id FROM estagios WHERE id = ${estagioId} FOR UPDATE`;
  const estagio = await buscarEstagio(tx, estagioId);
  if (!estagio) throw new ErroDeRegra("Estágio não encontrado.", "estagio_inexistente");
  if (!estagioLiberado(estagio) || estagio.situacao !== "em_andamento" || estagioEncerrado(estagio)) throw new ErroDeRegra("Lançamentos exigem estágio liberado e em andamento.", "estagio_encerrado");
  return estagio;
}

export async function lancarHorasPersistente(dados: NovoLancamento): Promise<LancamentoHoras> {
  const { prisma } = await carregarCliente();
  if (!(await prisma.estagio.findUnique({ where: { id: dados.estagioId }, select: { id: true } }))) throw new ErroDeRegra("Estágio não encontrado.", "estagio_inexistente");
  return executarTransacao(async (tx) => {
    const estagio = await estagioAtual(tx, dados.estagioId);
    if (dados.data < estagio.dataInicio || dados.data > estagio.dataFim) throw new ErroDeRegra("Data fora do período do estágio.", "data_fora_periodo");
    const parsed = esquemaLancamentoHoras.parse(dados);
    const horas = arredondarMeiaHora(calcularHorasDia(parsed.entrada, parsed.saida, parsed.almocoDesligado));
    validarHoras(horas);
    const linhas = await linhasDoEstagio(tx, estagio.id);
    const totalDia = horasEfetivasDoDiaEm(linhas, parsed.data) + horas;
    if (totalDia > LIMITE_HORAS_DIA) throw new ErroDeRegra(`O dia soma ${totalDia} horas e ultrapassa o limite de ${LIMITE_HORAS_DIA}.`, "limite_diario");
    if (horasDaSemanaEm(linhas, chaveSemana(parsed.data)) + horas > LIMITE_HORAS_SEMANA) throw new ErroDeRegra(`A semana ultrapassa o limite de ${LIMITE_HORAS_SEMANA} horas.`, "limite_semanal");
    const linha = await tx.lancamentoHoras.create({ data: {
      id: novoId("lan"), estagioId: estagio.id, alunoId: estagio.alunoId, data: new Date(`${parsed.data}T00:00:00.000Z`),
      entrada: parsed.entrada, saida: parsed.saida, almocoDesligado: parsed.almocoDesligado, minutos: horas * 60, tipo: "lancamento",
    } });
    return paraDominioLancamento(linha);
  }, { cliente: prisma }, { isolationLevel: "Serializable" });
}

export async function corrigirLancamentoPersistente(lancamentoId: string, dados: Pick<NovoLancamento, "entrada" | "saida" | "almocoDesligado">): Promise<LancamentoHoras> {
  const { prisma } = await carregarCliente();
  const ponteiro = await prisma.lancamentoHoras.findUnique({ where: { id: lancamentoId }, select: { estagioId: true } });
  if (!ponteiro) throw new ErroDeRegra("Lançamento não encontrado.", "lancamento_inexistente");
  return executarTransacao(async (tx) => {
    const estagio = await estagioAtual(tx, ponteiro.estagioId);
    await tx.$queryRaw`SELECT id FROM lancamentos_horas WHERE id = ${lancamentoId} FOR UPDATE`;
    const original = await tx.lancamentoHoras.findUniqueOrThrow({ where: { id: lancamentoId } });
    if (original.tipo !== "lancamento") throw new ErroDeRegra("Só lançamentos originais podem ser corrigidos.", "lancamento_corrigido");
    if (original.estagioId !== estagio.id) throw new ErroDeRegra("Lançamento não pertence ao estágio.", "acesso_negado");
    const data = original.data.toISOString().slice(0, 10);
    const parsed = esquemaLancamentoHoras.parse({ estagioId: original.estagioId, data, entrada: dados.entrada, saida: dados.saida, almocoDesligado: dados.almocoDesligado });
    const horas = arredondarMeiaHora(calcularHorasDia(parsed.entrada, parsed.saida, parsed.almocoDesligado));
    validarHoras(horas);
    const linhas = await linhasDoEstagio(tx, estagio.id);
    const totalDia = horasEfetivasDoDiaEm(linhas, data, original.id) + horas;
    if (totalDia > LIMITE_HORAS_DIA) throw new ErroDeRegra(`O dia soma ${totalDia} horas e ultrapassa o limite de ${LIMITE_HORAS_DIA}.`, "limite_diario");
    const efetivo = lancamentosEfetivos(linhas.map(paraDominioLancamento)).find((lancamento) => lancamento.id === original.id);
    const semana = horasDaSemanaEm(linhas, chaveSemana(data)) - (efetivo?.horas ?? 0) + horas;
    if (semana > LIMITE_HORAS_SEMANA) throw new ErroDeRegra(`A semana ultrapassa o limite de ${LIMITE_HORAS_SEMANA} horas.`, "limite_semanal");
    const ultima = await tx.lancamentoHoras.findFirst({ where: { corrigeId: original.id }, orderBy: { sequenciaCorrecao: "desc" }, select: { sequenciaCorrecao: true } });
    const linha = await tx.lancamentoHoras.create({ data: {
      id: novoId("lan"), estagioId: original.estagioId, alunoId: original.alunoId, data: original.data,
      entrada: parsed.entrada, saida: parsed.saida, almocoDesligado: parsed.almocoDesligado, minutos: horas * 60,
      tipo: "correcao", corrigeId: original.id, sequenciaCorrecao: (ultima?.sequenciaCorrecao ?? 0) + 1,
    } });
    return paraDominioLancamento(linha);
  }, { cliente: prisma }, { isolationLevel: "Serializable" });
}

export async function lancamentosDoEstagioPersistente(estagioId: string): Promise<LancamentoHoras[]> {
  const { prisma } = await carregarCliente();
  const linhas = await prisma.lancamentoHoras.findMany({ where: { estagioId }, orderBy: [{ data: "asc" }, { criadoEm: "asc" }, { id: "asc" }] });
  return linhas.map(paraDominioLancamento);
}

export async function horasEfetivasDoDiaPersistente(estagioId: string, data: string, ignorarId?: string): Promise<number> {
  const linhas = (await lancamentosDoEstagioPersistente(estagioId)).map((lancamento) => ({
    id: lancamento.id, estagioId: lancamento.estagioId, alunoId: lancamento.alunoId, data: new Date(`${lancamento.data}T00:00:00.000Z`),
    entrada: lancamento.entrada, saida: lancamento.saida, almocoDesligado: lancamento.almocoDesligado, minutos: lancamento.horas * 60, tipo: lancamento.tipo, corrigeId: lancamento.corrigeId ?? null, criadoEm: new Date(lancamento.criadoEm),
  }));
  return horasEfetivasDoDiaEm(linhas, data, ignorarId);
}

export async function horasDaSemanaPersistente(estagioId: string, semana: string): Promise<number> {
  const linhas = (await lancamentosDoEstagioPersistente(estagioId)).map((lancamento) => ({
    id: lancamento.id, estagioId: lancamento.estagioId, alunoId: lancamento.alunoId, data: new Date(`${lancamento.data}T00:00:00.000Z`),
    entrada: lancamento.entrada, saida: lancamento.saida, almocoDesligado: lancamento.almocoDesligado, minutos: lancamento.horas * 60, tipo: lancamento.tipo, corrigeId: lancamento.corrigeId ?? null, criadoEm: new Date(lancamento.criadoEm),
  }));
  return horasDaSemanaEm(linhas, semana);
}

export async function lancamentoPorIdPersistente(id: string): Promise<LancamentoHoras | null> {
  const { prisma } = await carregarCliente();
  const linha = await prisma.lancamentoHoras.findUnique({ where: { id } });
  return linha ? paraDominioLancamento(linha) : null;
}

export async function listarLancamentosPersistentes(estagioId: string, consulta: { data?: string; busca?: string; tamanho?: number; pagina?: number } = {}): Promise<Pagina<LancamentoHoras>> {
  const { prisma } = await carregarCliente();
  const termo = consulta.busca?.trim();
  const where = { estagioId, ...(consulta.data ? { data: new Date(`${consulta.data}T00:00:00.000Z`) } : {}), ...(termo ? { OR: [{ entrada: { contains: termo } }, { saida: { contains: termo } }] } : {}) };
  const total = await prisma.lancamentoHoras.count({ where });
  const tamanho = Math.max(1, consulta.tamanho ?? 10);
  const pagina = Math.min(Math.max(1, consulta.pagina ?? 1), Math.max(1, Math.ceil(total / tamanho)));
  const linhas = await prisma.lancamentoHoras.findMany({ where, orderBy: [{ data: "asc" }, { criadoEm: "asc" }, { id: "asc" }], take: tamanho, skip: (pagina - 1) * tamanho });
  return { itens: linhas.map(paraDominioLancamento), total, pagina, tamanhoPagina: tamanho };
}
