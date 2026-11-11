import "server-only";

import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { LIMITE_ARQUIVO_BYTES, TIPOS_ARQUIVO, type FinalidadeArquivo, type MetadadosArquivo } from "@/lib/domain/arquivos";
import { bancoConfigurado, carregarCliente } from "@/lib/db/prisma";
import { executarTransacao } from "@/lib/db/transacoes";
import { buscarDocumento } from "@/lib/db/repositorios/documentos";
import { podeConsultarDocumentoNoBanco } from "./documentos-persistentes";
import { ErroDeRegra } from "./erros";
import { novoId } from "./store";
import { documentoInicial, DOCUMENTOS_INICIAIS } from "@/lib/domain/fluxo-estagio";

export const selecionarMetadadosArquivo = {
  id: true, documentoId: true, nome: true, mimeType: true, finalidade: true,
  tamanhoBytes: true, checksum: true, autorId: true, criadoEm: true,
} satisfies Prisma.ArquivoSelect;

type LinhaMetadados = { id: string; documentoId: string | null; nome: string; mimeType: string; finalidade: string; tamanhoBytes: number; checksum: string; autorId: string; criadoEm: Date };
function metadados(linha: LinhaMetadados): MetadadosArquivo {
  return { ...linha, documentoId: linha.documentoId!, finalidade: linha.finalidade as FinalidadeArquivo, criadoEm: linha.criadoEm.toISOString() };
}
function exigirBanco() {
  if (!bancoConfigurado()) throw new ErroDeRegra("Anexos duráveis exigem o modo com banco de dados.", "anexos_indisponiveis");
}

export async function exigirAcessoAnexos(autorId: string, documentoId: string, escrita = false, transacao?: Prisma.TransactionClient) {
  exigirBanco();
  const tx = transacao ?? (await carregarCliente()).prisma;
  if (!(await podeConsultarDocumentoNoBanco(autorId, documentoId, transacao))) throw new ErroDeRegra("Documento ou arquivo não disponível para este usuário.", "acesso_negado");
  if (!escrita) return;
  const documento = await buscarDocumento(tx, documentoId);
  const autor = await tx.usuario.findUnique({ where: { id: autorId } });
  const papeisPreenchimento: readonly string[] = documento?.definicaoSnapshot?.metadados?.papeisPreenchimento ?? [];
  if (!documento || !autor || documento.situacao === "inativo" ||
    (autor.papel !== "administrador" && !papeisPreenchimento.includes(autor.papel))) {
    throw new ErroDeRegra("Este perfil não pode anexar arquivos ao documento.", "acesso_negado");
  }
  const titular = await tx.usuario.findUnique({ where: { id: documento.alunoId }, select: { situacao: true } });
  const estagio = documento.estagioId ? await tx.estagio.findUnique({ where: { id: documento.estagioId }, select: { canceladoEm: true, excluidoEm: true } }) : null;
  if (titular?.situacao !== "ativo" || estagio?.canceladoEm || estagio?.excluidoEm) throw new ErroDeRegra("O documento está disponível apenas para consulta.", "documento_bloqueado");
}

export function validarArquivo(nome: string, mimeType: string, finalidade: string, conteudo: Uint8Array) {
  if (conteudo.byteLength === 0) throw new ErroDeRegra("Selecione um arquivo não vazio.", "arquivo_vazio");
  if (conteudo.byteLength > LIMITE_ARQUIVO_BYTES) throw new ErroDeRegra("O limite por arquivo é de 4 MiB.", "arquivo_excede_limite");
  if (finalidade !== "assinado" && finalidade !== "comprovante") throw new ErroDeRegra("Finalidade de arquivo inválida.", "tipo_arquivo_invalido");
  const tipos: readonly string[] = TIPOS_ARQUIVO[finalidade];
  const bytes = Buffer.from(conteudo);
  const extensao = nome.split(".").at(-1)?.toLowerCase();
  const valido = mimeType === "application/pdf" ? extensao === "pdf" && bytes.subarray(0, 5).toString("ascii") === "%PDF-"
    : mimeType === "image/png" ? extensao === "png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mimeType === "image/jpeg" ? (extensao === "jpg" || extensao === "jpeg") && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : false;
  if (!tipos.includes(mimeType) || !valido) throw new ErroDeRegra("Tipo de arquivo incompatível. Assinados: PDF. Comprovantes: PDF, JPEG ou PNG.", "tipo_arquivo_invalido");
}

export async function salvarArquivo(autorId: string, documentoId: string, entrada: { nome: string; mimeType: string; finalidade: string; conteudo: Uint8Array }): Promise<MetadadosArquivo> {
  exigirBanco();
  const nome = entrada.nome.split(/[\\/]/).at(-1)!.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 255);
  validarArquivo(nome, entrada.mimeType, entrada.finalidade, entrada.conteudo);
  const { prisma } = await carregarCliente();
  const ponteiro = await prisma.documentoPreenchido.findUnique({ where: { id: documentoId }, select: { alunoId: true } });
  if (!ponteiro) throw new ErroDeRegra("Documento ou arquivo não disponível para este usuário.", "acesso_negado");
  return executarTransacao(async (tx) => {
    // Mesma ordem dos preenchimentos: titular antes do documento.
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${ponteiro.alunoId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM documentos_preenchidos WHERE id = ${documentoId} FOR UPDATE`;
    await exigirAcessoAnexos(autorId, documentoId, true, tx);
    const documento = (await buscarDocumento(tx, documentoId))!;
    if (documento.alunoId !== ponteiro.alunoId) throw new ErroDeRegra("O vínculo do documento foi alterado.", "documento_bloqueado");
    if (entrada.finalidade === "comprovante" && documento.situacao !== "rascunho") {
      throw new ErroDeRegra("Comprovantes só podem ser anexados durante o preenchimento do rascunho.", "documento_bloqueado");
    }
    if (entrada.finalidade === "assinado") {
      const tipoParecer = documento.definicaoSnapshot?.metadados?.tipoParecer;
      const exigeParecer = tipoParecer === "coordenador_curso" || tipoParecer === "comissao_estagio";
      const liberacao = documento.estagioId && documentoInicial(documento.templateId)
        ? await tx.documentoPreenchido.findFirst({ where: { estagioId: documento.estagioId, templateId: DOCUMENTOS_INICIAIS[0], situacao: "aprovado" } }) : null;
      if ((documentoInicial(documento.templateId) && !liberacao) || (exigeParecer && documento.situacao !== "aprovado")) {
        throw new ErroDeRegra("O recebimento do documento assinado depende do parecer favorável.", "parecer_pendente");
      }
    }
    const arquivo = await tx.arquivo.create({ data: {
      id: novoId("arq"), documentoId, nome, mimeType: entrada.mimeType, finalidade: entrada.finalidade,
      tamanhoBytes: entrada.conteudo.byteLength, checksum: createHash("sha256").update(entrada.conteudo).digest("hex"),
      conteudo: new Uint8Array(entrada.conteudo), autorId,
    }, select: selecionarMetadadosArquivo });
    await tx.documentoPreenchido.update({ where: { id: documentoId }, data: { atualizadoEm: new Date() } });
    return metadados(arquivo);
  }, { cliente: prisma }, { isolationLevel: "Serializable" });
}

export async function listarArquivos(autorId: string, documentoId: string): Promise<MetadadosArquivo[]> {
  await exigirAcessoAnexos(autorId, documentoId);
  const { prisma } = await carregarCliente();
  return (await prisma.arquivo.findMany({ where: { documentoId }, select: selecionarMetadadosArquivo, orderBy: [{ criadoEm: "desc" }, { id: "asc" }] })).map(metadados);
}

export async function baixarArquivo(autorId: string, arquivoId: string) {
  exigirBanco();
  const { prisma } = await carregarCliente();
  return executarTransacao(async (tx) => {
    const arquivo = await tx.arquivo.findUnique({ where: { id: arquivoId }, select: selecionarMetadadosArquivo });
    if (!arquivo?.documentoId) throw new ErroDeRegra("Documento ou arquivo não disponível para este usuário.", "acesso_negado");
    await exigirAcessoAnexos(autorId, arquivo.documentoId, false, tx);
    const binario = await tx.arquivo.findUniqueOrThrow({ where: { id: arquivoId }, select: { conteudo: true } });
    if (binario.conteudo.byteLength !== arquivo.tamanhoBytes || createHash("sha256").update(binario.conteudo).digest("hex") !== arquivo.checksum) {
      throw new ErroDeRegra("Conteúdo do arquivo indisponível.", "arquivo_indisponivel");
    }
    return { ...metadados(arquivo), conteudo: binario.conteudo };
  }, { cliente: prisma }, { isolationLevel: "RepeatableRead" });
}
