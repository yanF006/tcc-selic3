import "server-only";

import { gerarDocx, TIPO_CONTEUDO_DOCX } from "@/lib/documentos/gerar-docx";
import { MENSAGEM_SOMENTE_DOCX, temModelo } from "@/lib/documentos/modelos-disponiveis";
import type { DocumentoPreenchido } from "@/lib/domain/types";
import { descritorDoDocumento, validarValores } from "@/lib/services/documentos";

export type { FormatoDocumento } from "@/lib/documentos/modelos-disponiveis";

/**
 * Monta o DOCX oficial do documento preenchido (8.14, 8.15; change
 * gerar-documentos-preenchidos). A validação roda antes da geração: um campo
 * obrigatório pendente recusa o download com a lista de pendências. Só há
 * DOCX; um pedido de outro formato é recusado.
 */

export interface ResultadoBaixarDocumento {
  ok: boolean;
  erro?: string;
  problemas?: { campo: string; mensagem: string }[];
  bytes?: Uint8Array;
  nomeArquivo?: string;
  tipoConteudo?: string;
}

/** Nome em ASCII: acentos no atributo `download` fazem o navegador ignorar o nome. */
function nomeDoArquivo(titulo: string): string {
  return titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\-. ]+/g, "")
    .trim();
}

export function arquivoDoDocumento(
  documento: DocumentoPreenchido,
  templateId: string,
  formato: string,
): ResultadoBaixarDocumento {
  if (formato !== "docx") {
    return { ok: false, erro: MENSAGEM_SOMENTE_DOCX };
  }

  const descriptor = descritorDoDocumento(documento);

  if (!descriptor) {
    return { ok: false, erro: "Documento não encontrado." };
  }

  if (!temModelo(templateId)) {
    return { ok: false, erro: "Este documento não tem arquivo para download." };
  }

  const problemas = validarValores(
    templateId,
    documento.valores,
    documento.versaoTemplate,
    descriptor,
  );

  if (problemas.length > 0) {
    return { ok: false, erro: "Há campos obrigatórios pendentes.", problemas };
  }

  return {
    ok: true,
    bytes: gerarDocx({ ...descriptor, templateId }, documento.valores),
    nomeArquivo: `${nomeDoArquivo(descriptor.titulo)}.docx`,
    tipoConteudo: TIPO_CONTEUDO_DOCX,
  };
}
