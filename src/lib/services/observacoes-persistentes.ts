import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { ObservacaoDocumento } from "@/lib/domain/types";
import { carregarCliente } from "@/lib/db/prisma";
import { executarTransacao } from "@/lib/db/transacoes";
import { ErroDeRegra } from "./erros";
import { novoId } from "./store";

type ClienteObservacoes = Prisma.TransactionClient | Pick<PrismaClient, "usuario" | "documentoPreenchido">;

function paraDominioObservacao(linha: { id: string; documentoId: string; conteudo: string; autorId: string; data: Date }): ObservacaoDocumento {
  return { id: linha.id, documentoId: linha.documentoId, conteudo: linha.conteudo, autorId: linha.autorId, data: linha.data.toISOString() };
}

export async function podeAcrescentarObservacaoNoBanco(cliente: ClienteObservacoes, autorId: string, documentoId: string): Promise<boolean> {
  const autor = await cliente.usuario.findUnique({ where: { id: autorId } });
  if (!autor || autor.situacao !== "ativo") return false;
  const documento = await cliente.documentoPreenchido.findUnique({ where: { id: documentoId }, include: { aluno: { include: { dadosPessoaisAluno: true } }, estagio: true } });
  if (!documento) return false;
  const curso = documento.estagio?.excluidoEm ? documento.estagio.cursoIdHistorico : documento.aluno.dadosPessoaisAluno?.cursoId;
  return (
    (autor.papel === "coordenador_estagio" && autor.campus === documento.aluno.campus) ||
    (autor.papel === "coordenador_curso" && Boolean(autor.cursoId) && curso === autor.cursoId)
  );
}

export async function acrescentarObservacaoPersistente(documentoId: string, conteudo: string, autorId: string): Promise<ObservacaoDocumento> {
  if (typeof conteudo !== "string" || !conteudo.trim()) throw new ErroDeRegra("Informe o conteúdo da observação.", "observacao_vazia");
  const { prisma } = await carregarCliente();
  return executarTransacao(async (tx) => {
    if (!(await podeAcrescentarObservacaoNoBanco(tx, autorId, documentoId)))
      throw new ErroDeRegra("Observação não disponível para este usuário.", "acesso_negado");
    const linha = await tx.observacaoDocumento.create({ data: { id: novoId("obs"), documentoId, conteudo: conteudo.trim(), autorId } });
    return paraDominioObservacao(linha);
  }, { cliente: prisma }, { isolationLevel: "RepeatableRead" });
}

export async function observacoesDoDocumentoPersistente(documentoId: string, autorId: string): Promise<ObservacaoDocumento[]> {
  const { prisma } = await carregarCliente();
  return executarTransacao(async (tx) => {
    const { podeConsultarDocumentoNoBanco } = await import("./documentos-persistentes");
    if (!(await podeConsultarDocumentoNoBanco(autorId, documentoId, tx))) throw new ErroDeRegra("Documento não disponível.", "acesso_negado");
    const linhas = await tx.observacaoDocumento.findMany({ where: { documentoId }, orderBy: [{ data: "asc" }, { id: "asc" }] });
    return linhas.map(paraDominioObservacao);
  }, { cliente: prisma }, { isolationLevel: "RepeatableRead" });
}
