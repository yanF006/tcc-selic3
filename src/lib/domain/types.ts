/**
 * Tipos de domínio do SELic.
 *
 * Este arquivo é o contrato que o `schema.prisma` vai reproduzir quando o
 * backend entrar. Nenhuma tela importa fixtures: todas consomem os serviços
 * de `src/lib/services`, que expõem estes tipos.
 */

export type Papel = "aluno" | "coordenador_estagio" | "coordenador_curso" | "administrador";

export const PAPEIS: readonly Papel[] = [
  "aluno",
  "coordenador_estagio",
  "coordenador_curso",
  "administrador",
] as const;

export type SituacaoUsuario = "ativo" | "inativo" | "pendente";

export const SITUACOES_USUARIO: readonly SituacaoUsuario[] = ["ativo", "inativo", "pendente"];

/** O sistema atende exclusivamente ao Campus Pinheiral (decisão com a cliente). */
export type Campus = "Pinheiral";

export interface Endereco {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export interface DadosPessoais {
  nomeCompleto: string;
  cpf: string;
  rg: string;
  dataNascimento: string;
  email: string;
  telefone: string;
  celular: string;
  endereco: Endereco;
  cursoId: string;
  turmaId: string;
  periodoId: string;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papeis: Papel[];
  situacao: SituacaoUsuario;
  campus: Campus;
  /** Matrícula do aluno no SIGAA. Imutável após o cadastro. */
  matricula?: string;
  /** Curso do coordenador de curso; ausente nos demais papéis. */
  cursoId?: string;
  /** true quando o Coordenador de Estágio atua como membro da Comissão de Estágio. */
  membroComissaoEstagio?: boolean;
  dadosPessoais?: DadosPessoais;
  criadoEm: string;
}

export interface Curso {
  id: string;
  nome: string;
  codigo: string;
  situacao: SituacaoUsuario;
}

export interface Turma {
  id: string;
  nome: string;
  cursoId: string;
  situacao: SituacaoUsuario;
}

export interface Periodo {
  id: string;
  rotulo: string;
  ano: number;
  semestre: 1 | 2;
  situacao: SituacaoUsuario;
}

export interface Convenio {
  id: string;
  instituicao: string;
  nome: string;
  cnpj: string;
  inicioVigencia: string;
  fimVigencia: string;
  campus: Campus;
  situacao: SituacaoUsuario;
  /** Data da última renovação registrada pelo histórico de convênios. */
  renovacoes: number;
}

/** Convênio dentro da vigência é ativo; vencido, expirado. */
export type ClassificacaoConvenio = "ativo" | "expirado";

export type PapelResponsavel = "orientador" | "supervisor";

export interface Pessoa {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  papel: PapelResponsavel;
  situacao: SituacaoUsuario;
  dadosPessoais?: {
    cpf: string;
    rg: string;
    endereco: Endereco;
  };
}

export type SituacaoEstagio = "em_andamento" | "concluido";

export interface Estagio {
  id: string;
  alunoId: string;
  convenioId: string;
  supervisorId: string;
  orientadorId: string;
  dataInicio: string;
  dataFim: string;
  situacao: SituacaoEstagio;
  /** Templates que o aluno escolheu preencher naquele estágio. */
  documentosSelecionados: string[];
  /** Registro de quem fez a última edição, quando não foi o próprio aluno. */
  editadoPorId?: string;
  editadoEm?: string;
  criadoEm: string;
}

export type SituacaoDocumento =
  | "rascunho"
  | "registrada"
  | "submetido"
  | "em_analise"
  | "aprovado"
  | "indeferido"
  | "inativo";

export type TipoTemplate = "preenchivel" | "download";

export type TipoParecer = "nenhum" | "coordenador_curso" | "comissao_estagio" | "externo";

export interface VersaoTemplate {
  versao: number;
  arquivo: string;
  registradaEm: string;
  vigente: boolean;
}

export interface TemplateDocumento {
  id: string;
  nome: string;
  tipo: TipoTemplate;
  /** Metadados de preenchimento; presente apenas em templates preenchíveis. */
  metadados?: MetadadosTemplate;
  versoes: VersaoTemplate[];
  situacao: SituacaoUsuario;
}

export interface MetadadosTemplate {
  /** Quem pode abrir o formulário de preenchimento. */
  papeisPreenchimento: Papel[];
  /** Fila que analisa o parecer deste documento. */
  tipoParecer: TipoParecer;
  /** O preenchimento depende de um estágio selecionado. */
  exigeEstagio: boolean;
  /** Papéis que podem assinar o documento gerado. */
  assinaturas: AssinaturaTemplate[];
  /** Caminho do arquivo `.docx` no Kit de Estágio. */
  arquivoOrigem?: string;
  /** Observação de pendência do arquivo original, quando houver. */
  observacao?: string;
}

export interface AssinaturaTemplate {
  papel: string;
  rotulo: string;
  /** `interna` quando assina dentro do sistema, `externa` quando fora. */
  tipo: "interna" | "externa";
}

export type DocumentoPreenchido = {
  id: string;
  templateId: string;
  alunoId: string;
  estagioId?: string;
  versaoTemplate: number;
  valores: Record<string, unknown>;
  situacao: SituacaoDocumento;
  criadoEm: string;
  atualizadoEm: string;
  inativadoEm?: string;
  /** Quem registrou o documento recebido já assinado (8.12). */
  registradoPorId?: string;
  registradoEm?: string;
};

export type TipoLancamento = "lancamento" | "correcao";

export interface LancamentoHoras {
  id: string;
  estagioId: string;
  alunoId: string;
  data: string;
  entrada: string;
  saida: string;
  /** Intervalo de almoço desligado antes da soma. */
  almocoDesligado: boolean;
  horas: number;
  tipo: TipoLancamento;
  /** Lançamento corrigido, presente apenas em lançamentos de correção. */
  corrigeId?: string;
  criadoEm: string;
}

export type DecisaoParecer = "aprovado" | "indeferido";

export interface Parecer {
  id: string;
  documentoId: string;
  decisao: DecisaoParecer;
  consideracoes?: string;
  autorId: string;
  fila: TipoParecer;
  data: string;
}

export interface Notificacao {
  id: string;
  destinatarioId: string;
  titulo: string;
  mensagem: string;
  tipo: "parecer" | "acesso" | "envio" | "sistema";
  lida: boolean;
  criadaEm: string;
}

export type StatusEnvioExterno = "enviado" | "falha";

export interface EnvioExterno {
  id: string;
  documentoId: string;
  destinatario: string;
  destinatarioEmail: string;
  autorId: string;
  status: StatusEnvioExterno;
  erro?: string;
  tentativa: number;
  enviadoEm: string;
}

export type SituacaoSolicitud = "pendente" | "autorizado" | "recusado";

export interface SolicitacaoAcesso {
  id: string;
  nome: string;
  email: string;
  matricula: string;
  dadosPessoais: Omit<DadosPessoais, "email"> & { email: string };
  situacao: SituacaoSolicitud;
  motivo?: string;
  decididoPorId?: string;
  criadoEm: string;
  decididoEm?: string;
}

export interface SolicitacaoExclusaoEstagio {
  id: string;
  estagioId: string;
  solicitanteId: string;
  situacao: SituacaoSolicitud;
  motivo?: string;
  criadoEm: string;
  decididoEm?: string;
}

export interface MatriculaImportada {
  id: string;
  matricula: string;
  nome: string;
  curso: string;
  origem: "importacao" | "cadastro_administrador";
  importadaEm: string;
}

export interface ResultadoImportacao {
  id: string;
  arquivo: string;
  importadoEm: string;
  validas: number;
  rejeitadas: number;
  ignoradas: number;
  itens: {
    matricula: string;
    nome: string;
    resultado: "valida" | "rejeitada" | "ignorada";
    motivo?: string;
  }[];
}

/** Lista paginada devolvida pelos serviços. */
export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
}
