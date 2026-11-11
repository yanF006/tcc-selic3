import "server-only";
import { LIMITE_ARQUIVO_BYTES } from "@/lib/domain/arquivos";
import { ErroDeRegra, mensagemSeguraParaUsuario } from "@/lib/services/erros";
import { BancoIndisponivelError } from "@/lib/db/erros";

/** Lê o corpo binário com teto mesmo sem Content-Length; não materializa multipart/base64. */
export async function lerCorpoArquivo(request: Request): Promise<Uint8Array> {
  const tamanho = request.headers.get("content-length");
  if (tamanho !== null && (!/^\d+$/.test(tamanho) || !Number.isSafeInteger(Number(tamanho)))) throw new ErroDeRegra("Tamanho de arquivo inválido.", "arquivo_invalido");
  if (tamanho !== null && Number(tamanho) > LIMITE_ARQUIVO_BYTES) throw new ErroDeRegra("O limite por arquivo é de 4 MiB.", "arquivo_excede_limite");
  if (!request.body) throw new ErroDeRegra("Selecione um arquivo não vazio.", "arquivo_vazio");
  const leitor = request.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.byteLength;
      if (total > LIMITE_ARQUIVO_BYTES) {
        await leitor.cancel().catch(() => {});
        throw new ErroDeRegra("O limite por arquivo é de 4 MiB.", "arquivo_excede_limite");
      }
      partes.push(value);
    }
  } finally { leitor.releaseLock(); }
  if (tamanho !== null && Number(tamanho) !== total) throw new ErroDeRegra("O arquivo foi recebido incompleto.", "arquivo_invalido");
  const conteudo = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) { conteudo.set(parte, posicao); posicao += parte.byteLength; }
  return conteudo;
}

export function exigirOrigemUpload(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new ErroDeRegra("Origem da requisição não permitida.", "origem_invalida");
}

export function erroArquivo(erro: unknown): Response {
  const codigo = erro instanceof ErroDeRegra ? erro.codigo : "erro_arquivo";
  const status = erro instanceof BancoIndisponivelError ? 503
    : codigo === "arquivo_excede_limite" ? 413
    : codigo === "tipo_arquivo_invalido" ? 415
    : codigo === "acesso_negado" ? 404
    : codigo === "origem_invalida" ? 403
    : codigo === "anexos_indisponiveis" || codigo === "arquivo_indisponivel" ? 503
    : erro instanceof ErroDeRegra ? 400 : 500;
  return Response.json({ erro: mensagemSeguraParaUsuario(erro), codigo }, { status, headers: { "cache-control": "private, no-store" } });
}
