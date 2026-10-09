import { readFile } from "node:fs/promises";
import path from "node:path";

import { usuarioDaRequisicao } from "@/lib/auth/sessao-servidor";
import { templatePorId } from "@/lib/services/documentos";

/**
 * Download dos documentos fixos do Kit (8.4): a Lei de Estágio e o Regulamento.
 * A rota recusa template preenchível de propósito — o download do documento
 * preenchido é outra rota, a que devolve a demonstração (8.14) — e assim o
 * "apenas download" do catálogo nunca abre nem devolve formulário.
 */

const TIPOS_POR_EXTENSAO: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  if (!(await usuarioDaRequisicao())) {
    return Response.json(
      { erro: "É preciso entrar no sistema para baixar este documento." },
      { status: 401 },
    );
  }

  const { templateId } = await params;
  const template = await templatePorId(templateId);

  if (!template) {
    return Response.json({ erro: "Documento não encontrado." }, { status: 404 });
  }

  if (template.tipo !== "download") {
    return Response.json(
      { erro: "Este documento é preenchível e não é baixado pelo catálogo." },
      { status: 409 },
    );
  }

  const vigente = template.versoes.find((versao) => versao.vigente);

  if (!vigente) {
    return Response.json({ erro: "Documento sem versão vigente." }, { status: 409 });
  }

  const arquivo = path.join(process.cwd(), vigente.arquivo);
  const conteudo = await readFile(arquivo).catch(() => null);

  if (!conteudo) {
    return Response.json({ erro: "Arquivo do Kit indisponível." }, { status: 500 });
  }

  return new Response(conteudo, {
    headers: {
      "content-type": TIPOS_POR_EXTENSAO[path.extname(arquivo)] ?? "application/octet-stream",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(arquivo))}`,
      "content-length": String(conteudo.byteLength),
    },
  });
}
