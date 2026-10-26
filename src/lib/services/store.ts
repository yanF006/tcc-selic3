import type {
  Convenio,
  Curso,
  DocumentoPreenchido,
  Estagio,
  LancamentoHoras,
  MatriculaImportada,
  Notificacao,
  ObservacaoDocumento,
  EnvioExterno,
  Parecer,
  Periodo,
  Pessoa,
  SolicitacaoAcesso,
  SolicitacaoExclusaoEstagio,
  TemplateDocumento,
  Turma,
  Usuario,
} from "@/lib/domain/types";

import * as fixtures from "@/lib/fixtures/base";
import { templates as templatesFixture } from "@/lib/fixtures/templates";

import { reiniciarCredenciais } from "./credenciais";

/**
 * Estado em memória do simulador (D4). Os serviços leem e escrevem aqui; no
 * backend, cada função passa a consultar o banco e este arquivo desaparece.
 */

export interface EstadoSimulado {
  cursos: Curso[];
  turmas: Turma[];
  periodos: Periodo[];
  convenios: Convenio[];
  pessoas: Pessoa[];
  usuarios: Usuario[];
  estagios: Estagio[];
  lancamentos: LancamentoHoras[];
  documentos: DocumentoPreenchido[];
  pareceres: Parecer[];
  observacoes: ObservacaoDocumento[];
  envios: EnvioExterno[];
  notificacoes: Notificacao[];
  solicitacoes: SolicitacaoAcesso[];
  exclusoes: SolicitacaoExclusaoEstagio[];
  matriculas: MatriculaImportada[];
  templates: TemplateDocumento[];
}

function estadoLimpo(): EstadoSimulado {
  return structuredClone({
    cursos: fixtures.cursos,
    turmas: fixtures.turmas,
    periodos: fixtures.periodos,
    convenios: fixtures.convenios,
    pessoas: fixtures.pessoas,
    usuarios: fixtures.usuarios,
    estagios: fixtures.estagios,
    lancamentos: fixtures.lancamentosHoras,
    documentos: fixtures.documentos,
    pareceres: fixtures.pareceres,
    observacoes: [],
    envios: [],
    notificacoes: fixtures.notificacoes,
    solicitacoes: fixtures.solicitacoesAcesso,
    exclusoes: [],
    matriculas: fixtures.matriculasImportadas,
    templates: templatesFixture,
  }) as EstadoSimulado;
}

let estado: EstadoSimulado = estadoLimpo();

export function obterEstado(): EstadoSimulado {
  return estado;
}

/** Usado pelos testes e pela tela de demonstração para voltar ao estado inicial. */
export function reiniciarEstado(): EstadoSimulado {
  estado = estadoLimpo();

  // As senhas em memória fazem parte do estado simulado: sem esta linha, uma
  // senha trocada em um teste vazaria para o seguinte.
  reiniciarCredenciais();

  return estado;
}

let sequencia = 1000;

/** Identificador curto e estável dentro da sessão simulada. */
export function novoId(prefixo: string): string {
  sequencia += 1;

  return `${prefixo}-${sequencia}`;
}

export function agora(): string {
  return new Date().toISOString();
}
