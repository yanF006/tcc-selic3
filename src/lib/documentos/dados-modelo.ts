import { MASCARAS } from "@/lib/mask";
import {
  camposDoTemplate,
  type CampoDescriptor,
  type ColunaGrade,
  type DescriptorDocumento,
} from "@/lib/templates/descriptors";

/**
 * Valores do documento no formato dos modelos marcados do docxtemplater
 * (`modelos/<templateId>.docx`, gerados por `scripts/modelos-docx`).
 *
 * - Texto, número e data: `{campo}` já formatado; vazio vira uma linha para
 *   preenchimento à mão, como no Kit.
 * - Rádio: `{campo__opcao}` é "X" na opção marcada e espaço nas demais.
 * - Checkbox: `{campo}` é "X" ou espaço.
 * - Data: também `{campo_dia}`, `{campo_mes}` (por extenso) e `{campo_ano}`.
 * - Grade: `{campo_N_coluna}` por linha (N a partir de 1) e `{campo_total}`.
 * - Assinatura, instrução e arquivo não geram valor: o espaço fica em branco.
 */

export const LINHA_EM_BRANCO = "_______________";

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const SEM_VALOR = new Set(["instrucao", "assinatura", "arquivo", "fixo"]);

function vazio(valor: unknown): boolean {
  return valor === undefined || valor === null || String(valor).trim() === "";
}

/** Aceita "2026-03-02", "2026-03-02T10:00:00-03:00", "02/03/2026" ou "02032026". */
export function formatarData(valor: unknown): string {
  if (vazio(valor)) return "";
  const texto = String(valor).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);

  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  if (/^\d{8}$/.test(texto)) return MASCARAS.data(texto);

  return texto;
}

function formatarNumero(valor: unknown): string {
  if (vazio(valor)) return "";
  const numero = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));

  return Number.isFinite(numero) ? numero.toLocaleString("pt-BR") : String(valor);
}

function formatarTexto(campo: Pick<CampoDescriptor, "tipo" | "mascara">, valor: unknown): string {
  if (vazio(valor)) return "";
  if (campo.tipo === "data") return formatarData(valor);
  if (campo.tipo === "numero" && !campo.mascara) return formatarNumero(valor);
  if (campo.mascara === "data") return formatarData(valor);
  if (campo.mascara) return MASCARAS[campo.mascara](String(valor));

  return String(valor).trim();
}

function formatarColuna(coluna: ColunaGrade, valor: unknown): string {
  if (vazio(valor)) return "";
  if (coluna.tipo === "data") return formatarData(valor);
  if (coluna.mascara) return MASCARAS[coluna.mascara](String(valor));
  if (coluna.tipo === "numero") return formatarNumero(valor);

  return String(valor).trim();
}

function partesDaData(id: string, data: string, dados: Record<string, string>) {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data);

  dados[`${id}_dia`] = partes ? partes[1] : LINHA_EM_BRANCO;
  dados[`${id}_mes`] = partes ? (MESES[Number(partes[2]) - 1] ?? partes[2]) : LINHA_EM_BRANCO;
  dados[`${id}_ano`] = partes ? partes[3] : LINHA_EM_BRANCO;
}

function dadosDaGrade(campo: CampoDescriptor, valor: unknown, dados: Record<string, string>) {
  const linhas = Array.isArray(valor)
    ? valor.filter(
        (linha): linha is Record<string, unknown> => Boolean(linha) && typeof linha === "object",
      )
    : [];
  const colunas = campo.colunas ?? [];
  const numerica = colunas.find((coluna) => coluna.tipo === "numero");
  let total = 0;

  linhas.forEach((linha, indice) => {
    for (const coluna of colunas) {
      dados[`${campo.id}_${indice + 1}_${coluna.chave}`] = formatarColuna(
        coluna,
        linha[coluna.chave],
      );
    }

    const parcela = numerica ? Number(linha[numerica.chave]) : NaN;
    if (Number.isFinite(parcela)) total += parcela;
  });

  dados[`${campo.id}_total`] = numerica && linhas.length > 0 ? formatarNumero(total) : "";
  dados[campo.id] = linhas
    .map((linha) =>
      colunas
        .map((coluna) => formatarColuna(coluna, linha[coluna.chave]))
        .filter(Boolean)
        .join(" · "),
    )
    .join("\n");
}

export function dadosDoModelo(
  descriptor: DescriptorDocumento,
  valores: Record<string, unknown>,
): Record<string, string> {
  const dados: Record<string, string> = {};

  for (const campo of camposDoTemplate(descriptor.templateId, descriptor)) {
    const valor = valores[campo.id];

    if (SEM_VALOR.has(campo.tipo)) continue;

    if (campo.tipo === "radio" || campo.tipo === "select") {
      const selecionada = campo.opcoes?.find((opcao) => opcao.valor === valor);
      dados[campo.id] = selecionada?.rotulo ?? (vazio(valor) ? LINHA_EM_BRANCO : String(valor));
      for (const opcao of campo.opcoes ?? []) {
        dados[`${campo.id}__${opcao.valor}`] = opcao.valor === valor ? "X" : " ";
      }
      continue;
    }

    if (campo.tipo === "checkbox") {
      dados[campo.id] = valor === true || valor === "true" ? "X" : " ";
      continue;
    }

    if (campo.tipo === "grade") {
      dadosDaGrade(campo, valor, dados);
      continue;
    }

    const texto = formatarTexto(campo, valor);
    dados[campo.id] = texto || LINHA_EM_BRANCO;

    if (campo.tipo === "data" || campo.mascara === "data") partesDaData(campo.id, texto, dados);
  }

  return dados;
}
