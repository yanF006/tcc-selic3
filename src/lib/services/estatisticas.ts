import { lancamentosEfetivos } from "@/lib/domain/horas";
import { cursoDoUsuario } from "@/lib/domain/usuario";
import type {
  Convenio,
  DocumentoPreenchido,
  Estagio,
  LancamentoHoras,
  SituacaoEstagio,
  Usuario,
} from "@/lib/domain/types";

import { classificacaoConvenio } from "./catalogo";
import { ErroDeRegra } from "./erros";
import { obterEstado } from "./store";

/**
 * Estatísticas de estágio (bloco 12). Tudo é calculado sobre o estado
 * consultado; o recorte por papel limita os alunos antes de qualquer soma.
 */

export interface RecorteEstatisticas {
  escopo: "campus" | "curso";
  titulo: string;
  cursoId?: string;
}

export type FiltroSituacaoEstatistica = SituacaoEstagio | "todas";

export interface FiltrosEstatisticas {
  aluno?: string;
  orientador?: string;
  supervisor?: string;
  instituicao?: string;
  situacao?: FiltroSituacaoEstatistica;
  cursoId?: string;
  turmaId?: string;
  ano?: number;
  semestre?: 1 | 2;
}

export interface EstagioEstatistica {
  estagio: Estagio;
  alunoNome: string;
  alunoAtivo: boolean;
  cursoId?: string;
  cursoNome: string;
  turmaId?: string;
  turmaNome: string;
  periodoRotulo: string;
  instituicao: string;
  supervisorNome: string;
  orientadorNome: string;
  horas: number;
}

export interface OpcaoFiltro {
  valor: string;
  rotulo: string;
  total: number;
}

export interface OpcoesEstatisticas {
  alunos: OpcaoFiltro[];
  orientadores: OpcaoFiltro[];
  supervisores: OpcaoFiltro[];
  instituicoes: OpcaoFiltro[];
  cursos: OpcaoFiltro[];
  turmas: OpcaoFiltro[];
  anos: number[];
}

export interface GrupoHoras {
  chave: string;
  rotulo: string;
  estagios: number;
  horas: number;
}

export interface TotaisHoras {
  porAluno: GrupoHoras[];
  porCurso: GrupoHoras[];
  porTurma: GrupoHoras[];
  porPeriodo: GrupoHoras[];
  porInstituicao: GrupoHoras[];
}

export interface DocumentosPorTipo {
  templateId: string;
  nome: string;
  emPreenchimento: number;
  aprovados: number;
  indeferidos: number;
  total: number;
}

export interface PendenciaParecer {
  estagioId: string;
  alunoNome: string;
  documentos: number;
}

export interface IndicadoresEstatisticas {
  situacoes: Record<SituacaoEstagio, number>;
  convenios: { ativos: Convenio[]; expirados: Convenio[] };
  documentos: DocumentosPorTipo[];
  aproveitamento: { deferidos: number; indeferidos: number; taxa: number };
  pendencias: PendenciaParecer[];
  totalPendencias: number;
}

export interface PesquisaEstatisticas {
  recorte: RecorteEstatisticas;
  filtros: FiltrosEstatisticas;
  itens: EstagioEstatistica[];
  total: number;
  opcoes: OpcoesEstatisticas;
  indicadores: IndicadoresEstatisticas;
  totaisHoras: TotaisHoras;
}

const CAMPUS = "Pinheiral";

function normalizar(valor: string | undefined): string {
  return (valor ?? "").trim().toLowerCase();
}

function combina(valor: string, filtro: string | undefined): boolean {
  const alvo = normalizar(filtro);

  return !alvo || valor.toLowerCase().includes(alvo);
}

function anoDaData(data: string): number {
  return Number(data.slice(0, 4));
}

function semestreDaData(data: string): 1 | 2 {
  return Number(data.slice(5, 7)) <= 6 ? 1 : 2;
}

/** Recorte de visibilidade do usuário (12.9). */
export function recorteDeEstatisticas(usuario: Usuario): RecorteEstatisticas {
  if (usuario.situacao !== "ativo") {
    throw new ErroDeRegra("Estatísticas indisponíveis para este usuário.", "acesso_negado");
  }

  const campus =
    usuario.papeis.includes("administrador") || usuario.papeis.includes("coordenador_estagio");

  if (!campus) {
    if (usuario.papeis.includes("coordenador_curso") && usuario.cursoId) {
      const curso = obterEstado().cursos.find((registro) => registro.id === usuario.cursoId);

      return {
        escopo: "curso",
        cursoId: usuario.cursoId,
        titulo: `Estatísticas — ${curso?.nome ?? "Curso"}`,
      };
    }

    throw new ErroDeRegra("Estatísticas indisponíveis para este usuário.", "acesso_negado");
  }

  return { escopo: "campus", titulo: `Estatísticas — Campus ${CAMPUS}` };
}

function estagiosDoRecorte(recorte: RecorteEstatisticas): Estagio[] {
  const estado = obterEstado();
  const usuarios = new Map(estado.usuarios.map((usuario) => [usuario.id, usuario]));

  return estado.estagios.filter((estagio) => {
    if (estagio.excluidoEm || estagio.canceladoEm) return false;
    if (recorte.escopo !== "curso") return true;

    const aluno = usuarios.get(estagio.alunoId);
    const cursoId = estagio.cursoIdHistorico ?? (aluno ? cursoDoUsuario(aluno) : undefined);

    return cursoId === recorte.cursoId;
  });
}

function linhasDoRecorte(recorte: RecorteEstatisticas): EstagioEstatistica[] {
  const estado = obterEstado();
  const usuarios = new Map(estado.usuarios.map((usuario) => [usuario.id, usuario]));
  const convenios = new Map(estado.convenios.map((convenio) => [convenio.id, convenio]));
  const pessoas = new Map(estado.pessoas.map((pessoa) => [pessoa.id, pessoa]));
  const cursos = new Map(estado.cursos.map((curso) => [curso.id, curso]));
  const turmas = new Map(estado.turmas.map((turma) => [turma.id, turma]));
  const periodos = new Map(estado.periodos.map((periodo) => [periodo.id, periodo]));
  const lancamentos = new Map<string, LancamentoHoras[]>();

  for (const lancamento of estado.lancamentos) {
    const lista = lancamentos.get(lancamento.estagioId) ?? [];
    lista.push(lancamento);
    lancamentos.set(lancamento.estagioId, lista);
  }

  return estagiosDoRecorte(recorte)
    .map((estagio) => {
      const aluno = usuarios.get(estagio.alunoId);
      const convenio = convenios.get(estagio.convenioId);
      const cursoId = estagio.cursoIdHistorico ?? (aluno ? cursoDoUsuario(aluno) : undefined);
      const turmaId = aluno?.dadosPessoais?.turmaId;
      const periodoId = aluno?.dadosPessoais?.periodoId;
      const horas = lancamentosEfetivos(lancamentos.get(estagio.id) ?? []).reduce(
        (total, item) => total + item.horas,
        0,
      );

      return {
        estagio,
        alunoNome: aluno?.nome ?? estagio.nomeAlunoHistorico ?? "Cadastro excluído",
        alunoAtivo: aluno?.situacao === "ativo",
        cursoId,
        cursoNome: (cursoId ? cursos.get(cursoId)?.nome : undefined) ?? "Curso não informado",
        turmaId,
        turmaNome: (turmaId ? turmas.get(turmaId)?.nome : undefined) ?? "Turma não informada",
        periodoRotulo: (periodoId ? periodos.get(periodoId)?.rotulo : undefined) ?? "—",
        instituicao: convenio?.instituicao ?? "Instituição não informada",
        supervisorNome: pessoas.get(estagio.supervisorId)?.nome ?? "Supervisor não informado",
        orientadorNome: pessoas.get(estagio.orientadorId)?.nome ?? "Orientador não informado",
        horas,
      };
    })
    .sort((a, b) => a.estagio.dataInicio.localeCompare(b.estagio.dataInicio));
}

function aplicaFiltrosDeContexto(
  linhas: EstagioEstatistica[],
  filtros: FiltrosEstatisticas,
): EstagioEstatistica[] {
  return linhas.filter((linha) => {
    if (
      filtros.situacao &&
      filtros.situacao !== "todas" &&
      linha.estagio.situacao !== filtros.situacao
    )
      return false;
    if (filtros.cursoId && linha.cursoId !== filtros.cursoId) return false;
    if (filtros.turmaId && linha.turmaId !== filtros.turmaId) return false;
    if (filtros.ano && anoDaData(linha.estagio.dataInicio) !== filtros.ano) return false;
    if (filtros.semestre && semestreDaData(linha.estagio.dataInicio) !== filtros.semestre)
      return false;

    return true;
  });
}

function aplicaBusca(
  linhas: EstagioEstatistica[],
  filtros: FiltrosEstatisticas,
): EstagioEstatistica[] {
  return linhas.filter(
    (linha) =>
      combina(linha.alunoNome, filtros.aluno) &&
      combina(linha.orientadorNome, filtros.orientador) &&
      combina(linha.supervisorNome, filtros.supervisor) &&
      combina(linha.instituicao, filtros.instituicao),
  );
}

function contarOpcoes(
  linhas: EstagioEstatistica[],
  extrair: (linha: EstagioEstatistica) => { valor?: string; rotulo?: string } | null,
): OpcaoFiltro[] {
  const contagem = new Map<string, OpcaoFiltro>();

  for (const linha of linhas) {
    const opcao = extrair(linha);
    if (!opcao?.valor) continue;

    const atual = contagem.get(opcao.valor) ?? {
      valor: opcao.valor,
      rotulo: opcao.rotulo ?? opcao.valor,
      total: 0,
    };
    atual.total += 1;
    contagem.set(opcao.valor, atual);
  }

  return [...contagem.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

function opcoesDasLinhas(linhas: EstagioEstatistica[]): OpcoesEstatisticas {
  return {
    alunos: contarOpcoes(linhas, (linha) => ({
      valor: linha.alunoNome,
      rotulo: linha.alunoNome,
    })),
    orientadores: contarOpcoes(linhas, (linha) => ({
      valor: linha.orientadorNome,
      rotulo: linha.orientadorNome,
    })),
    supervisores: contarOpcoes(linhas, (linha) => ({
      valor: linha.supervisorNome,
      rotulo: linha.supervisorNome,
    })),
    instituicoes: contarOpcoes(linhas, (linha) => ({
      valor: linha.instituicao,
      rotulo: linha.instituicao,
    })),
    cursos: contarOpcoes(linhas, (linha) =>
      linha.cursoId ? { valor: linha.cursoId, rotulo: linha.cursoNome } : null,
    ),
    turmas: contarOpcoes(linhas, (linha) =>
      linha.turmaId ? { valor: linha.turmaId, rotulo: linha.turmaNome } : null,
    ),
    anos: [...new Set(linhas.map((linha) => anoDaData(linha.estagio.dataInicio)))].sort(
      (a, b) => a - b,
    ),
  };
}

function agruparHoras(
  linhas: EstagioEstatistica[],
  extrair: (linha: EstagioEstatistica) => { chave?: string; rotulo?: string } | null,
): GrupoHoras[] {
  const grupos = new Map<string, GrupoHoras>();

  for (const linha of linhas) {
    const grupo = extrair(linha);
    if (!grupo?.chave) continue;

    const atual = grupos.get(grupo.chave) ?? {
      chave: grupo.chave,
      rotulo: grupo.rotulo ?? grupo.chave,
      estagios: 0,
      horas: 0,
    };
    atual.estagios += 1;
    atual.horas += linha.horas;
    grupos.set(grupo.chave, atual);
  }

  return [...grupos.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

function totaisDeHoras(linhas: EstagioEstatistica[]): TotaisHoras {
  return {
    porAluno: agruparHoras(linhas, (linha) => ({
      chave: linha.alunoNome,
      rotulo: linha.alunoNome,
    })),
    porCurso: agruparHoras(linhas, (linha) => ({
      chave: linha.cursoId,
      rotulo: linha.cursoNome,
    })),
    porTurma: agruparHoras(linhas, (linha) => ({
      chave: linha.turmaId,
      rotulo: linha.turmaNome,
    })),
    porPeriodo: agruparHoras(linhas, (linha) => ({
      chave: linha.periodoRotulo,
      rotulo: linha.periodoRotulo,
    })),
    porInstituicao: agruparHoras(linhas, (linha) => ({
      chave: linha.instituicao,
      rotulo: linha.instituicao,
    })),
  };
}

function documentosDasLinhas(linhas: EstagioEstatistica[]): DocumentoPreenchido[] {
  const ids = new Set(linhas.map((linha) => linha.estagio.id));

  return obterEstado().documentos.filter(
    (documento) =>
      documento.situacao !== "inativo" && documento.estagioId && ids.has(documento.estagioId),
  );
}

function indicadoresDe(
  linhas: EstagioEstatistica[],
  recorte: RecorteEstatisticas,
): IndicadoresEstatisticas {
  const estado = obterEstado();
  const situacoes: Record<SituacaoEstagio, number> = {
    em_preparacao: 0,
    em_andamento: 0,
    concluido: 0,
  };

  for (const linha of linhas) situacoes[linha.estagio.situacao] += 1;

  const conveniosDoRecorte =
    recorte.escopo === "campus"
      ? estado.convenios
      : estado.convenios.filter((convenio) =>
          estado.estagios.some(
            (estagio) =>
              estagio.convenioId === convenio.id &&
              linhas.some((linha) => linha.estagio.id === estagio.id),
          ),
        );
  const ativos = conveniosDoRecorte.filter(
    (convenio) => classificacaoConvenio(convenio) === "ativo",
  );
  const expirados = conveniosDoRecorte.filter(
    (convenio) => classificacaoConvenio(convenio) === "expirado",
  );

  const documentos = documentosDasLinhas(linhas);
  const templates = new Map(estado.templates.map((template) => [template.id, template]));
  const porTipo = new Map<string, DocumentosPorTipo>();

  for (const documento of documentos) {
    const template = templates.get(documento.templateId);
    const atual = porTipo.get(documento.templateId) ?? {
      templateId: documento.templateId,
      nome: template?.nome ?? documento.templateId,
      emPreenchimento: 0,
      aprovados: 0,
      indeferidos: 0,
      total: 0,
    };
    atual.total += 1;
    if (documento.situacao === "aprovado") atual.aprovados += 1;
    else if (documento.situacao === "indeferido") atual.indeferidos += 1;
    else atual.emPreenchimento += 1;
    porTipo.set(documento.templateId, atual);
  }

  const requerimentos = documentos.filter(
    (documento) => documento.templateId === "tpl-requerimento-aproveitamento",
  );
  const deferidos = requerimentos.filter((documento) => documento.situacao === "aprovado").length;
  const indeferidos = requerimentos.filter(
    (documento) => documento.situacao === "indeferido",
  ).length;
  const taxa =
    deferidos + indeferidos === 0
      ? 0
      : Math.round((deferidos / (deferidos + indeferidos)) * 1000) / 10;

  const pendencias: PendenciaParecer[] = [];
  for (const linha of linhas) {
    if (linha.estagio.situacao !== "concluido") continue;

    const documentosDoEstagio = documentos.filter(
      (documento) => documento.estagioId === linha.estagio.id,
    );
    const semParecer = documentosDoEstagio.filter((documento) => {
      const fila = templates.get(documento.templateId)?.metadados?.tipoParecer;
      if (fila !== "coordenador_curso" && fila !== "comissao_estagio") return false;

      return !estado.pareceres.some((parecer) => parecer.documentoId === documento.id);
    });

    if (semParecer.length > 0) {
      pendencias.push({
        estagioId: linha.estagio.id,
        alunoNome: linha.alunoNome,
        documentos: semParecer.length,
      });
    }
  }

  return {
    situacoes,
    convenios: { ativos, expirados },
    documentos: [...porTipo.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    aproveitamento: { deferidos, indeferidos, taxa },
    pendencias,
    totalPendencias: pendencias.reduce((total, item) => total + item.documentos, 0),
  };
}

/**
 * Pesquisa de estágios do recorte do usuário. As contagens de cada filtro são
 * calculadas antes da busca por nome, para orientar a escolha; a preparação
 * aparece na lista e nos filtros, mas não entra nas contagens de andamento e
 * conclusão.
 */
export async function pesquisarEstatisticas(
  usuario: Usuario,
  filtros: FiltrosEstatisticas = {},
): Promise<PesquisaEstatisticas> {
  const recorte = recorteDeEstatisticas(usuario);
  const linhas = linhasDoRecorte(recorte);
  const base = aplicaFiltrosDeContexto(linhas, filtros);
  const itens = aplicaBusca(base, filtros);

  return {
    recorte,
    filtros,
    itens,
    total: itens.length,
    opcoes: opcoesDasLinhas(base),
    indicadores: indicadoresDe(itens, recorte),
    totaisHoras: totaisDeHoras(itens),
  };
}

/** Lista os documentos de um tipo dentro do recorte filtrado (indicador clicável). */
export async function documentosDoIndicador(
  usuario: Usuario,
  templateId: string,
  filtros: FiltrosEstatisticas = {},
): Promise<{ documento: DocumentoPreenchido; alunoNome: string; estagioId?: string }[]> {
  const pesquisa = await pesquisarEstatisticas(usuario, filtros);
  const ids = new Set(pesquisa.itens.map((item) => item.estagio.id));
  const nomes = new Map(pesquisa.itens.map((item) => [item.estagio.id, item.alunoNome]));

  return obterEstado()
    .documentos.filter(
      (documento) =>
        documento.templateId === templateId &&
        documento.situacao !== "inativo" &&
        documento.estagioId &&
        ids.has(documento.estagioId),
    )
    .map((documento) => ({
      documento,
      alunoNome: documento.estagioId ? (nomes.get(documento.estagioId) ?? "Aluno") : "Aluno",
      estagioId: documento.estagioId,
    }));
}
