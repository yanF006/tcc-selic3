import {
  LIMITE_HORAS_DIA,
  LIMITE_HORAS_SEMANA,
  arredondarMeiaHora,
  calcularHorasDia,
  esquemaLancamentoHoras,
} from "@/lib/domain/schemas";
import type { LancamentoHoras, Pagina } from "@/lib/domain/types";
import { lancamentosEfetivos } from "@/lib/domain/horas";
import { chaveSemana } from "@/lib/format";

import { filtrarPorTexto, paginar } from "./paginacao";
import type { OpcoesPaginacao } from "./paginacao";
import { ErroDeRegra } from "./erros";
import { estagioPorId, lancamentosDoEstagio } from "./estagios";
import { agora, obterEstado, novoId } from "./store";

/**
 * Lançamento de horas (D3): correção preserva o histórico, jornada de 6 h por
 * dia excluído o almoço e teto de 30 h por semana.
 */

export interface NovoLancamento {
  estagioId: string;
  data: string;
  entrada: string;
  saida: string;
  almocoDesligado: boolean;
}

export interface ResumoSemana {
  semana: string;
  horas: number;
  limite: number;
  excedeu: boolean;
}

/** Consulta um lançamento efetivo do dia; o total dos vários registros vem de horasEfetivasDoDia. */
export async function lancamentoEfetivoDoDia(
  estagioId: string,
  data: string,
): Promise<LancamentoHoras | null> {
  return (
    lancamentosEfetivos(
      lancamentosDoEstagio(estagioId).filter((lancamento) => lancamento.data === data),
    ).at(-1) ?? null
  );
}

/**
 * Soma dos lançamentos do dia, substituindo cada original por sua última correção.
 * `ignorarId` remove toda a contribuição de um original e suas correções durante
 * a validação de uma nova correção.
 */
export async function horasEfetivasDoDia(
  estagioId: string,
  data: string,
  ignorarId?: string,
): Promise<number> {
  const lancamentos = lancamentosDoEstagio(estagioId).filter(
    (lancamento) =>
      lancamento.data === data &&
      (ignorarId === undefined ||
        (lancamento.id !== ignorarId && lancamento.corrigeId !== ignorarId)),
  );
  return lancamentosEfetivos(lancamentos).reduce(
    (total, lancamento) => total + lancamento.horas,
    0,
  );
}

export async function horasDaSemana(estagioId: string, semana: string): Promise<number> {
  const dias = new Set(
    lancamentosDoEstagio(estagioId)
      .filter((lancamento) => chaveSemana(lancamento.data) === semana)
      .map((lancamento) => lancamento.data),
  );

  const horas = await Promise.all([...dias].map((data) => horasEfetivasDoDia(estagioId, data)));

  return horas.reduce((total, valor) => total + valor, 0);
}

export async function resumoDaSemana(estagioId: string, data: string): Promise<ResumoSemana> {
  const semana = chaveSemana(data);
  const horas = await horasDaSemana(estagioId, semana);

  return { semana, horas, limite: LIMITE_HORAS_SEMANA, excedeu: horas > LIMITE_HORAS_SEMANA };
}

export async function lancarHoras(dados: NovoLancamento): Promise<LancamentoHoras> {
  const estagio = await estagioPorId(dados.estagioId);

  if (!estagio) throw new ErroDeRegra("Estágio não encontrado.", "estagio_inexistente");

  if (estagio.situacao !== "em_andamento") {
    throw new ErroDeRegra(
      "Lançamentos só são aceitos em estágio em andamento.",
      "estagio_encerrado",
    );
  }

  if (dados.data < estagio.dataInicio || dados.data > estagio.dataFim) {
    throw new ErroDeRegra("Data fora do período do estágio.", "data_fora_periodo");
  }

  const parsed = esquemaLancamentoHoras.parse(dados);

  const horas = arredondarMeiaHora(
    calcularHorasDia(parsed.entrada, parsed.saida, parsed.almocoDesligado),
  );

  if (horas <= 0) {
    throw new ErroDeRegra("O horário informado não resulta em horas.", "horas_invalidas");
  }

  if (horas > LIMITE_HORAS_DIA) {
    throw new ErroDeRegra(
      `A jornada diária não pode passar de ${LIMITE_HORAS_DIA} horas (excluído o almoço).`,
      "limite_diario",
    );
  }

  const totalDia = (await horasEfetivasDoDia(estagio.id, parsed.data)) + horas;

  if (totalDia > LIMITE_HORAS_DIA) {
    throw new ErroDeRegra(
      `O dia soma ${totalDia} horas e ultrapassa o limite de ${LIMITE_HORAS_DIA}.`,
      "limite_diario",
    );
  }

  const semana = await resumoDaSemana(estagio.id, parsed.data);

  if (semana.horas + horas > LIMITE_HORAS_SEMANA) {
    throw new ErroDeRegra(
      `A semana ultrapassa o limite de ${LIMITE_HORAS_SEMANA} horas.`,
      "limite_semanal",
    );
  }

  const lancamento: LancamentoHoras = {
    id: novoId("lan"),
    estagioId: estagio.id,
    alunoId: estagio.alunoId,
    data: parsed.data,
    entrada: parsed.entrada,
    saida: parsed.saida,
    almocoDesligado: parsed.almocoDesligado,
    horas,
    tipo: "lancamento",
    criadoEm: agora(),
  };

  obterEstado().lancamentos.push(lancamento);

  return lancamento;
}

/**
 * Correção: mantém o lançamento original e grava um novo do tipo `correcao`
 * apontando para ele, conforme a regra de não apagar histórico.
 */
export async function corrigirLancamento(
  lancamentoId: string,
  dados: Pick<NovoLancamento, "entrada" | "saida" | "almocoDesligado">,
): Promise<LancamentoHoras> {
  const original = obterEstado().lancamentos.find((lancamento) => lancamento.id === lancamentoId);

  if (!original) throw new ErroDeRegra("Lançamento não encontrado.", "lancamento_inexistente");

  if (original.tipo !== "lancamento") {
    throw new ErroDeRegra("Só lançamentos originais podem ser corrigidos.", "lancamento_corrigido");
  }

  const estagio = await estagioPorId(original.estagioId);

  if (!estagio || estagio.situacao !== "em_andamento") {
    throw new ErroDeRegra(
      "Lançamentos só são aceitos em estágio em andamento.",
      "estagio_encerrado",
    );
  }

  const parsed = esquemaLancamentoHoras.parse({
    estagioId: original.estagioId,
    data: original.data,
    entrada: dados.entrada,
    saida: dados.saida,
    almocoDesligado: dados.almocoDesligado,
  });

  const horas = arredondarMeiaHora(
    calcularHorasDia(parsed.entrada, parsed.saida, parsed.almocoDesligado),
  );

  if (horas <= 0) {
    throw new ErroDeRegra("O horário informado não resulta em horas.", "horas_invalidas");
  }

  if (horas > LIMITE_HORAS_DIA) {
    throw new ErroDeRegra(
      `A jornada diária não pode passar de ${LIMITE_HORAS_DIA} horas (excluído o almoço).`,
      "limite_diario",
    );
  }

  const totalDia = (await horasEfetivasDoDia(estagio.id, original.data, original.id)) + horas;

  if (totalDia > LIMITE_HORAS_DIA) {
    throw new ErroDeRegra(
      `O dia soma ${totalDia} horas e ultrapassa o limite de ${LIMITE_HORAS_DIA}.`,
      "limite_diario",
    );
  }

  const semana = await resumoDaSemana(estagio.id, original.data);
  const efetivo = lancamentosEfetivos(lancamentosDoEstagio(estagio.id)).find(
    (lancamento) => lancamento.id === original.id || lancamento.corrigeId === original.id,
  );
  if (semana.horas - (efetivo?.horas ?? 0) + horas > LIMITE_HORAS_SEMANA) {
    throw new ErroDeRegra(
      `A semana ultrapassa o limite de ${LIMITE_HORAS_SEMANA} horas. Total atual: ${semana.horas} horas.`,
      "limite_semanal",
    );
  }

  const correcao: LancamentoHoras = {
    id: novoId("lan"),
    estagioId: original.estagioId,
    alunoId: original.alunoId,
    data: original.data,
    entrada: parsed.entrada,
    saida: parsed.saida,
    almocoDesligado: parsed.almocoDesligado,
    horas,
    tipo: "correcao",
    corrigeId: original.id,
    criadoEm: agora(),
  };

  obterEstado().lancamentos.push(correcao);

  return correcao;
}

/** Valor exibido na ficha: último valor registrado para o dia. */
export function horasExibidas(estagioId: string, data: string): Promise<number> {
  return horasEfetivasDoDia(estagioId, data);
}

export function historicoDoDia(estagioId: string, data: string): LancamentoHoras[] {
  return lancamentosDoEstagio(estagioId).filter((lancamento) => lancamento.data === data);
}

export interface ConsultaLancamentos extends OpcoesPaginacao {
  data?: string;
  busca?: string;
}

export async function lancamentoPorId(id: string): Promise<LancamentoHoras | null> {
  return obterEstado().lancamentos.find((lancamento) => lancamento.id === id) ?? null;
}

export async function listarLancamentos(
  estagioId: string,
  consulta: ConsultaLancamentos = {},
): Promise<Pagina<LancamentoHoras>> {
  const filtrados = lancamentosDoEstagio(estagioId).filter(
    (lancamento) => !consulta.data || lancamento.data === consulta.data,
  );

  return paginar(
    filtrarPorTexto(filtrados, consulta.busca ?? "", (lancamento) => [
      lancamento.data,
      lancamento.entrada,
      lancamento.saida,
    ]),
    consulta,
  );
}
