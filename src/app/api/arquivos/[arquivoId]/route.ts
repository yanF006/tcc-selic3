import { usuarioDaRequisicao } from "@/lib/auth/sessao-servidor";
import { baixarArquivo } from "@/lib/services/arquivos";
import { erroArquivo } from "@/lib/http/arquivos";

export const runtime = "nodejs";
export async function GET(_request: Request, contexto: { params: Promise<{ arquivoId: string }> }) {
  try {
    const usuario = await usuarioDaRequisicao();
    if (!usuario || usuario.situacao !== "ativo") return Response.json({ erro: "Entre no sistema para baixar arquivos." }, { status: 401 });
    const arquivo = await baixarArquivo(usuario.id, (await contexto.params).arquivoId);
    return new Response(new Uint8Array(arquivo.conteudo), { headers: {
      "content-type": arquivo.mimeType, "content-length": String(arquivo.tamanhoBytes),
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`,
      "cache-control": "private, no-store", "x-content-type-options": "nosniff",
      etag: `"${arquivo.checksum}"`,
    } });
  } catch (erro) { return erroArquivo(erro); }
}
