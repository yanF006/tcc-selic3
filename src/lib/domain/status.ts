import {
  BanIcon,
  CheckCircleIcon,
  CircleDashedIcon,
  CircleDotIcon,
  ClipboardCheckIcon,
  ClockIcon,
  FileCheckIcon,
  FileClockIcon,
  FileWarningIcon,
  HourglassIcon,
  type LucideIcon,
} from "lucide-react";

import type {
  Papel,
  SituacaoDocumento,
  SituacaoEstagio,
  SituacaoSolicitud,
  SituacaoUsuario,
} from "./types";

export interface MetadadoSituacao {
  rotulo: string;
  /** Variante do `Badge` de `components/ui/badge`. */
  variante:
    "default" | "secondary" | "destructive" | "success" | "warning" | "info" | "outline" | "neutro";
  Icone: LucideIcon;
  descricao: string;
}

const situacoesDocumento: Record<SituacaoDocumento, MetadadoSituacao> = {
  rascunho: {
    rotulo: "Em preenchimento",
    variante: "neutro",
    Icone: CircleDashedIcon,
    descricao: "Documento aberto pelo aluno e ainda não submetido a parecer.",
  },
  registrada: {
    rotulo: "Registrado",
    variante: "success",
    Icone: ClipboardCheckIcon,
    descricao:
      "Documento recebido já preenchido e assinado, registrado diretamente pela coordenação.",
  },
  submetido: {
    rotulo: "Submetido",
    variante: "info",
    Icone: FileClockIcon,
    descricao: "Documento enviado e aguardando o início da análise.",
  },
  em_analise: {
    rotulo: "Em análise",
    variante: "warning",
    Icone: HourglassIcon,
    descricao: "Documento em análise pelo responsável do parecer.",
  },
  aprovado: {
    rotulo: "Aprovado",
    variante: "success",
    Icone: CheckCircleIcon,
    descricao: "Documento aprovado pelo responsável do parecer.",
  },
  indeferido: {
    rotulo: "Indeferido",
    variante: "destructive",
    Icone: FileWarningIcon,
    descricao: "Documento indeferido, com a justificativa do parecer disponível.",
  },
  inativo: {
    rotulo: "Inativo",
    variante: "secondary",
    Icone: BanIcon,
    descricao: "Documento inativado e preservado para consulta da coordenação.",
  },
};

const situacoesEstagio: Record<SituacaoEstagio, MetadadoSituacao> = {
  em_andamento: {
    rotulo: "Em andamento",
    variante: "info",
    Icone: CircleDotIcon,
    descricao: "Estágio com período em curso.",
  },
  concluido: {
    rotulo: "Concluído",
    variante: "success",
    Icone: FileCheckIcon,
    descricao: "Estágio com período encerrado.",
  },
};

const situacoesUsuario: Record<SituacaoUsuario, MetadadoSituacao> = {
  ativo: {
    rotulo: "Ativo",
    variante: "success",
    Icone: CheckCircleIcon,
    descricao: "Cadastro ativo, com acesso liberado.",
  },
  pendente: {
    rotulo: "Pendente",
    variante: "warning",
    Icone: ClockIcon,
    descricao: "Cadastro aguardando autorização de acesso.",
  },
  inativo: {
    rotulo: "Inativo",
    variante: "secondary",
    Icone: BanIcon,
    descricao: "Cadastro inativado, sem acesso ao sistema.",
  },
};

const situacoesSolicitud: Record<SituacaoSolicitud, MetadadoSituacao> = {
  pendente: {
    rotulo: "Pendente",
    variante: "warning",
    Icone: ClockIcon,
    descricao: "Aguardando decisão da coordenação.",
  },
  autorizado: {
    rotulo: "Autorizado",
    variante: "success",
    Icone: CheckCircleIcon,
    descricao: "Acesso liberado pela coordenação.",
  },
  recusado: {
    rotulo: "Recusado",
    variante: "destructive",
    Icone: BanIcon,
    descricao: "Cadastro recusado, com motivo registrado.",
  },
};

const rotulosPapel: Record<Papel, string> = {
  aluno: "Aluno",
  coordenador_estagio: "Coordenador de Estágio",
  coordenador_curso: "Coordenador de Curso",
  administrador: "Administrador",
};

export function metadadoDocumento(situacao: SituacaoDocumento): MetadadoSituacao {
  return situacoesDocumento[situacao];
}

export function metadadoEstagio(situacao: SituacaoEstagio): MetadadoSituacao {
  return situacoesEstagio[situacao];
}

export function metadadoUsuario(situacao: SituacaoUsuario): MetadadoSituacao {
  return situacoesUsuario[situacao];
}

export function metadadoSolicitud(situacao: SituacaoSolicitud): MetadadoSituacao {
  return situacoesSolicitud[situacao];
}

export function rotuloPapel(papel: Papel): string {
  return rotulosPapel[papel];
}

export function rotuloSituacaoDocumento(situacao: SituacaoDocumento): string {
  return situacoesDocumento[situacao].rotulo;
}

export function varianteSituacaoDocumento(situacao: SituacaoDocumento) {
  return situacoesDocumento[situacao].variante;
}

export function iconeSituacaoDocumento(situacao: SituacaoDocumento): LucideIcon {
  return situacoesDocumento[situacao].Icone;
}

export function varianteSituacaoEstagio(situacao: SituacaoEstagio) {
  return situacoesEstagio[situacao].variante;
}

export function iconeSituacaoEstagio(situacao: SituacaoEstagio): LucideIcon {
  return situacoesEstagio[situacao].Icone;
}

export function rotuloSituacaoEstagio(situacao: SituacaoEstagio): string {
  return situacoesEstagio[situacao].rotulo;
}

export function varianteSituacaoUsuario(situacao: SituacaoUsuario) {
  return situacoesUsuario[situacao].variante;
}

/* ------------------------------------------------------------------ */
/* Transições de situação                                             */
/* ------------------------------------------------------------------ */

export type TransicaoDocumento = SituacaoDocumento;

const transicoesDocumento: Record<SituacaoDocumento, SituacaoDocumento[]> = {
  // A Ficha de Frequência registrada já vem assinada pela concedente (8.12):
  // entra pronta pelo registro e não passa por parecer.
  rascunho: ["registrada", "submetido", "inativo"],
  registrada: ["inativo"],
  submetido: ["em_analise", "inativo"],
  em_analise: ["aprovado", "indeferido", "inativo"],
  aprovado: ["inativo"],
  indeferido: ["rascunho", "inativo"],
  inativo: [],
};

/**
 * O indeferido reabre o preenchimento para reenvio, decisão registrada no
 * `design.md`. Remover esta transição basta para bloquear o reenvio.
 */
export function transicoesDocumentoPermitidas(de: SituacaoDocumento): SituacaoDocumento[] {
  return transicoesDocumento[de];
}

export function transicaoDocumentoPermitida(
  de: SituacaoDocumento,
  para: SituacaoDocumento,
): boolean {
  return transicoesDocumento[de].includes(para);
}

const transicoesEstagio: Record<SituacaoEstagio, SituacaoEstagio[]> = {
  em_andamento: ["concluido"],
  concluido: ["em_andamento"],
};

export function transicaoEstagioPermitida(de: SituacaoEstagio, para: SituacaoEstagio): boolean {
  return transicoesEstagio[de].includes(para);
}

export function transicoesEstagioPermitidas(de: SituacaoEstagio): SituacaoEstagio[] {
  return transicoesEstagio[de];
}

/** Todas as situações de cada agregado, para fixtures e testes de exaustividade. */
export const ROTULOS_TODAS_SITUACOES = {
  documento: Object.keys(situacoesDocumento) as SituacaoDocumento[],
  estagio: Object.keys(situacoesEstagio) as SituacaoEstagio[],
  usuario: Object.keys(situacoesUsuario) as SituacaoUsuario[],
} as const;

/* Metadados expostos para os testes de exaustividade. */
export const METADADOS_SITUACAO = {
  documento: situacoesDocumento,
  estagio: situacoesEstagio,
  usuario: situacoesUsuario,
} as const;
