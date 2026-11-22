import path from "node:path";

import { usuarioDaRequisicao } from "@/lib/auth/sessao-servidor";
import { definicaoKit, lerArquivoKit } from "@/lib/templates/manifesto";
import { ErroDeRegra } from "@/lib/domain/erros";

export const runtime = "nodejs";

/**
 * Download dos arquivos originais do Kit (8.4): os documentos fixos (Lei de
 * Estágio e Regulamento) e o modelo em branco dos documentos preenchíveis, que
 * pode ser baixado sem estágio cadastrado. O documento preenchido é outra rota
 * (8.14); esta só devolve o arquivo oficial validado por checksum.
 */

const TIPOS_POR_EXTENSAO: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const usuario = await usuarioDaRequisicao();
  if (!usuario || usuario.situacao !== "ativo") {
    return Response.json(
      { erro: "É preciso entrar no sistema para baixar este documento." },
      { status: 401 },
    );
  }

  const { templateId } = await params;
  const template = definicaoKit(templateId);

  if (!template) {
    return Response.json({ erro: "Documento não encontrado." }, { status: 404 });
  }

  try {
    const { conteudo, nome, checksum } = await lerArquivoKit(templateId);
    return new Response(new Uint8Array(conteudo), {
      headers: {
        "content-type": TIPOS_POR_EXTENSAO[path.extname(nome)] ?? "application/octet-stream",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`,
        "content-length": String(conteudo.byteLength),
        "cache-control": "private, no-store",
        "etag": `"${checksum}"`,
      },
    });
  } catch (erro) {
    if (!(erro instanceof ErroDeRegra)) throw erro;
    return Response.json({ erro: "Arquivo do Kit indisponível." }, { status: 503 });
  }
}
