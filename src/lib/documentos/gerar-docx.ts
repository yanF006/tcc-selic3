import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

import { dadosDoModelo } from "@/lib/documentos/dados-modelo";
import type { DescriptorDocumento } from "@/lib/templates/descriptors";

/**
 * Geração do DOCX oficial preenchido (change gerar-documentos-preenchidos).
 * Os modelos são cópias marcadas dos arquivos do Kit, versionadas em
 * `src/lib/documentos/modelos` e geradas por `scripts/modelos-docx`.
 */

export const TIPO_CONTEUDO_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export { TEMPLATES_COM_MODELO, temModelo } from "@/lib/documentos/modelos-disponiveis";

export function caminhoDoModelo(templateId: string): string {
  return path.join(process.cwd(), "src", "lib", "documentos", "modelos", `${templateId}.docx`);
}

/** Abre o modelo no docxtemplater; lança o erro do docxtemplater se o modelo estiver malformado. */
export function abrirModelo(templateId: string): Docxtemplater {
  const zip = new PizZip(readFileSync(caminhoDoModelo(templateId)));

  return new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
}

export function gerarDocx(
  descriptor: DescriptorDocumento,
  valores: Record<string, unknown>,
): Buffer {
  const documento = abrirModelo(descriptor.templateId);

  documento.render(dadosDoModelo(descriptor, valores));

  return documento.toBuffer({ compression: "DEFLATE" });
}
