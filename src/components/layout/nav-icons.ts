import {
  BarChart3Icon,
  CalendarCheckIcon,
  CircleIcon,
  FileCheck2Icon,
  FileTextIcon,
  FolderSearchIcon,
  GraduationCapIcon,
  HandshakeIcon,
  InboxIcon,
  type LucideIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "lucide-react";

/**
 * Ícones da navegação (D2). O registro `src/nav.ts` guarda apenas a **chave** do
 * ícone, para continuar sendo um módulo de dados puro; a imagem é resolvida aqui,
 * no componente que sabe desenhar.
 *
 * Os nomes seguem a ação da tela, não o desenho do glifo, e todos usam a mesma
 * família e o mesmo traço do `lucide-react`.
 */
export const CHAVES_ICONES = [
  "documentos",
  "estagio",
  "perfil",
  "estagios",
  "frequencia",
  "documentos-curso",
  "solicitacoes",
  "usuarios",
  "convenios",
  "matriculas",
  "estatisticas",
] as const;

export type ChaveIcone = (typeof CHAVES_ICONES)[number];

const ICONES: Record<ChaveIcone, LucideIcon> = {
  documentos: FileTextIcon,
  estagio: FileCheck2Icon,
  perfil: UserRoundIcon,
  estagios: UsersRoundIcon,
  frequencia: CalendarCheckIcon,
  "documentos-curso": FolderSearchIcon,
  solicitacoes: InboxIcon,
  usuarios: UsersRoundIcon,
  convenios: HandshakeIcon,
  matriculas: GraduationCapIcon,
  estatisticas: BarChart3Icon,
};

const ICONES_GRUPO: Record<string, LucideIcon> = {
  principal: FileTextIcon,
  gestao: UsersRoundIcon,
  administracao: GraduationCapIcon,
};

/** Ícone do item de navegação; chaves desconhecidas caem em um ponto neutro. */
export function iconeNav(chave: ChaveIcone | undefined): LucideIcon {
  return (chave && ICONES[chave]) || CircleIcon;
}

/** Ícone do grupo de navegação. */
export function iconeGrupoNav(grupo: string): LucideIcon {
  return ICONES_GRUPO[grupo] ?? CircleIcon;
}
