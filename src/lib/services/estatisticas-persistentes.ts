import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { DocumentoPreenchido, Usuario } from "@/lib/domain/types";
import { carregarCliente } from "@/lib/db/prisma";
import { executarTransacao } from "@/lib/db/transacoes";
import { paraDominioDocumento } from "@/lib/db/repositorios/documentos";
import { paraDominioEstagio } from "@/lib/db/repositorios/estagios";
import { DESCRITORES } from "@/lib/templates/descriptors";
import { ErroDeRegra } from "./erros";
import { paraConvenio } from "./catalogo";
import { paraDominioLancamento } from "./lancamentos-persistentes";
import {
  calcularPesquisa,
  documentosDoIndicadorNoConjunto,
  montarRecorte,
  type AlunoEstatistica,
  type DadosEstatisticas,
  type FiltrosEstatisticas,
  type PesquisaEstatisticas,
  type RecorteEstatisticas,
} from "./estatisticas";

/**
 * Versão persistente da pesquisa de estatísticas (12.1). O recorte é aplicado
 * nas consultas ao banco, e não depois da leitura: um coordenador de curso nunca
 * recebe linhas, documentos ou lançamentos de outro curso. Tudo é lido numa
 * transação RepeatableRead, para que indicador e lista usem o mesmo conjunto.
 */

/** Estágios do recorte. Preparação conta aqui; a exclusão de contexto é aplicada pelo cálculo. */
function filtroDeEstagios(recorte: RecorteEstatisticas): Prisma.EstagioWhereInput {
  const ativos: Prisma.EstagioWhereInput = { canceladoEm: null, excluidoEm: null };
  if (recorte.escopo !== "curso") return ativos;
  if (!recorte.cursoId) throw new ErroDeRegra("Estatísticas indisponíveis para este usuário.", "acesso_negado");

  return { ...ativos, aluno: { dadosPessoaisAluno: { cursoId: recorte.cursoId } } };
}

async function carregarDados(tx: Prisma.TransactionClient, recorte: RecorteEstatisticas): Promise<DadosEstatisticas> {
  const filtro = filtroDeEstagios(recorte);

  const linhasEstagio = await tx.estagio.findMany({
    where: filtro,
    include: {
      templates: true,
      supervisor: true,
      orientador: true,
      aluno: { include: { dadosPessoaisAluno: { include: { curso: true, turma: true, periodo: true } } } },
    },
  });

  const alunos = new Map<string, AlunoEstatistica>();
  const cursos = new Map<string, string>();
  const turmas = new Map<string, string>();
  const periodos = new Map<string, string>();
  const pessoas = new Map<string, string>();

  for (const linha of linhasEstagio) {
    const dados = linha.aluno.dadosPessoaisAluno;
    alunos.set(linha.aluno.id, {
      id: linha.aluno.id,
      nome: linha.aluno.nome,
      situacao: linha.aluno.situacao as Usuario["situacao"],
      cursoId: dados?.cursoId,
      turmaId: dados?.turmaId,
      periodoId: dados?.periodoId,
    });
    if (dados) {
      cursos.set(dados.cursoId, dados.curso.nome);
      turmas.set(dados.turmaId, dados.turma.nome);
      periodos.set(dados.periodoId, dados.periodo.rotulo);
    }
    pessoas.set(linha.supervisor.id, linha.supervisor.nome);
    pessoas.set(linha.orientador.id, linha.orientador.nome);
  }

  const convenios = await tx.convenio.findMany({
    where: recorte.escopo === "curso" ? { estagios: { some: filtro } } : {},
    include: { instituicao: true },
  });

  const lancamentos = await tx.lancamentoHoras.findMany({ where: { estagio: { is: filtro } } });

  const documentos = await tx.documentoPreenchido.findMany({
    where: { situacao: { not: "inativo" }, estagio: { is: filtro } },
  });

  const pareceres = await tx.parecer.findMany({
    where: { documento: { estagio: { is: filtro } } },
    select: { documentoId: true },
  });

  return {
    estagios: linhasEstagio.map((linha) => paraDominioEstagio(linha)),
    alunos,
    convenios: convenios.map((linha) => paraConvenio(linha)),
    pessoas,
    cursos,
    turmas,
    periodos,
    lancamentos: lancamentos.map(paraDominioLancamento),
    documentos: documentos.map(paraDominioDocumento),
    templates: new Map(
      DESCRITORES.map((descritor) => [
        descritor.templateId,
        { nome: descritor.titulo, tipoParecer: descritor.metadados?.tipoParecer },
      ]),
    ),
    documentosComParecer: new Set(pareceres.map((parecer) => parecer.documentoId)),
  };
}

/** Recorte com o nome do curso lido do banco, na mesma transação da pesquisa. */
async function recorteNoBanco(tx: Prisma.TransactionClient, usuario: Usuario): Promise<RecorteEstatisticas> {
  const curso =
    usuario.papel === "coordenador_curso" && usuario.cursoId
      ? await tx.curso.findUnique({ where: { id: usuario.cursoId }, select: { nome: true } })
      : null;

  return montarRecorte(usuario, curso?.nome);
}

async function executarLeitura<T>(
  usuario: Usuario,
  operacao: (recorte: RecorteEstatisticas, dados: DadosEstatisticas) => T,
): Promise<T> {
  const { prisma } = await carregarCliente();

  return executarTransacao(
    async (tx) => {
      const recorte = await recorteNoBanco(tx, usuario);
      const dados = await carregarDados(tx, recorte);
      return operacao(recorte, dados);
    },
    { cliente: prisma },
    { isolationLevel: "RepeatableRead" },
  );
}

export async function pesquisarEstatisticasPersistentes(
  usuario: Usuario,
  filtros: FiltrosEstatisticas = {},
): Promise<PesquisaEstatisticas> {
  return executarLeitura(usuario, (recorte, dados) => calcularPesquisa(recorte, dados, filtros));
}

export async function documentosDoIndicadorPersistente(
  usuario: Usuario,
  templateId: string,
  filtros: FiltrosEstatisticas = {},
): Promise<{ documento: DocumentoPreenchido; alunoNome: string; estagioId?: string }[]> {
  return executarLeitura(usuario, (recorte, dados) =>
    documentosDoIndicadorNoConjunto(calcularPesquisa(recorte, dados, filtros), dados, templateId),
  );
}
