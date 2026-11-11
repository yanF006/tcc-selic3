import "server-only";

import { ZodError } from "zod";
import { esquemaEstagio } from "@/lib/domain/schemas";
import { DOCUMENTOS_INICIAIS, documentoInicial } from "@/lib/domain/fluxo-estagio";
import type { Estagio, Usuario } from "@/lib/domain/types";
import { carregarCliente } from "@/lib/db/prisma";
import { executarTransacao } from "@/lib/db/transacoes";
import { paraDominioEstagio } from "@/lib/db/repositorios/estagios";
import { criarRascunhoPersistente } from "./documentos-persistentes";
import { valoresDoPreenchimento, validarValores } from "./documentos";
import type { NovoEstagio } from "./estagios";
import { ErroDeRegra } from "./erros";
import { novoId } from "./store";
import type { Prisma } from "@/generated/prisma/client";
import { buscarEstagio, podeConsultarEstagioNoBanco } from "@/lib/db/repositorios/estagios";
import { estagioEncerrado, estagioLiberado } from "@/lib/domain/fluxo-estagio";
import { definicaoKit } from "@/lib/templates/manifesto";
import { atualizarDocumentosIniciaisPersistentes } from "./documentos-persistentes";

/** Toda mutação usa a mesma ordem de locks da criação: aluno, estágio, documentos. */
async function alterarEstagio<T>(estagioId: string, autorId: string | undefined,
  operacao: (tx: Prisma.TransactionClient, estagio: Estagio, autor: { id: string; papel: string }) => Promise<T>,
): Promise<T> {
  if (!autorId) throw new ErroDeRegra("Autor autenticado obrigatório.", "acesso_negado");
  const { prisma } = await carregarCliente();
  const ponteiro = await prisma.estagio.findUnique({ where: { id: estagioId }, select: { alunoId: true } });
  if (!ponteiro) throw new ErroDeRegra("Estágio não disponível.", "acesso_negado");
  return executarTransacao(async (tx) => {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${ponteiro.alunoId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM estagios WHERE id = ${estagioId} FOR UPDATE`;
    const estagio = await buscarEstagio(tx, estagioId);
    const autor = await tx.usuario.findUnique({ where: { id: autorId } });
    if (!estagio || estagio.alunoId !== ponteiro.alunoId || !autor || !(await podeConsultarEstagioNoBanco(tx, autorId, estagioId)) || estagioEncerrado(estagio)) throw new ErroDeRegra("Estágio não disponível para esta operação.", "acesso_negado");
    return operacao(tx, estagio, autor);
  }, { cliente: prisma });
}

function exigirSelecao(estagio: Estagio) {
  if (!estagioLiberado(estagio) || estagio.situacao !== "em_andamento") throw new ErroDeRegra("A seleção exige estágio liberado e em andamento.", "liberacao_pendente");
}

export async function selecionarDocumentosPersistentes(estagioId: string, templateIds: string[], autorId?: string): Promise<Estagio> {
  return alterarEstagio(estagioId, autorId, async (tx, estagio) => {
    exigirSelecao(estagio);
    const selecionados = [...new Set([...DOCUMENTOS_INICIAIS, ...templateIds])];
    for (const id of selecionados) {
      const definicao = definicaoKit(id);
      if (!definicao || definicao.tipo !== "preenchivel" || !definicao.descritor.metadados?.papeisPreenchimento.includes("aluno")) throw new ErroDeRegra("Selecione documentos preenchíveis permitidos ao aluno.", "documento_invalido");
    }
    await tx.estagioTemplate.deleteMany({ where: { estagioId, templateId: { notIn: selecionados } } });
    await tx.estagioTemplate.createMany({ data: selecionados.map((templateId) => ({ estagioId, templateId })), skipDuplicates: true });
    return (await buscarEstagio(tx, estagioId))!;
  });
}

export async function removerDocumentoPersistente(estagioId: string, templateId: string, autorId?: string): Promise<Estagio> {
  return alterarEstagio(estagioId, autorId, async (tx, estagio) => {
    if (documentoInicial(templateId)) throw new ErroDeRegra("Os documentos iniciais são obrigatórios.", "documento_obrigatorio");
    exigirSelecao(estagio);
    await tx.estagioTemplate.deleteMany({ where: { estagioId, templateId } });
    const agora = new Date();
    await tx.documentoPreenchido.updateMany({ where: { estagioId, templateId, situacao: { not: "inativo" } }, data: { situacao: "inativo", inativadoEm: agora, atualizadoEm: agora } });
    return (await buscarEstagio(tx, estagioId))!;
  });
}

export async function alterarSituacaoPersistente(estagioId: string, situacao: "concluido" | "em_andamento", autorId?: string): Promise<Estagio> {
  return alterarEstagio(estagioId, autorId, async (tx, estagio, autor) => {
    if (autor.papel !== "coordenador_curso" && autor.papel !== "coordenador_estagio") throw new ErroDeRegra("A alteração da situação cabe à coordenação.", "acesso_negado");
    const anterior = situacao === "concluido" ? "em_andamento" : "concluido";
    if (!estagioLiberado(estagio) || estagio.situacao !== anterior) throw new ErroDeRegra("A alteração exige estágio liberado na situação correspondente.", "liberacao_pendente");
    if (situacao === "concluido" && estagio.dataFim > new Date().toISOString().slice(0, 10)) throw new ErroDeRegra("Estágio concluído não pode ter data final futura.", "data_final_futura");
    esquemaEstagio().parse({ ...estagio, situacao });
    await tx.estagio.update({ where: { id: estagioId }, data: { situacao, editadoPorId: autor.id, editadoEm: new Date() } });
    return (await buscarEstagio(tx, estagioId))!;
  });
}

export async function editarEstagioPersistente(estagioId: string, dados: Partial<NovoEstagio>, autorId?: string): Promise<Estagio> {
  return alterarEstagio(estagioId, autorId, async (tx, estagio, autor) => {
    if (dados.situacao !== undefined && dados.situacao !== estagio.situacao) throw new ErroDeRegra("Use a ação da coordenação para alterar a situação.", "situacao_nao_permitida");
    if (autor.id === estagio.alunoId) {
      const correcao = await tx.documentoPreenchido.count({ where: { estagioId, templateId: DOCUMENTOS_INICIAIS[0], OR: [{ situacao: "indeferido" }, { situacao: "rascunho", correcaoAberta: true }] } });
      if (estagio.situacao !== "em_preparacao" || !correcao) throw new ErroDeRegra("Os dados iniciais só podem ser corrigidos após indeferimento.", "dados_iniciais_bloqueados");
    }
    const validado = esquemaEstagio().parse({ ...estagio, ...dados });
    if (validado.cargaHorariaPrevista !== undefined && !Number.isSafeInteger(validado.cargaHorariaPrevista * 60)) throw new ErroDeRegra("Informe duração prevista em minutos inteiros.", "carga_horaria_invalida");
    const convenio = await tx.convenio.findUnique({ where: { id: validado.convenioId }, include: { instituicao: true } });
    if (!convenio || (convenio.id !== estagio.convenioId && (convenio.situacao !== "ativo" || convenio.instituicao.situacao !== "ativo" || convenio.fimVigencia.toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10)))) throw new ErroDeRegra("Selecione um convênio ativo.", "convenio_invalido");
    const supervisor = await tx.pessoa.findUnique({ where: { id: validado.supervisorId } });
    const orientador = await tx.pessoa.findUnique({ where: { id: validado.orientadorId } });
    if (!supervisor || supervisor.papel !== "supervisor" || (supervisor.id !== estagio.supervisorId && supervisor.situacao !== "ativo") || !orientador || orientador.papel !== "orientador" || (orientador.id !== estagio.orientadorId && orientador.situacao !== "ativo")) throw new ErroDeRegra("Selecione supervisor e orientador cadastrados.", "pessoa_invalida");
    const inicio = new Date(`${validado.dataInicio}T00:00:00.000Z`);
    const fim = new Date(`${validado.dataFim}T00:00:00.000Z`);
    const conflito = await tx.estagio.count({ where: { id: { not: estagioId }, alunoId: estagio.alunoId, canceladoEm: null, excluidoEm: null, dataInicio: { lte: fim }, dataFim: { gte: inicio } } });
    if (conflito) throw new ErroDeRegra("O período conflita com um estágio já cadastrado.", "periodo_conflictante");
    const lancamentos = await tx.lancamentoHoras.count({ where: { estagioId, OR: [{ data: { lt: inicio } }, { data: { gt: fim } }] } });
    if (lancamentos) throw new ErroDeRegra("O período deve incluir os lançamentos já registrados.", "periodo_com_lancamentos");
    await tx.estagio.update({ where: { id: estagioId }, data: {
      convenioId: validado.convenioId, supervisorId: validado.supervisorId, orientadorId: validado.orientadorId,
      dataInicio: inicio, dataFim: fim, editadoPorId: autor.id, editadoEm: new Date(),
      ...(validado.cargaHorariaPrevista !== undefined ? { cargaHorariaPrevistaMinutos: validado.cargaHorariaPrevista * 60 } : {}),
    } });
    await atualizarDocumentosIniciaisPersistentes(tx, estagioId, estagio.alunoId, autor.id, dados.valoresDocumentos ?? {}, { preparar: valoresDoPreenchimento, validar: validarValores }, dados.cargaHorariaPrevista);
    return (await buscarEstagio(tx, estagioId))!;
  });
}

export async function criarEstagioPersistente(autor: Usuario, dados: NovoEstagio): Promise<Estagio> {
  if (dados.situacao !== undefined && dados.situacao !== "em_preparacao") throw new ErroDeRegra("A situação inicial não pode ser escolhida pelo aluno.", "situacao_nao_permitida");
  if (dados.documentosSelecionados?.some((id) => !documentoInicial(id))) throw new ErroDeRegra("Os demais documentos dependem da liberação do estágio.", "liberacao_pendente");
  const parsed = esquemaEstagio().parse({ ...dados, situacao: "em_preparacao" });
  const horas = dados.cargaHorariaPrevista;
  if (horas !== undefined && (!Number.isFinite(horas) || horas < 0 || !Number.isSafeInteger(horas * 60))) throw new ErroDeRegra("Informe a carga horária prevista em minutos inteiros.", "carga_horaria_invalida");
  const { prisma } = await carregarCliente();
  return executarTransacao(async (tx) => {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${autor.id} FOR UPDATE`;
    const aluno = await tx.usuario.findUnique({ where: { id: autor.id }, include: { dadosPessoaisAluno: { include: { curso: true, turma: true, periodo: true } } } });
    if (!aluno || aluno.situacao !== "ativo" || aluno.papel !== "aluno") throw new ErroDeRegra("Apenas alunos ativos cadastram estágios.", "papel_invalido");
    const convenio = await tx.convenio.findUnique({ where: { id: parsed.convenioId }, include: { instituicao: true } });
    if (!convenio) throw new ErroDeRegra("Convênio não encontrado.", "convenio_inexistente");
    if (convenio.situacao !== "ativo" || convenio.instituicao.situacao !== "ativo") throw new ErroDeRegra("Selecione um convênio e instituição ativos.", "convenio_inativo");
    if (convenio.fimVigencia.toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10)) throw new ErroDeRegra("Convênio vencido: registre a renovação antes de iniciar o estágio.", "convenio_expirado");
    const supervisor = await tx.pessoa.findUnique({ where: { id: parsed.supervisorId } });
    if (!supervisor || supervisor.papel !== "supervisor" || supervisor.situacao !== "ativo") throw new ErroDeRegra("Supervisor inativo ou não cadastrado.", "supervisor_invalido");
    const orientador = await tx.pessoa.findUnique({ where: { id: parsed.orientadorId } });
    if (!orientador || orientador.papel !== "orientador" || orientador.situacao !== "ativo") throw new ErroDeRegra("Orientador não cadastrado.", "orientador_invalido");
    const academicos = aluno.dadosPessoaisAluno;
    if (!academicos || academicos.curso.situacao !== "ativo" || academicos.turma.situacao !== "ativo" || academicos.periodo.situacao !== "ativo" || academicos.turma.cursoId !== academicos.cursoId ||
      !(await tx.turmaPeriodo.findUnique({ where: { turmaId_periodoId: { turmaId: academicos.turmaId, periodoId: academicos.periodoId } } }))) throw new ErroDeRegra("Revise os vínculos acadêmicos ativos do aluno.", "vinculo_academico_invalido");
    const conflito = await tx.estagio.findFirst({ where: { alunoId: aluno.id, canceladoEm: null, excluidoEm: null, dataInicio: { lte: new Date(`${parsed.dataFim}T00:00:00.000Z`) }, dataFim: { gte: new Date(`${parsed.dataInicio}T00:00:00.000Z`) } }, select: { id: true } });
    if (conflito) throw new ErroDeRegra("O período conflita com um estágio já cadastrado.", "periodo_conflictante");
    const estagio = await tx.estagio.create({ data: {
      id: novoId("est"), alunoId: aluno.id, convenioId: convenio.id, supervisorId: supervisor.id, orientadorId: orientador.id,
      dataInicio: new Date(`${parsed.dataInicio}T00:00:00.000Z`), dataFim: new Date(`${parsed.dataFim}T00:00:00.000Z`), situacao: "em_preparacao",
      cargaHorariaPrevistaMinutos: horas === undefined ? null : horas * 60, nomeAlunoHistorico: aluno.nome, cursoIdHistorico: academicos.cursoId,
      templates: { create: DOCUMENTOS_INICIAIS.map((templateId) => ({ templateId })) },
    }, include: { templates: true } });
    for (const templateId of DOCUMENTOS_INICIAIS) {
      const documento = await criarRascunhoPersistente(autor, templateId, estagio.id, dados.valoresDocumentos?.[templateId] ?? {}, { preparar: valoresDoPreenchimento, validar: validarValores }, tx);
      const problemas = validarValores(templateId, documento.valores, documento.versaoTemplate, documento.definicaoSnapshot);
      if (problemas.length) throw new ZodError(problemas.map((problema) => ({ code: "custom" as const, path: ["valoresDocumentos", templateId, problema.campo], message: problema.mensagem })));
    }
    return paraDominioEstagio(estagio);
  }, { cliente: prisma });
}
