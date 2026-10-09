"use server";

import { revalidatePath } from "next/cache";

import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import { arquivoDoDocumento, type FormatoDocumento } from "@/lib/documentos/baixar-documento";
import {
  documentoPorId,
  podePreencher,
  salvarRascunho,
  templatePorId,
  validarValores,
  type ProblemaValidacao,
} from "@/lib/services/documentos";
import { ErroDeRegra } from "@/lib/services/erros";

export interface ResultadoDocumento {
  ok: boolean;
  erro?: string;
  problemas?: ProblemaValidacao[];
}

/**
 * Salva o preenchimento de um documento (8.9, 8.16). A validação roda no
 * servidor com o mesmo descritor usado para desenhar o formulário, de modo que
 * obrigatoriedade e limite de palavras não dependem do navegador.
 */
export async function salvarDocumentoAction(
  documentoId: string,
  valores: Record<string, unknown>,
): Promise<ResultadoDocumento> {
  try {
    const usuario = await usuarioDaRequisicaoObrigatorio();
    const documento = await documentoPorId(documentoId);

    if (!documento) return { ok: false, erro: "Documento não encontrado." };

    const template = await templatePorId(documento.templateId);

    if (!template || !podePreencher(usuario, template)) {
      return { ok: false, erro: "O preenchimento deste documento cabe a outro perfil." };
    }

    if (documento.situacao !== "rascunho") {
      return { ok: false, erro: "Somente rascunhos podem ser editados." };
    }

    const problemas = validarValores(documento.templateId, valores);

    if (problemas.length > 0) {
      return { ok: false, erro: problemas[0].mensagem, problemas };
    }

    await salvarRascunho(documentoId, valores);
    revalidatePath(`/documentos/${documento.templateId}`);

    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroDeRegra) {
      return { ok: false, erro: erro.message };
    }

    return { ok: false, erro: "Não foi possível salvar o documento." };
  }
}

export interface ResultadoBaixarAction {
  ok: boolean;
  erro?: string;
  problemas?: ProblemaValidacao[];
  base64?: string;
  nomeArquivo?: string;
  tipoConteudo?: string;
}

/**
 * Gera o arquivo do documento preenchido (8.14, 8.15). Roda como server action
 * para compartilhar o estado em memória com a página (a rota de download serve
 * o mesmo conteúdo para chamadas por URL).
 */
export async function baixarDocumentoAction(
  documentoId: string,
  templateId: string,
  formato: FormatoDocumento,
): Promise<ResultadoBaixarAction> {
  try {
    const usuario = await usuarioDaRequisicaoObrigatorio();
    const documento = await documentoPorId(documentoId);

    if (!documento || documento.templateId !== templateId) {
      return { ok: false, erro: "Documento não encontrado." };
    }

    const template = await templatePorId(templateId);

    if (!template || (documento.alunoId !== usuario.id && !podePreencher(usuario, template))) {
      return { ok: false, erro: "Você não pode baixar este documento." };
    }

    const resultado = arquivoDoDocumento(documento, templateId, formato);

    if (!resultado.ok) {
      return { ok: false, erro: resultado.erro, problemas: resultado.problemas };
    }

    return {
      ok: true,
      base64: Buffer.from(resultado.bytes as Uint8Array).toString("base64"),
      nomeArquivo: resultado.nomeArquivo,
      tipoConteudo: resultado.tipoConteudo,
    };
  } catch (erro) {
    if (erro instanceof ErroDeRegra) {
      return { ok: false, erro: erro.message };
    }

    return { ok: false, erro: "Não foi possível gerar o documento." };
  }
}
