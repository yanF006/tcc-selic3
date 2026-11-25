import type { FiltrosEstatisticas, FiltroSituacaoEstatistica } from "@/lib/services/estatisticas";

/**
 * Leitura dos filtros de estatísticas a partir da URL. Compartilhada pela tela
 * de estatísticas e pelo relatório em PDF, para que ambos usem o mesmo recorte.
 */
export type ParametrosBusca = Record<string, string | string[] | undefined>;

export function umParam(valor: string | string[] | undefined): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor.trim() : undefined;
}

function situacaoValida(valor: string | undefined): FiltroSituacaoEstatistica {
  return valor === "em_preparacao" || valor === "em_andamento" || valor === "concluido"
    ? valor
    : "todas";
}

export function filtrosDosParametros(parametros: ParametrosBusca): FiltrosEstatisticas {
  const ano = Number(umParam(parametros.ano)) || undefined;
  const semestreBruto = Number(umParam(parametros.semestre));
  const semestre = semestreBruto === 1 || semestreBruto === 2 ? semestreBruto : undefined;

  return {
    aluno: umParam(parametros.aluno),
    orientador: umParam(parametros.orientador),
    supervisor: umParam(parametros.supervisor),
    instituicao: umParam(parametros.instituicao),
    cursoId: umParam(parametros.cursoId),
    turmaId: umParam(parametros.turmaId),
    situacao: situacaoValida(umParam(parametros.situacao)),
    ano,
    semestre,
  };
}

export function queryString(
  filtros: FiltrosEstatisticas,
  extras: Record<string, string> = {},
): string {
  const parametros = new URLSearchParams();

  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === "" || valor === "todas") continue;
    parametros.set(chave, String(valor));
  }
  for (const [chave, valor] of Object.entries(extras)) parametros.set(chave, valor);

  const texto = parametros.toString();

  return texto ? `?${texto}` : "";
}
