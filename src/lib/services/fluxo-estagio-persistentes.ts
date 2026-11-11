import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { DocumentoPreenchido, SituacaoDocumento } from "@/lib/domain/types";
import { DOCUMENTOS_INICIAIS, documentoInicial, estagioEncerrado, estagioLiberado } from "@/lib/domain/fluxo-estagio";
import { transicaoDocumentoPermitida } from "@/lib/domain/status";
import type { EnvioExterno } from "@/lib/domain/types";
import { camposDoTemplate, fonteParecer } from "@/lib/templates/descriptors";
import { carregarCliente } from "@/lib/db/prisma";
import { podeConsultarDocumentoNoBanco } from "./documentos-persistentes";
import { podeAcrescentarObservacaoNoBanco } from "./observacoes-persistentes";
import { executarTransacao } from "@/lib/db/transacoes";
import { buscarEstagio, paraDominioEstagio, podeConsultarEstagioNoBanco } from "@/lib/db/repositorios/estagios";
import { buscarDocumento, paraDominioDocumento } from "@/lib/db/repositorios/documentos";
import { validarValores, type ProblemaValidacao } from "./documentos";
import { ErroDeRegra } from "./erros";
import { novoId } from "./store";

async function autorAtual(tx: Prisma.TransactionClient, autorId: string) {
  const autor = await tx.usuario.findUnique({ where: { id: autorId } });
  if (!autor || autor.situacao !== "ativo") throw new ErroDeRegra("Acesso não permitido.", "acesso_negado");
  return autor;
}

function problemasDoDocumento(documento: DocumentoPreenchido): ProblemaValidacao[] {
  return validarValores(documento.templateId, documento.valores, undefined, documento.definicaoSnapshot);
}

async function cursoDoAluno(tx: Prisma.TransactionClient, alunoId: string) {
  return (await tx.dadosPessoaisAluno.findUnique({ where: { usuarioId: alunoId }, select: { cursoId: true } }))?.cursoId ?? null;
}

async function proximaSubmissao(tx: Prisma.TransactionClient, documentoId: string) {
  const ultima = await tx.submissaoDocumento.findFirst({ where: { documentoId }, orderBy: { versao: "desc" }, select: { versao: true } });
  return (ultima?.versao ?? 0) + 1;
}

async function registrarSubmissao(tx: Prisma.TransactionClient, documento: DocumentoPreenchido, autorId: string) {
  await tx.submissaoDocumento.create({ data: {
    id: novoId("sub"), documentoId: documento.id, estagioId: documento.estagioId ?? null,
    versao: await proximaSubmissao(tx, documento.id), autorId,
  } });
}

export async function solicitarEncaminhamentoPersistente(estagioId: string, alunoId: string) {
  const { prisma } = await carregarCliente();
  const ponteiro = await prisma.estagio.findUnique({ where: { id: estagioId }, select: { alunoId: true } });
  if (!ponteiro) throw new ErroDeRegra("Solicitação não disponível para encaminhamento.", "solicitacao_invalida");
  if (ponteiro.alunoId !== alunoId) throw new ErroDeRegra("Solicitação não disponível para encaminhamento.", "acesso_negado");
  return executarTransacao(async (tx) => {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${ponteiro.alunoId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM estagios WHERE id = ${estagioId} FOR UPDATE`;
    const autor = await autorAtual(tx, alunoId);
    const estagio = await buscarEstagio(tx, estagioId);
    if (!estagio || estagio.alunoId !== autor.id || estagio.situacao !== "em_preparacao" || estagioEncerrado(estagio))
      throw new ErroDeRegra("Solicitação não disponível para encaminhamento.", "solicitacao_invalida");
    const linhas = await tx.documentoPreenchido.findMany({ where: { estagioId, templateId: { in: [...DOCUMENTOS_INICIAIS] }, situacao: { not: "inativo" } }, orderBy: { id: "asc" } });
    const documentos = linhas.map(paraDominioDocumento);
    for (const templateId of DOCUMENTOS_INICIAIS) {
      const documento = documentos.find((item) => item.templateId === templateId);
      if (!documento) throw new ErroDeRegra("Complete os três documentos iniciais.", "documentacao_pendente");
      await tx.$queryRaw`SELECT id FROM documentos_preenchidos WHERE id = ${documento.id} FOR UPDATE`;
      const problemas = problemasDoDocumento(documento);
      if (problemas.length) throw new ErroDeRegra(`${documento.definicaoSnapshot?.titulo ?? templateId}: ${problemas[0].mensagem}`, "documentacao_pendente");
    }
    const formulario = documentos.find((item) => item.templateId === DOCUMENTOS_INICIAIS[0])!;
    if (estagio.encaminhadoEm || formulario.situacao !== "rascunho")
      throw new ErroDeRegra("O formulário já foi encaminhado. Aguarde o parecer.", "ja_encaminhado");
    await registrarSubmissao(tx, formulario, autor.id);
    await tx.documentoPreenchido.update({ where: { id: formulario.id }, data: { situacao: "submetido", correcaoAberta: false, atualizadoEm: new Date() } });
    await tx.documentoPreenchido.updateMany({ where: { estagioId, templateId: { in: [...DOCUMENTOS_INICIAIS] }, id: { not: formulario.id } }, data: { correcaoAberta: false, atualizadoEm: new Date() } });
    await tx.estagio.update({ where: { id: estagioId }, data: { encaminhadoEm: new Date(), encaminhadoPorId: autor.id } });
    return paraDominioEstagio((await tx.estagio.findUniqueOrThrow({ where: { id: estagioId }, include: { templates: true } })));
  }, { cliente: prisma }, { isolationLevel: "Serializable" });
}

export async function submeterPersistente(documentoId: string, autorId: string, regrasValidacao = problemasDoDocumento): Promise<DocumentoPreenchido> {
  const { prisma } = await carregarCliente();
  const ponteiro = await prisma.documentoPreenchido.findUnique({ where: { id: documentoId }, select: { alunoId: true } });
  if (!ponteiro) throw new ErroDeRegra("Documento não encontrado.", "nao_encontrado");
  return executarTransacao(async (tx) => {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${ponteiro.alunoId} FOR UPDATE`;
    const autor = await autorAtual(tx, autorId);
    if (autor.id !== ponteiro.alunoId) throw new ErroDeRegra("Documento não disponível para submissão.", "acesso_negado");
    await tx.$queryRaw`SELECT id FROM documentos_preenchidos WHERE id = ${documentoId} FOR UPDATE`;
    const documento = await buscarDocumento(tx, documentoId);
    if (!documento || documento.alunoId !== ponteiro.alunoId) throw new ErroDeRegra("Documento não encontrado.", "nao_encontrado");
    const estagio = documento.estagioId ? await buscarEstagio(tx, documento.estagioId) : null;
    if (estagio && (estagioEncerrado(estagio) || (!documentoInicial(documento.templateId) && !estagioLiberado(estagio))))
      throw new ErroDeRegra("O estágio aguarda liberação ou está cancelado/excluído.", "liberacao_pendente");
    const metadados = documento.definicaoSnapshot?.metadados;
    if (!metadados || metadados.tipoParecer === "nenhum") throw new ErroDeRegra("Este documento não está sujeito a parecer.", "parecer_indisponivel");
    const problemas = regrasValidacao(documento);
    if (problemas.length) throw new ErroDeRegra(problemas[0].mensagem, "documentacao_pendente");
    if (!transicaoDocumentoPermitida(documento.situacao, "submetido"))
      throw new ErroDeRegra(`Não é possível enviar um documento em "${documento.situacao}".`, "situacao_invalida");
    await registrarSubmissao(tx, documento, autor.id);
    await tx.documentoPreenchido.update({ where: { id: documentoId }, data: { situacao: "submetido", correcaoAberta: false, atualizadoEm: new Date() } });
    return (await buscarDocumento(tx, documentoId))!;
  }, { cliente: prisma }, { isolationLevel: "Serializable" });
}

function valoresComParecer(documento: DocumentoPreenchido, decisao: "aprovado" | "indeferido", consideracoes: string | undefined, momento: string) {
  const valores = { ...documento.valores };
  for (const campo of camposDoTemplate(documento.templateId, documento.definicaoSnapshot)) {
    const fonte = fonteParecer(documento.templateId, campo);
    if (fonte === "data") valores[campo.id] = momento.slice(0, 10);
    if (fonte === "consideracoes") valores[campo.id] = consideracoes ?? "";
    if (fonte === "decisao")
      valores[campo.id] = campo.tipo === "checkbox"
        ? decisao === "aprovado"
        : campo.opcoes?.some((opcao) => opcao.valor === "sim")
          ? decisao === "aprovado" ? "sim" : "nao"
          : decisao;
  }
  return valores;
}

export async function registrarParecerPersistente(
  documentoId: string,
  decisao: "aprovado" | "indeferido",
  autorId: string,
  consideracoes?: string,
): Promise<DocumentoPreenchido> {
  const { prisma } = await carregarCliente();
  const ponteiro = await prisma.documentoPreenchido.findUnique({ where: { id: documentoId }, select: { alunoId: true, estagioId: true } });
  if (!ponteiro) throw new ErroDeRegra("Documento não encontrado.", "nao_encontrado");
  return executarTransacao(async (tx) => {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${ponteiro.alunoId} FOR UPDATE`;
    if (ponteiro.estagioId) await tx.$queryRaw`SELECT id FROM estagios WHERE id = ${ponteiro.estagioId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM documentos_preenchidos WHERE id = ${documentoId} FOR UPDATE`;
    const autor = await autorAtual(tx, autorId);
    if (ponteiro.estagioId && !(await podeConsultarEstagioNoBanco(tx, autor.id, ponteiro.estagioId)))
      throw new ErroDeRegra("Parecer não disponível para este usuário.", "acesso_negado");
    const documento = await buscarDocumento(tx, documentoId);
    if (!documento) throw new ErroDeRegra("Documento não encontrado.", "nao_encontrado");
    const estagio = documento.estagioId ? await buscarEstagio(tx, documento.estagioId) : null;
    if (estagio && estagioEncerrado(estagio)) throw new ErroDeRegra("Estágio cancelado ou excluído.", "estagio_encerrado");
    const fila = documento.definicaoSnapshot?.metadados?.tipoParecer;
    const curso = await cursoDoAluno(tx, documento.alunoId);
    const autorizado =
      autor.papel === "administrador" ||
      (fila === "coordenador_curso" && autor.papel === "coordenador_curso" && Boolean(autor.cursoId) && curso === autor.cursoId) ||
      (fila === "comissao_estagio" && autor.papel === "coordenador_estagio" && autor.membroComissaoEstagio);
    if (!autorizado || !fila || fila === "externo" || fila === "nenhum" || !["aprovado", "indeferido"].includes(decisao))
      throw new ErroDeRegra("Parecer não disponível para este usuário ou decisão inválida.", "acesso_negado");
    let situacaoAtual: SituacaoDocumento = documento.situacao;
    if (situacaoAtual === "submetido") {
      await tx.documentoPreenchido.updateMany({ where: { id: documentoId, situacao: "submetido" }, data: { situacao: "em_analise", atualizadoEm: new Date() } });
      situacaoAtual = "em_analise";
    }
    if (!transicaoDocumentoPermitida(situacaoAtual, decisao))
      throw new ErroDeRegra(`Não é possível emitir parecer a partir de "${situacaoAtual}".`, "situacao_invalida");
    const momento = new Date();
    const resultado = await tx.documentoPreenchido.updateMany({
      where: { id: documentoId, situacao: situacaoAtual },
      data: { situacao: decisao, valores: JSON.parse(JSON.stringify(valoresComParecer(documento, decisao, consideracoes, momento.toISOString()))) as Prisma.InputJsonValue, atualizadoEm: momento },
    });
    if (resultado.count !== 1) throw new ErroDeRegra("Documento alterado por outra operação. Consulte o estado atual e tente novamente.", "conflito_concorrente");
    await tx.parecer.create({ data: {
      id: novoId("par"), documentoId, decisao, consideracoes: consideracoes?.trim() || null,
      autorId: autor.id, fila, data: momento,
    } });
    if (consideracoes?.trim() && (autor.papel === "coordenador_curso" || autor.papel === "coordenador_estagio"))
      await tx.observacaoDocumento.create({ data: { id: novoId("obs"), documentoId, conteudo: consideracoes.trim(), autorId: autor.id, data: momento } });
    return (await buscarDocumento(tx, documentoId))!;
  }, { cliente: prisma }, { isolationLevel: "Serializable" });
}

export async function reabrirParaCorrecaoPersistente(estagioId: string, alunoId: string): Promise<DocumentoPreenchido> {
  const { prisma } = await carregarCliente();
  const ponteiro = await prisma.estagio.findUnique({ where: { id: estagioId }, select: { alunoId: true } });
  if (!ponteiro) throw new ErroDeRegra("Correção não disponível.", "correcao_indisponivel");
  return executarTransacao(async (tx) => {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${ponteiro.alunoId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM estagios WHERE id = ${estagioId} FOR UPDATE`;
    const autor = await autorAtual(tx, alunoId);
    const estagio = await buscarEstagio(tx, estagioId);
    if (!estagio || estagio.alunoId !== autor.id || estagioLiberado(estagio) || estagioEncerrado(estagio))
      throw new ErroDeRegra("A correção só está disponível após indeferimento.", "correcao_indisponivel");
    const formulario = await tx.documentoPreenchido.findFirst({ where: { estagioId, templateId: DOCUMENTOS_INICIAIS[0], situacao: "indeferido" }, orderBy: { id: "asc" } });
    if (!formulario) throw new ErroDeRegra("A correção só está disponível após indeferimento.", "correcao_indisponivel");
    await tx.$queryRaw`SELECT id FROM documentos_preenchidos WHERE id = ${formulario.id} FOR UPDATE`;
    const atualizado = await tx.documentoPreenchido.updateMany({ where: { id: formulario.id, situacao: "indeferido" }, data: { situacao: "rascunho", correcaoAberta: true, atualizadoEm: new Date() } });
    if (atualizado.count !== 1) throw new ErroDeRegra("Documento alterado por outra operação.", "conflito_concorrente");
    return (await buscarDocumento(tx, formulario.id))!;
  }, { cliente: prisma }, { isolationLevel: "Serializable" });
}

const TRANSPORTE_INDISPONIVEL = "Integração de envio de anexos indisponível; obtenha a assinatura pelo meio convencional.";

async function destinatarioDaAssinatura(
  tx: Prisma.TransactionClient,
  assinatura: { papel: string; rotulo: string },
  documento: DocumentoPreenchido,
  estagioId: string | null,
) {
  const aluno = await tx.usuario.findUnique({ where: { id: documento.alunoId }, select: { id: true, nome: true, email: true } });
  if (assinatura.papel === "aluno") return aluno ? { nome: aluno.nome, email: aluno.email } : null;
  const estagio = estagioId ? await tx.estagio.findUnique({ where: { id: estagioId }, select: { orientadorId: true, supervisorId: true } }) : null;
  if (assinatura.papel === "coordenador_curso") {
    const curso = await cursoDoAluno(tx, documento.alunoId);
    return curso ? tx.usuario.findFirst({ where: { situacao: "ativo", papel: "coordenador_curso", cursoId: curso }, select: { nome: true, email: true } }) : null;
  }
  if (assinatura.papel === "orientador" && estagio) return tx.pessoa.findUnique({ where: { id: estagio.orientadorId }, select: { nome: true, email: true } });
  if ((assinatura.papel === "supervisor" || (assinatura.papel === "externo" && /supervisor/i.test(assinatura.rotulo))) && estagio)
    return tx.pessoa.findUnique({ where: { id: estagio.supervisorId }, select: { nome: true, email: true } });
  return null;
}

/**
 * Registra o pedido e cada tentativa antes de qualquer transporte. Como a
 * integração de anexos ainda não existe, nenhuma tentativa é marcada como
 * enviada: e-mail cadastrado não comprova envio, assinatura ou liberação.
 */
export async function enviarParaAssinaturasPersistente(documentoId: string, autorId: string): Promise<EnvioExterno[]> {
  const { prisma } = await carregarCliente();
  const ponteiro = await prisma.documentoPreenchido.findUnique({ where: { id: documentoId }, select: { alunoId: true, estagioId: true } });
  if (!ponteiro) throw new ErroDeRegra("Documento não encontrado.", "acesso_negado");
  return executarTransacao(async (tx) => {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${ponteiro.alunoId} FOR UPDATE`;
    if (ponteiro.estagioId) await tx.$queryRaw`SELECT id FROM estagios WHERE id = ${ponteiro.estagioId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM documentos_preenchidos WHERE id = ${documentoId} FOR UPDATE`;
    const autor = await autorAtual(tx, autorId);
    const documento = await buscarDocumento(tx, documentoId);
    if (!documento || !(await podeConsultarDocumentoNoBanco(autor.id, documentoId, tx)))
      throw new ErroDeRegra("Documento não disponível.", "acesso_negado");
    if (autor.id !== documento.alunoId && !["coordenador_curso", "coordenador_estagio", "administrador"].includes(autor.papel))
      throw new ErroDeRegra("Envio não permitido para este usuário.", "acesso_negado");
    if (documento.estagioId) {
      const estagio = await buscarEstagio(tx, documento.estagioId);
      if (!estagio || estagioEncerrado(estagio)) throw new ErroDeRegra("Estágio cancelado ou excluído.", "estagio_encerrado");
      if (documentoInicial(documento.templateId)) {
        const formulario = await tx.documentoPreenchido.findFirst({ where: { estagioId: estagio.id, templateId: DOCUMENTOS_INICIAIS[0], situacao: { not: "inativo" } }, orderBy: { id: "asc" } });
        if (!estagio.encaminhadoEm || formulario?.situacao !== "aprovado")
          throw new ErroDeRegra("Aguarde o parecer favorável no Formulário de Liberação.", "parecer_pendente");
      }
    }
    const metadados = documento.definicaoSnapshot?.metadados;
    if (!metadados) throw new ErroDeRegra("Template indisponível.", "template_invalido");
    const problemas = problemasDoDocumento(documento);
    if (problemas.length) throw new ErroDeRegra(problemas[0].mensagem, "documentacao_pendente");
    const assinaturas = documentoInicial(documento.templateId)
      ? metadados.assinaturas ?? []
      : (metadados.assinaturas ?? []).filter((assinatura) => assinatura.tipo === "externa");
    const momento = new Date();
    const pedido = await tx.pedidoEnvioDocumento.create({ data: {
      id: novoId("ped"), documentoId, pedidoPorId: autor.id, situacao: "indisponivel", motivo: TRANSPORTE_INDISPONIVEL,
    } });
    const anteriores = await tx.envioExterno.count({ where: { documentoId } });
    const envios: EnvioExterno[] = [];
    for (let indice = 0; indice < assinaturas.length; indice++) {
      const assinatura = assinaturas[indice];
      const pessoa = await destinatarioDaAssinatura(tx, assinatura, documento, documento.estagioId ?? null);
      const email = pessoa?.email ?? "";
      const erro = email ? TRANSPORTE_INDISPONIVEL : `${TRANSPORTE_INDISPONIVEL} E-mail do assinante também não está cadastrado.`;
      const linha = await tx.envioExterno.create({ data: {
        id: novoId("env"), documentoId, pedidoId: pedido.id,
        destinatario: pessoa?.nome ?? assinatura.rotulo, destinatarioEmail: email,
        destinatarioPapel: assinatura.papel, autorId: autor.id, status: "falha", erro,
        tentativa: anteriores + indice + 1, enviadoEm: momento,
      } });
      envios.push({ id: linha.id, documentoId, destinatario: linha.destinatario, destinatarioEmail: linha.destinatarioEmail,
        destinatarioPapel: linha.destinatarioPapel ?? undefined, autorId: linha.autorId, status: "falha",
        erro: linha.erro ?? undefined, tentativa: linha.tentativa, enviadoEm: linha.enviadoEm!.toISOString() });
    }
    return envios;
  }, { cliente: prisma }, { isolationLevel: "Serializable" });
}

export async function confirmarAssinaturasPersistente(
  estagioId: string,
  autorId: string,
  confirmacoes: { documentoId: string; confirmado: boolean; observacao?: string }[],
) {
  const { prisma } = await carregarCliente();
  const ponteiro = await prisma.estagio.findUnique({ where: { id: estagioId }, select: { alunoId: true } });
  if (!ponteiro) throw new ErroDeRegra("Solicitação não disponível para conferência.", "solicitacao_invalida");
  return executarTransacao(async (tx) => {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${ponteiro.alunoId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM estagios WHERE id = ${estagioId} FOR UPDATE`;
    const autor = await autorAtual(tx, autorId);
    if (autor.papel !== "coordenador_estagio") throw new ErroDeRegra("A conferência cabe ao Coordenador de Estágio.", "acesso_negado");
    if (!(await podeConsultarEstagioNoBanco(tx, autor.id, estagioId))) throw new ErroDeRegra("Solicitação não disponível para conferência.", "acesso_negado");
    const estagio = await buscarEstagio(tx, estagioId);
    if (!estagio || estagio.alunoId !== ponteiro.alunoId || estagioEncerrado(estagio) || estagio.situacao !== "em_preparacao" || estagio.liberadoEm)
      throw new ErroDeRegra("Solicitação não disponível para conferência.", "solicitacao_invalida");
    const linhas = await tx.documentoPreenchido.findMany({ where: { estagioId, templateId: { in: [...DOCUMENTOS_INICIAIS] }, situacao: { not: "inativo" } }, orderBy: { id: "asc" } });
    for (const linha of linhas) await tx.$queryRaw`SELECT id FROM documentos_preenchidos WHERE id = ${linha.id} FOR UPDATE`;
    const documentos = linhas.map(paraDominioDocumento);
    const formulario = documentos.find((doc) => doc.templateId === DOCUMENTOS_INICIAIS[0]);
    if (documentos.length !== DOCUMENTOS_INICIAIS.length || !formulario || formulario.situacao !== "aprovado")
      throw new ErroDeRegra("Aguarde o parecer favorável no Formulário de Liberação.", "parecer_pendente");
    if (confirmacoes.some((item) => !documentos.some((doc) => doc.id === item.documentoId)))
      throw new ErroDeRegra("Documento não pertence à conferência inicial.", "documento_invalido");
    if (documentos.some((doc) => !confirmacoes.some((item) => item.documentoId === doc.id && item.confirmado === true)))
      throw new ErroDeRegra("Confirme as assinaturas dos três documentos iniciais.", "assinatura_pendente");
    for (const documento of documentos) {
      if (!(await podeAcrescentarObservacaoNoBanco(tx, autor.id, documento.id))) throw new ErroDeRegra("Documento não disponível.", "acesso_negado");
    }
    const momento = new Date();
    for (const documento of documentos) {
      const confirmacao = confirmacoes.find((item) => item.documentoId === documento.id);
      const atualizado = await tx.documentoPreenchido.updateMany({
        where: { id: documento.id, situacao: { not: "inativo" } },
        data: { assinaturasConfirmadasEm: momento, assinaturasConfirmadasPorId: autor.id, atualizadoEm: momento },
      });
      if (atualizado.count !== 1) throw new ErroDeRegra("Documento alterado por outra operação.", "conflito_concorrente");
      const texto = confirmacao?.observacao?.trim();
      if (texto) await tx.observacaoDocumento.create({ data: { id: novoId("obs"), documentoId: documento.id, conteudo: texto, autorId: autor.id, data: momento } });
    }
    const liberado = await tx.estagio.updateMany({
      where: { id: estagioId, situacao: "em_preparacao", liberadoEm: null, canceladoEm: null, excluidoEm: null },
      data: { situacao: "em_andamento", liberadoEm: momento, liberadoPorId: autor.id },
    });
    if (liberado.count !== 1) throw new ErroDeRegra("Estágio alterado por outra operação.", "conflito_concorrente");
    return paraDominioEstagio((await tx.estagio.findUniqueOrThrow({ where: { id: estagioId }, include: { templates: true } })));
  }, { cliente: prisma }, { isolationLevel: "Serializable" });
}
