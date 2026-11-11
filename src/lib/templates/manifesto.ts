import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TemplateDocumento } from "@/lib/domain/types";
import { ErroDeRegra } from "@/lib/domain/erros";
import { templates } from "./catalogo";
import { descritorPorTemplate } from "./descriptors";
import checksums from "./checksums-kit.json";

const checksumsPorArquivo: Record<string, string> = checksums;

/** Hash determinístico do snapshot, independente da ordem das chaves de objetos. */
export function checksumDefinicao(valor: unknown): string {
  function ordenar(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(ordenar);
    if (item && typeof item === "object") return Object.fromEntries(
      Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([chave, filho]) => [chave, ordenar(filho)]),
    );
    return item;
  }
  return createHash("sha256").update(JSON.stringify(ordenar(valor))).digest("hex");
}

export function definicaoKit(chave: string) {
  const template = templates.find((item) => item.id === chave);
  const descritor = descritorPorTemplate(chave);
  if (!template || !descritor) return null;
  const arquivos = template.versoes.map((versao) => ({
    versao: versao.versao,
    caminho: versao.arquivo,
    vigente: versao.vigente,
    checksum: checksumsPorArquivo[path.basename(versao.arquivo)] ?? null,
  }));
  return {
    chave, nome: template.nome, tipo: template.tipo,
    descritor: structuredClone(descritor),
    checksum: checksumDefinicao(descritor),
    arquivos,
  };
}

export function templatesFixos(): TemplateDocumento[] {
  return structuredClone(templates);
}

/** Somente caminhos declarados pelo desenvolvedor; nunca aceita caminho do cliente. */
export async function lerArquivoKit(chave: string, versao?: number) {
  const definicao = definicaoKit(chave);
  if (!definicao) throw new ErroDeRegra("Documento não encontrado no Kit.", "definicao_kit_ausente");
  const arquivo = versao === undefined
    ? definicao.arquivos.find((item) => item.vigente)
    : definicao.arquivos.find((item) => item.versao === versao);
  if (!arquivo?.checksum) throw new ErroDeRegra("Arquivo do Kit indisponível.", "arquivo_kit_indisponivel");
  if (!arquivo.caminho.startsWith("Contexto/kit-estagio/")) {
    throw new ErroDeRegra("Arquivo do Kit indisponível.", "arquivo_kit_indisponivel");
  }
  // Prefixo literal para limitar também o file tracing do bundler ao Kit.
  const absoluto = path.join(process.cwd(), "Contexto", "kit-estagio", path.basename(arquivo.caminho));
  let conteudo: Buffer;
  try { conteudo = await readFile(absoluto); } catch {
    throw new ErroDeRegra("Arquivo do Kit indisponível.", "arquivo_kit_indisponivel");
  }
  if (createHash("sha256").update(conteudo).digest("hex") !== arquivo.checksum) {
    throw new ErroDeRegra("Arquivo do Kit indisponível.", "arquivo_kit_indisponivel");
  }
  return { conteudo, nome: path.basename(absoluto), checksum: arquivo.checksum };
}
