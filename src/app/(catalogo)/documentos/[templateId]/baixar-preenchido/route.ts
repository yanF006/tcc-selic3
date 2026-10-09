import { usuarioDaRequisicao } from "@/lib/auth/sessao-servidor";
import { arquivoDoDocumento, type FormatoDocumento } from "@/lib/documentos/baixar-documento";
import {
  documentoPorId,
  podePreencher,
  templatePorId,
} from "@/lib/services/documentos";

/**
 * Download do documento preenchido (8.14, 8.15), para acesso direto pela URL.
 * O formulário usa a server action `baixarDocumentoAction` (mesmo grafo de
 * módulos da página); esta rota atende chamadas programáticas e, no build de
 * produção, o mesmo processamento.
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const usuario = await usuarioDaRequisicao();

  if (!usuario) {
    return Response.json({ erro: "É preciso entrar no sistema para baixar o documento." }, { status: 401 });
  }

  const { templateId } = await params;
  const url = new URL(request.url);
  const documentoId = url.searchParams.get("documento");
  const formato = (url.searchParams.get("formato") ?? "docx") as FormatoDocumento;

  if (!["docx", "pdf"].includes(formato)) {
    return Response.json({ erro: "Formato de download inválido." }, { status: 400 });
  }

  if (!documentoId) {
    return Response.json({ erro: "Informe o documento a baixar." }, { status: 400 });
  }

  const documento = await documentoPorId(documentoId);
  const template = await templatePorId(templateId);

  if (!documento || documento.templateId !== templateId || !template) {
    return Response.json({ erro: "Documento não encontrado." }, { status: 404 });
  }

  if (documento.alunoId !== usuario.id && !podePreencher(usuario, template)) {
    return Response.json({ erro: "Você não pode baixar este documento." }, { status: 403 });
  }

  const resultado = arquivoDoDocumento(documento, templateId, formato);

  if (!resultado.ok) {
    return Response.json(
      { erro: resultado.erro, problemas: resultado.problemas },
      { status: 422 },
    );
  }

  return new Response(new Uint8Array(resultado.bytes as Uint8Array), {
    headers: {
      "content-type": resultado.tipoConteudo as string,
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(resultado.nomeArquivo as string)}`,
      "content-length": String(resultado.bytes?.byteLength ?? 0),
    },
  });
}