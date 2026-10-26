import {
  TIPO_CONTEUDO,
  gerarDocxDemo,
  gerarPdfDemo,
  type FormatoDocumento,
} from "@/lib/documentos/gerar-demo";
import type { DocumentoPreenchido } from "@/lib/domain/types";
import { descritorDoDocumento, validarValores } from "@/lib/services/documentos";
import { camposDoTemplate, classificacaoDoCampo } from "@/lib/templates/descriptors";

export type { FormatoDocumento } from "@/lib/documentos/gerar-demo";

/**
 * Monta o arquivo do documento preenchido (8.14, 8.15). A validação roda antes
 * da geração: um campo obrigatório pendente recusa o download com a lista de
 * pendências. Nesta entrega o arquivo é a demonstração de `gerar-demo.ts` (D6).
 */

export interface ResultadoBaixarDocumento {
  ok: boolean;
  erro?: string;
  problemas?: { campo: string; mensagem: string }[];
  bytes?: Uint8Array;
  nomeArquivo?: string;
  tipoConteudo?: string;
}

export function arquivoDoDocumento(
  documento: DocumentoPreenchido,
  templateId: string,
  formato: FormatoDocumento,
): ResultadoBaixarDocumento {
  const descriptor = descritorDoDocumento(documento);

  if (!descriptor) {
    return { ok: false, erro: "Documento não encontrado." };
  }

  const problemas = validarValores(templateId, documento.valores, documento.versaoTemplate);

  if (problemas.length > 0) {
    return { ok: false, erro: "Há campos obrigatórios pendentes.", problemas };
  }

  const linhas = camposDoTemplate(templateId, descriptor)
    .filter((campo) => classificacaoDoCampo(campo) !== "instrucao")
    .map((campo) => {
      if (campo.tipo === "fixo") return `${campo.rotulo}: ${campo.ajuda ?? campo.rotulo}`;
      const valor = documento.valores[campo.id];

      if (valor === undefined || valor === null || String(valor).trim() === "") return null;

      const exibido = Array.isArray(valor)
        ? valor
            .map((linha) =>
              Object.values(linha as Record<string, unknown>)
                .filter(Boolean)
                .join(" | "),
            )
            .join(" ; ")
        : String(valor);

      return `${campo.rotulo}: ${exibido}`;
    })
    .filter((linha): linha is string => linha !== null);

  const bytes =
    formato === "pdf"
      ? gerarPdfDemo(descriptor.titulo, linhas)
      : gerarDocxDemo(descriptor.titulo, linhas);

  return {
    ok: true,
    bytes,
    nomeArquivo: `${descriptor.titulo.replace(/[^\w\-. ]+/g, "").trim()}.${formato}`,
    tipoConteudo: TIPO_CONTEUDO[formato],
  };
}
