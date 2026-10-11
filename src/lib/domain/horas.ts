import type { LancamentoHoras } from "./types";

/** Cada original contribui uma vez: a última correção substitui só o seu original. */
export function lancamentosEfetivos(lancamentos: LancamentoHoras[]): LancamentoHoras[] {
  const correcoes = new Map<string, LancamentoHoras>();

  for (const lancamento of [...lancamentos].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))) {
    if (lancamento.tipo === "correcao" && lancamento.corrigeId) {
      correcoes.set(lancamento.corrigeId, lancamento);
    }
  }

  return lancamentos
    .filter((lancamento) => lancamento.tipo === "lancamento")
    .map((original) => correcoes.get(original.id) ?? original);
}
