import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { DocumentoPreenchido, Usuario } from "@/lib/domain/types";
import { esquemaEndereco } from "@/lib/domain/schemas";
import { documentoInicial, estagioEncerrado, estagioLiberado, DOCUMENTOS_INICIAIS } from "@/lib/domain/fluxo-estagio";
import { carregarCliente } from "@/lib/db/prisma";
import { executarTransacao } from "@/lib/db/transacoes";
import { paraDominioUsuario } from "@/lib/db/mapeadores/usuarios";
import { paraDominioEstagio, podeConsultarEstagioNoBanco } from "@/lib/db/repositorios/estagios";
import { buscarDocumento, paraDominioDocumento } from "@/lib/db/repositorios/documentos";
import { definicaoKit } from "@/lib/templates/manifesto";
import { camposDoTemplate, classificacaoDoCampo, fonteParecer, type DescriptorDocumento } from "@/lib/templates/descriptors";
import type { ContextoPreenchimento, ProblemaValidacao } from "./documentos";
import { ErroDeRegra } from "./erros";
import { novoId } from "./store";

interface RegrasPreenchimento {
  preparar(templateId: string, aluno: Usuario, estagioId: string | undefined, valores: Record<string, unknown>, versao: number | undefined, contexto: ContextoPreenchimento): Promise<Record<string, unknown>>;
  validar(templateId: string, valores: Record<string, unknown>, versao?: number, snapshot?: DescriptorDocumento): ProblemaValidacao[];
}

export class ErroValidacaoDocumento extends ErroDeRegra {
  constructor(readonly problemas: ProblemaValidacao[]) {
    super(problemas[0]?.mensagem ?? "Revise os campos do documento.", "valores_invalidos");
  }
}

async function autorAtual(tx: Prisma.TransactionClient, autorId: string): Promise<Usuario> {
  const linha = await tx.usuario.findUnique({ where: { id: autorId } });
  if (!linha || linha.situacao !== "ativo") throw new ErroDeRegra("Acesso não permitido.", "acesso_negado");
  return paraDominioUsuario({ ...linha, dadosPessoais: null });
}

function exigirPreenchimento(autor: Usuario, descritor: DescriptorDocumento) {
  if (!descritor.preenchivel || !descritor.metadados || (autor.papel !== "administrador" && !descritor.metadados.papeisPreenchimento.includes(autor.papel))) {
    throw new ErroDeRegra("Documento não disponível para este perfil.", "acesso_negado");
  }
}

async function contextoDoBanco(tx: Prisma.TransactionClient, alunoId: string, estagioId: string | undefined, descritor: DescriptorDocumento) {
  const aluno = await tx.usuario.findUnique({ where: { id: alunoId }, include: { dadosPessoaisAluno: { include: { curso: true, turma: true, periodo: true } } } });
  if (!aluno || aluno.situacao !== "ativo") throw new ErroDeRegra("Cadastro do titular inativo ou indisponível.", "titular_indisponivel");
  const dados = aluno.dadosPessoaisAluno;
  const titular: Usuario = {
    ...paraDominioUsuario({ ...aluno, dadosPessoais: null }),
    dadosPessoais: dados ? {
      nomeCompleto: aluno.nome, email: aluno.email, cpf: dados.cpf, rg: dados.rg,
      dataNascimento: dados.dataNascimento.toISOString().slice(0, 10), telefone: dados.telefone,
      celular: dados.celular, endereco: esquemaEndereco.parse(dados.endereco),
      cursoId: dados.cursoId, turmaId: dados.turmaId, periodoId: dados.periodoId,
    } : undefined,
  };
  const linha = estagioId ? await tx.estagio.findUnique({ where: { id: estagioId }, include: { templates: true, convenio: { include: { instituicao: true } }, supervisor: true, orientador: true } }) : null;
  if (estagioId && (!linha || linha.alunoId !== alunoId)) throw new ErroDeRegra("Vínculo de estágio inválido.", "estagio_invalido");
  const contexto: ContextoPreenchimento = {
    descritor, estagio: linha ? paraDominioEstagio(linha) : null,
    curso: dados?.curso ?? null, turma: dados?.turma ?? null, periodo: dados?.periodo ?? null,
    convenio: linha ? { instituicao: linha.convenio.instituicao.nome } : null,
    supervisor: linha?.supervisor ?? null, orientador: linha?.orientador ?? null,
  };
  return { titular, contexto };
}

function validarEtapa(templateId: string, contexto: ContextoPreenchimento) {
  const estagio = contexto.estagio;
  if (contexto.descritor.metadados?.exigeEstagio && !estagio) throw new ErroDeRegra("Selecione um estágio válido.", "estagio_obrigatorio");
  if (estagio && (estagioEncerrado(estagio) || (!documentoInicial(templateId) && !estagioLiberado(estagio)))) {
    throw new ErroDeRegra("O estágio aguarda liberação ou está cancelado/excluído.", "liberacao_pendente");
  }
}

function digitados(descritor: DescriptorDocumento, valores: Record<string, unknown>) {
  const permitidos = new Set(camposDoTemplate(descritor.templateId, descritor)
    .filter((campo) => classificacaoDoCampo(campo) === "campo" && !fonteParecer(descritor.templateId, campo)).map((campo) => campo.id));
  // Campos compostos de endereço são recalculados a partir dos componentes editáveis.
  return Object.fromEntries(Object.entries(valores).filter(([id]) => permitidos.has(id)));
}

function validarPreenchimento(regras: RegrasPreenchimento, descritor: DescriptorDocumento, valores: Record<string, unknown>, completo: boolean) {
  const problemas = regras.validar(descritor.templateId, valores, undefined, descritor).filter((problema) => {
    const valor = valores[problema.campo];
    return completo || (valor !== undefined && valor !== null && valor !== "" && valor !== false && !(Array.isArray(valor) && valor.length === 0));
  });
  if (problemas.length) throw new ErroValidacaoDocumento(problemas);
}

export async function podeConsultarDocumentoNoBanco(autorId: string, documentoId: string, transacao?: Prisma.TransactionClient): Promise<boolean> {
  const cliente = transacao ?? (await carregarCliente()).prisma;
  const documento = await cliente.documentoPreenchido.findUnique({ where: { id: documentoId }, include: { aluno: true } });
  if (!documento) return false;
  if (documento.estagioId) return podeConsultarEstagioNoBanco(cliente, autorId, documento.estagioId);
  const autor = await cliente.usuario.findUnique({ where: { id: autorId } });
  return Boolean(autor && autor.situacao === "ativo" && (documento.alunoId === autor.id || ((autor.papel === "administrador" || autor.papel === "coordenador_estagio") && autor.campus === documento.aluno.campus)));
}

export async function criarRascunhoPersistente(autor: Usuario, templateId: string, estagioId: string | undefined, valores: Record<string, unknown>, regras: RegrasPreenchimento, transacao?: Prisma.TransactionClient): Promise<DocumentoPreenchido> {
  const definicao = definicaoKit(templateId);
  const prisma = transacao ?? (await carregarCliente()).prisma;
  // A leitura inicial apenas localiza o agregado; vínculo e acesso são revalidados na transação.
  const ponteiro = estagioId ? await prisma.estagio.findUnique({ where: { id: estagioId }, select: { alunoId: true } }) : null;
  if (estagioId && !ponteiro) throw new ErroDeRegra("Estágio não disponível.", "estagio_invalido");
  const titularId = ponteiro?.alunoId ?? autor.id;
  return executarTransacao(async (tx) => {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${titularId} FOR UPDATE`;
    const atual = await autorAtual(tx, autor.id);
    if (estagioId && !(await podeConsultarEstagioNoBanco(tx, atual.id, estagioId))) throw new ErroDeRegra("Estágio não disponível para este usuário.", "acesso_negado");
    const existente = await tx.documentoPreenchido.findFirst({ where: { templateId, alunoId: titularId, estagioId: estagioId ?? null, situacao: { not: "inativo" } }, orderBy: [{ criadoEm: "asc" }, { id: "asc" }] });
    if (existente) {
      const salvo = paraDominioDocumento(existente);
      exigirPreenchimento(atual, salvo.definicaoSnapshot!);
      return salvo;
    }
    if (!definicao || definicao.tipo !== "preenchivel") throw new ErroDeRegra("Definição preenchível não encontrada.", "definicao_indisponivel");
    exigirPreenchimento(atual, definicao.descritor);
    const { titular, contexto } = await contextoDoBanco(tx, titularId, estagioId, definicao.descritor);
    validarEtapa(templateId, contexto);
    const versao = definicao.arquivos.find((arquivo) => arquivo.vigente)?.versao;
    if (!versao) throw new ErroDeRegra("Definição indisponível.", "definicao_indisponivel");
    const preparados = await regras.preparar(templateId, titular, estagioId, digitados(definicao.descritor, valores), versao, contexto);
    if (contexto.estagio && templateId === "tpl-termo-compromisso") preparados.cargaHorariaTotal = contexto.estagio.cargaHorariaPrevista ?? "";
    validarPreenchimento(regras, definicao.descritor, preparados, false);
    const linha = await tx.documentoPreenchido.create({ data: {
      id: novoId("doc"), templateId, alunoId: titularId, estagioId: estagioId ?? null,
      versaoTemplate: versao, definicaoChecksum: definicao.checksum,
      definicaoSnapshot: definicao.descritor as unknown as Prisma.InputJsonValue,
      valores: JSON.parse(JSON.stringify(preparados)) as Prisma.InputJsonValue, situacao: "rascunho",
    } });
    return paraDominioDocumento(linha);
  }, transacao ? { transacao } : { cliente: prisma as import("@/generated/prisma/client").PrismaClient }, { isolationLevel: "Serializable" });
}

export async function salvarRascunhoPersistente(documentoId: string, valores: Record<string, unknown>, autor: Usuario | undefined, regras: RegrasPreenchimento, completo = false): Promise<DocumentoPreenchido> {
  if (!autor) throw new ErroDeRegra("Autor autenticado obrigatório.", "acesso_negado");
  const { prisma } = await carregarCliente();
  const ponteiro = await prisma.documentoPreenchido.findUnique({ where: { id: documentoId }, select: { alunoId: true } });
  if (!ponteiro) throw new ErroDeRegra("Documento não encontrado.", "nao_encontrado");
  return executarTransacao(async (tx) => {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${ponteiro.alunoId} FOR UPDATE`;
    const atual = await autorAtual(tx, autor.id);
    if (!(await podeConsultarDocumentoNoBanco(atual.id, documentoId, tx))) throw new ErroDeRegra("Documento não disponível para este usuário.", "acesso_negado");
    const documento = await buscarDocumento(tx, documentoId);
    if (!documento || documento.alunoId !== ponteiro.alunoId) throw new ErroDeRegra("Documento não disponível.", "nao_encontrado");
    const descritor = documento.definicaoSnapshot!;
    exigirPreenchimento(atual, descritor);
    if (documento.situacao !== "rascunho") throw new ErroDeRegra("Somente rascunhos podem ser editados.", "situacao_invalida");
    const { titular, contexto } = await contextoDoBanco(tx, documento.alunoId, documento.estagioId, descritor);
    validarEtapa(documento.templateId, contexto);
    if (contexto.estagio && documentoInicial(documento.templateId)) {
      const correcao = await tx.documentoPreenchido.count({ where: { estagioId: contexto.estagio.id, templateId: DOCUMENTOS_INICIAIS[0], OR: [{ situacao: "indeferido" }, { situacao: "rascunho", correcaoAberta: true }] } });
      if (contexto.estagio.situacao !== "em_preparacao" || !correcao) throw new ErroDeRegra("Os documentos iniciais só podem ser corrigidos após indeferimento.", "dados_iniciais_bloqueados");
    }
    const preparados = await regras.preparar(documento.templateId, titular, documento.estagioId,
      { ...documento.valores, ...digitados(descritor, valores) }, documento.versaoTemplate, contexto);
    validarPreenchimento(regras, descritor, preparados, completo);
    const resultado = await tx.documentoPreenchido.updateMany({ where: { id: documentoId, situacao: "rascunho" }, data: { valores: JSON.parse(JSON.stringify(preparados)) as Prisma.InputJsonValue, atualizadoEm: new Date() } });
    if (resultado.count !== 1) throw new ErroDeRegra("Documento alterado por outra operação.", "conflito_concorrencia");
    return (await buscarDocumento(tx, documentoId))!;
  }, { cliente: prisma }, { isolationLevel: "Serializable" });
}

/** Composição da edição de estágio: mesma transação, definição salva e pareceres preservados. */
export async function atualizarDocumentosIniciaisPersistentes(
  tx: Prisma.TransactionClient, estagioId: string, alunoId: string, autorId: string,
  entradas: Record<string, Record<string, unknown>>, regras: RegrasPreenchimento,
  cargaHoraria?: number,
) {
  const linhas = await tx.documentoPreenchido.findMany({ where: { estagioId, templateId: { in: [...DOCUMENTOS_INICIAIS] }, situacao: { not: "inativo" } }, orderBy: { id: "asc" } });
  for (const linha of linhas) {
    await tx.$queryRaw`SELECT id FROM documentos_preenchidos WHERE id = ${linha.id} FOR UPDATE`;
    const documento = paraDominioDocumento(linha);
    const descritor = documento.definicaoSnapshot!;
    const { titular, contexto } = await contextoDoBanco(tx, alunoId, estagioId, descritor);
    const valores = await regras.preparar(documento.templateId, titular, estagioId,
      { ...documento.valores, ...digitados(descritor, entradas[documento.templateId] ?? {}) }, documento.versaoTemplate, contexto);
    if (documento.templateId === "tpl-termo-compromisso" && cargaHoraria !== undefined) valores.cargaHorariaTotal = cargaHoraria;
    validarPreenchimento(regras, descritor, valores, false);
    const correcao = autorId === alunoId && documento.situacao === "indeferido";
    await tx.documentoPreenchido.update({ where: { id: documento.id }, data: {
      valores: JSON.parse(JSON.stringify(valores)) as Prisma.InputJsonValue,
      ...(correcao ? { situacao: "rascunho", correcaoAberta: true } : {}), atualizadoEm: new Date(),
    } });
  }
}
