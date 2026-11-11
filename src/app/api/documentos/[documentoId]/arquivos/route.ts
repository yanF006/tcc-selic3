import { usuarioDaRequisicao } from "@/lib/auth/sessao-servidor";
import { exigirAcessoAnexos, listarArquivos, salvarArquivo } from "@/lib/services/arquivos";
import { erroArquivo, exigirOrigemUpload, lerCorpoArquivo } from "@/lib/http/arquivos";
import { ErroDeRegra } from "@/lib/domain/erros";

export const runtime = "nodejs";
type Contexto = { params: Promise<{ documentoId: string }> };

export async function GET(_request: Request, contexto: Contexto) {
  try {
    const usuario = await usuarioDaRequisicao();
    if (!usuario || usuario.situacao !== "ativo") return Response.json({ erro: "Entre no sistema para consultar anexos." }, { status: 401 });
    const { documentoId } = await contexto.params;
    return Response.json({ arquivos: await listarArquivos(usuario.id, documentoId) }, { headers: { "cache-control": "private, no-store" } });
  } catch (erro) { return erroArquivo(erro); }
}

export async function POST(request: Request, contexto: Contexto) {
  try {
    const usuario = await usuarioDaRequisicao();
    if (!usuario || usuario.situacao !== "ativo") return Response.json({ erro: "Entre no sistema para anexar arquivos." }, { status: 401 });
    exigirOrigemUpload(request);
    const { documentoId } = await contexto.params;
    await exigirAcessoAnexos(usuario.id, documentoId, true);
    let nome: string;
    try { nome = decodeURIComponent(request.headers.get("x-arquivo-nome") ?? ""); }
    catch { throw new ErroDeRegra("Nome de arquivo inválido.", "arquivo_invalido"); }
    const arquivo = await salvarArquivo(usuario.id, documentoId, {
      nome, mimeType: request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "",
      finalidade: request.headers.get("x-arquivo-finalidade") ?? "", conteudo: await lerCorpoArquivo(request),
    });
    return Response.json({ arquivo }, { status: 201, headers: { "cache-control": "private, no-store" } });
  } catch (erro) { return erroArquivo(erro); }
}
