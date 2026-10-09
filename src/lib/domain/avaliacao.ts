/**
 * Escalas de avaliação dos documentos (8.17): a Ficha de Frequência e Avaliação
 * classifica cada nota de 0,0 a 10,0 nas faixas E, B, R e I, e o Relatório
 * Semestral usa a escala qualitativa ótimo, bom, regular e insuficiente.
 */

export type FaixaAvaliacao = "E" | "B" | "R" | "I";

export interface Faixa {
  faixa: FaixaAvaliacao;
  rotulo: string;
  /** Menor nota da faixa, inclusive. */
  de: number;
  /** Maior nota da faixa, inclusive. */
  ate: number;
}

export const FAIXAS_AVALIACAO: Faixa[] = [
  { faixa: "E", rotulo: "Excelente", de: 9, ate: 10 },
  { faixa: "B", rotulo: "Bom", de: 7, ate: 8.9 },
  { faixa: "R", rotulo: "Regular", de: 5, ate: 6.9 },
  { faixa: "I", rotulo: "Insuficiente", de: 0, ate: 4.9 },
];

export const NIVEL_AUTOAVALIACAO = ["otimo", "bom", "regular", "insuficiente"] as const;

/** Faixa da nota de 0,0 a 10,0, conforme o Regulamento de Estágio. */
export function faixaDeNota(nota: number): FaixaAvaliacao {
  if (nota >= 9) return "E";
  if (nota >= 7) return "B";
  if (nota >= 5) return "R";

  return "I";
}

export function faixaDaNota(nota: number): Faixa {
  const faixa = faixaDeNota(nota);
  const detalhe = FAIXAS_AVALIACAO.find((item) => item.faixa === faixa);

  return (
    detalhe ?? { faixa, rotulo: "Insuficiente", de: 0, ate: 0 }
  );
}

/** Conceito global: média dos critérios com uma casa decimal, como a ficha. */
export function conceitoGlobalDasNotas(notas: number[]): number {
  if (notas.length === 0) return 0;

  const media = notas.reduce((soma, nota) => soma + nota, 0) / notas.length;

  return Math.round(media * 10) / 10;
}