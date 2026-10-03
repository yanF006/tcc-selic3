import type { Pagina } from "@/lib/domain/types";

/** Paginação usada pelas listagens dos serviços (3.3). */

export interface OpcoesPaginacao {
  pagina?: number;
  tamanho?: number;
}

export const TAMANHO_PADRAO = 10;

export function paginar<T>(itens: T[], opcoes: OpcoesPaginacao = {}): Pagina<T> {
  const tamanho = opcoes.tamanho ?? TAMANHO_PADRAO;
  const total = itens.length;
  const paginas = Math.max(1, Math.ceil(total / tamanho));
  const pagina = Math.min(Math.max(1, opcoes.pagina ?? 1), paginas);
  const inicio = (pagina - 1) * tamanho;

  return {
    itens: itens.slice(inicio, inicio + tamanho),
    total,
    pagina,
    tamanhoPagina: tamanho,
  };
}

export function filtrarPorTexto<T>(itens: T[], termo: string, campos: (item: T) => string[]): T[] {
  const alvo = termo.trim().toLowerCase();

  if (!alvo) return itens;

  return itens.filter((item) => campos(item).some((campo) => campo.toLowerCase().includes(alvo)));
}
