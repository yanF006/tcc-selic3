"use server";

import { revalidatePath } from "next/cache";

import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import { arquivoDoDocumento, type FormatoDocumento } from "@/lib/documentos/baixar-documento";
import {
  documentoPorId,
  podePreencher,
  podeConsultarDocumento,
  valoresDoPreenchimento,
  salvarRascunho,
  submeter,
  templatePorId,
  validarValores,
  type ProblemaValidacao,
} from "@/lib/services/documentos";
import { ErroDeRegra } from "@/lib/services/erros";
import { usuarioPorId } from "@/lib/services/administracao";

export interface ResultadoDocumento {
  ok: boolean;
  erro?: string;
  problemas?: ProblemaValidacao[];
  valores?: Record<string, unknown>;
}

export async function submeterDocumentoAction(
  documentoId: string,
  valores: Record<string, unknown>,
): Promise<ResultadoDocumento> {
  const usuario = await usuarioDaRequisicaoObrigatorio();
  const documento = await documentoPorId(documentoId);
  if (
    !documento ||
    !(await podeConsultarDocumento(usuario, documento)) ||
    documento.alunoId !== usuario.id
  ) {
    return { ok: false, erro: "Documento não disponível para submissão." };
  }
  const template = await templatePorId(documento.templateId);
  if (!template?.metadados || template.metadados.tipoParecer === "nenhum") {
    return { ok: false, erro: "Este documento não está sujeito a parecer." };
  }
  const salvo = await salvarDocumentoAction(documentoId, valores);
  if (!salvo.ok) return salvo;
  try {
    await submeter(documentoId);
    revalidatePath(`/documentos/${documento.templateId}`);
    return salvo;
  } catch (erro) {
    return {
      ok: false,
      erro: erro instanceof Error ? erro.message : "Não foi possível submeter o documento.",
    };
  }
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

    if (
      !template ||
      !podePreencher(usuario, template) ||
      !(await podeConsultarDocumento(usuario, documento))
    ) {
      return { ok: false, erro: "O preenchimento deste documento cabe a outro perfil." };
    }

    if (documento.situacao !== "rascunho") {
      return { ok: false, erro: "Somente rascunhos podem ser editados." };
    }

    const aluno = await usuarioPorId(documento.alunoId);
    if (!aluno) return { ok: false, erro: "Cadastro do aluno não encontrado." };
    if (aluno.situacao !== "ativo")
      return { ok: false, erro: "Documento de cadastro inativo: apenas consulta." };
    const preparados = await valoresDoPreenchimento(
      documento.templateId,
      aluno,
      documento.estagioId,
      { ...documento.valores, ...valores },
    );
    const problemas = validarValores(documento.templateId, preparados);

    if (problemas.length > 0) {
      return { ok: false, erro: problemas[0].mensagem, problemas };
    }

    await salvarRascunho(documentoId, preparados);
    revalidatePath(`/documentos/${documento.templateId}`);

    return { ok: true, valores: preparados };
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

    if (!template || !(await podeConsultarDocumento(usuario, documento))) {
      return { ok: false, erro: "Você não pode baixar este documento." };
    }

    const aluno = await usuarioPorId(documento.alunoId);
    const valores =
      documento.situacao === "rascunho" && aluno?.situacao === "ativo"
        ? await valoresDoPreenchimento(templateId, aluno, documento.estagioId, documento.valores)
        : documento.valores;
    const resultado = arquivoDoDocumento({ ...documento, valores }, templateId, formato);

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
