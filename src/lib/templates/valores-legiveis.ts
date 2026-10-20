import type { ColunaGrade, DescriptorDocumento } from "@/lib/templates/descriptors";
import { MASCARAS } from "@/lib/mask";

/**
 * Normalização dos valores de preenchimento para leitura e impressão (8.13).
 *
 * O mesmo descritor que desenha o formulário (D5) descreve os trechos fixos e as
 * instruções do template, mas o formulário não os exibe como valores. A folha de
 * impressão precisa deles no lugar, na ordem do documento, então esta função
 * transforma `valores` em um texto legível por campo — sem conhecer nenhum
 * documento específico.
 */

const VAZIO = "—";
const SEPARADOR_LISTA = " · ";

function ehVazio(valor: unknown): boolean {
  return valor === undefined || valor === null || String(valor).trim() === "";
}

function formatarColuna(coluna: ColunaGrade, linha: Record<string, unknown>): string {
  const bruto = linha[coluna.chave];

  if (ehVazio(bruto)) return "";

  if (coluna.mascara && typeof bruto === "string") {
    return MASCARAS[coluna.mascara]?.(bruto) ?? bruto;
  }

  return String(bruto);
}

/** Uma linha de grade vira um texto único, com as colunas separadas por ` · `. */
function formatarLinha(colunas: ColunaGrade[], linha: Record<string, unknown>): string {
  return colunas
    .map((coluna) => formatarColuna(coluna, linha))
    .filter((parte) => parte !== "")
    .join(SEPARADOR_LISTA);
}

function formatarValor(colunas: ColunaGrade[] | undefined, valor: unknown): string {
  if (ehVazio(valor)) return "";

  if (Array.isArray(valor)) {
    const partes = valor
      .filter((linha): linha is Record<string, unknown> => Boolean(linha) && typeof linha === "object")
      .map((linha) => formatarLinha(colunas ?? [], linha))
      .filter((parte) => parte !== "");

    return partes.join(" ; ");
  }

  return String(valor);
}

/**
 * Valores prontos para leitura, na ordem do descritor. Trechos `fixo` recebem o
 * próprio texto e instruções de preenchimento saem vazias (não são valores).
 */
export function valoresLegiveis(
  descriptor: DescriptorDocumento,
  valores: Record<string, unknown>,
): Record<string, string> {
  const legiveis: Record<string, string> = {};

  for (const campo of [...(descriptor.auto ?? []), ...descriptor.secoes.flatMap((s) => s.campos)]) {
    if (campo.tipo === "instrucao") {
      legiveis[campo.id] = "";
      continue;
    }

    if (campo.tipo === "fixo") {
      legiveis[campo.id] = campo.ajuda ?? campo.rotulo;
      continue;
    }

    legiveis[campo.id] = formatarValor(campo.colunas, valores[campo.id]) || VAZIO;
  }

  return legiveis;
}
