import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { CHECKSUM_ANEXO_REMOVIDO } from "@/lib/domain/arquivos";
import { novoId } from "./store";
import { valoresSemDadosDePessoa, valoresSemDadosDoAluno } from "./dados-pessoais-estagio";

type Transacao = Prisma.TransactionClient;

const SELECAO_DOCUMENTO = { id: true, templateId: true, versaoTemplate: true, valores: true, inativadoEm: true } as const;

type LinhaDocumento = { id: string; templateId: string; versaoTemplate: number; valores: Prisma.JsonValue; inativadoEm: Date | null };

export type AlvoRemocao = "estagio_cancelado" | "estagio_excluido" | "conta" | "pessoa";

/** Conteúdo binário e metadados identificadores do anexo; anexos não são saneados, apenas removidos. */
async function removerConteudoDeAnexos(tx: Transacao, documentoIds: string[]) {
  if (documentoIds.length === 0) return;
  await tx.arquivo.updateMany({
    where: { documentoId: { in: documentoIds } },
    data: { conteudo: Buffer.alloc(0), tamanhoBytes: 0, checksum: CHECKSUM_ANEXO_REMOVIDO, nome: "anexo-removido" },
  });
}

async function sanearDocumentos(
  tx: Transacao,
  documentos: LinhaDocumento[],
  sanear: (templateId: string, versao: number, valores: Record<string, unknown>) => Record<string, unknown>,
  inativarEm?: Date,
) {
  for (const documento of documentos) {
    const valores = documento.valores as Record<string, unknown>;
    await tx.documentoPreenchido.update({
      where: { id: documento.id },
      data: {
        valores: sanear(documento.templateId, documento.versaoTemplate, valores) as Prisma.InputJsonValue,
        ...(inativarEm ? { situacao: "inativo", inativadoEm: documento.inativadoEm ?? inativarEm } : {}),
      },
    });
  }
}

/** Remove destinatário e e-mail do aluno em envios de documentos informados. */
async function limparEnviosDoAluno(tx: Transacao, documentoIds: string[], emailAluno: string) {
  if (documentoIds.length === 0) return;
  await tx.envioExterno.updateMany({
    where: { documentoId: { in: documentoIds }, destinatarioPapel: "aluno" },
    data: { destinatario: "Aluno (dados removidos)", destinatarioEmail: "" },
  });
  await tx.envioExterno.updateMany({
    where: { documentoId: { in: documentoIds }, destinatarioEmail: emailAluno },
    data: { destinatarioEmail: "" },
  });
}

/**
 * Efeitos de dados pessoais de um estágio cancelado ou excluído: estado do
 * estágio, documentos inativados sem dados do aluno fora do histórico permitido,
 * anexos sem conteúdo, envios sem e-mail e motivos livres apagados.
 * Idempotente: pode ser reaplicada após restauração de backup.
 */
export async function aplicarRemocaoDoEstagio(tx: Transacao, estagioId: string, alvo: "estagio_cancelado" | "estagio_excluido", momento: Date) {
  const estagio = await tx.estagio.findUnique({ where: { id: estagioId }, select: { alunoId: true, excluidoEm: true, canceladoEm: true, nomeAlunoHistorico: true, cursoIdHistorico: true } });
  if (!estagio) return;
  const aluno = await tx.usuario.findUniqueOrThrow({ where: { id: estagio.alunoId }, include: { dadosPessoaisAluno: true } });
  await tx.estagio.updateMany({
    where: { id: estagioId, excluidoEm: null },
    data: {
      excluidoEm: momento,
      ...(alvo === "estagio_cancelado" ? { canceladoEm: estagio.canceladoEm ?? momento } : {}),
      nomeAlunoHistorico: estagio.nomeAlunoHistorico ?? aluno.nome,
      cursoIdHistorico: estagio.cursoIdHistorico ?? aluno.dadosPessoaisAluno?.cursoId ?? null,
    },
  });

  const documentos = await tx.documentoPreenchido.findMany({ where: { estagioId }, select: SELECAO_DOCUMENTO });
  const idsDocumentos = documentos.map((documento) => documento.id);
  await sanearDocumentos(tx, documentos, (templateId, versao, valores) => valoresSemDadosDoAluno(templateId, versao, valores), momento);
  await removerConteudoDeAnexos(tx, idsDocumentos);
  await limparEnviosDoAluno(tx, idsDocumentos, aluno.email);
  if (idsDocumentos.length > 0) {
    await tx.pedidoEnvioDocumento.updateMany({ where: { documentoId: { in: idsDocumentos } }, data: { motivo: null } });
  }
  await tx.solicitacaoExclusaoEstagio.updateMany({ where: { estagioId }, data: { motivo: null } });
}

/**
 * Exclusão de cadastro com histórico: identidade técnica inativa, sem credenciais,
 * dados pessoais em tabelas e cópias nos documentos, anexos e solicitações.
 * Os nomes em estágios permanecem como histórico permitido.
 */
export async function aplicarRemocaoDaConta(tx: Transacao, usuarioId: string) {
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) return;
  const documentos = await tx.documentoPreenchido.findMany({ where: { alunoId: usuarioId }, select: SELECAO_DOCUMENTO });
  const idsDocumentos = documentos.map((documento) => documento.id);
  await sanearDocumentos(tx, documentos, (templateId, versao, valores) => valoresSemDadosDoAluno(templateId, versao, valores, "conta"));
  await removerConteudoDeAnexos(tx, idsDocumentos);
  await limparEnviosDoAluno(tx, idsDocumentos, usuario.email);
  if (idsDocumentos.length > 0) {
    await tx.pedidoEnvioDocumento.updateMany({ where: { documentoId: { in: idsDocumentos } }, data: { motivo: null } });
  }
  await tx.solicitacaoExclusaoEstagio.updateMany({ where: { solicitanteId: usuarioId }, data: { motivo: null } });
  await tx.solicitacaoAcesso.updateMany({ where: { usuarioId }, data: { motivo: null } });

  await tx.usuario.update({ where: { id: usuarioId }, data: {
    nome: "Cadastro excluído", email: `excluido.${usuarioId}@selic.invalid`, situacao: "inativo",
    matricula: null, dadosPessoais: Prisma.DbNull,
  } });
  await tx.dadosPessoaisAluno.deleteMany({ where: { usuarioId } });
  await tx.authSession.deleteMany({ where: { userId: usuarioId } });
  await tx.authAccount.deleteMany({ where: { userId: usuarioId } });
}

/**
 * Pessoa (orientador ou supervisor): remove contato e identificação pessoal da
 * cadastro e das cópias nos documentos dos estágios vinculados. O nome permanece.
 */
export async function aplicarRemocaoDaPessoa(tx: Transacao, pessoaId: string) {
  const pessoa = await tx.pessoa.findUnique({ where: { id: pessoaId } });
  if (!pessoa) return;
  await tx.pessoa.update({ where: { id: pessoaId }, data: {
    cpf: null, rg: null, endereco: Prisma.DbNull,
    telefone: "", email: `removido.${pessoaId}@selic.invalid`,
  } });
  const documentos = await tx.documentoPreenchido.findMany({
    where: { estagio: { OR: [{ supervisorId: pessoaId }, { orientadorId: pessoaId }] } },
    select: SELECAO_DOCUMENTO,
  });
  await sanearDocumentos(tx, documentos, (_templateId, _versao, valores) => valoresSemDadosDePessoa(valores));
}

export async function registrarRemocao(tx: Transacao, alvoTipo: AlvoRemocao, alvoId: string, momento: Date) {
  await tx.remocaoDadosPessoais.create({ data: { id: novoId("rem"), alvoTipo, alvoId, registradoEm: momento } });
}

/**
 * Após restaurar um backup tirado no ponto `desde`, reaplica as remoções
 * registradas a partir dele, em ordem, antes de reabrir consultas.
 */
export async function reaplicarRemocoesDesde(tx: Transacao, desde: Date): Promise<number> {
  const registros = await tx.remocaoDadosPessoais.findMany({
    where: { registradoEm: { gte: desde } },
    orderBy: [{ registradoEm: "asc" }, { id: "asc" }],
  });
  for (const registro of registros) {
    if (registro.alvoTipo === "estagio_cancelado" || registro.alvoTipo === "estagio_excluido") {
      await aplicarRemocaoDoEstagio(tx, registro.alvoId, registro.alvoTipo, registro.registradoEm);
    } else if (registro.alvoTipo === "conta") {
      await aplicarRemocaoDaConta(tx, registro.alvoId);
    } else if (registro.alvoTipo === "pessoa") {
      await aplicarRemocaoDaPessoa(tx, registro.alvoId);
    }
  }
  return registros.length;
}
