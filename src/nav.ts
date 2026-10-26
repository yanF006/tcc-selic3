import type { ChaveIcone } from "@/components/layout/nav-icons";
import { podeAcessarAlgum } from "@/lib/auth/permissions";
import type { Papel, Usuario } from "@/lib/domain/types";

/**
 * Registro único de navegação (D2). Cada item declara `requiredRoles` e o layout
 * filtra a lista pelo conjunto de papéis do usuário — não existe menu escrito à
 * mão em nenhum layout.
 */

/** Rótulo de cada grupo na navbar. */
export const ROTULOS_GRUPO: Record<ItemNav["grupo"], string> = {
  principal: "Acesso",
  gestao: "Gestão",
  administracao: "Administração",
};

export interface ItemNav {
  /** Segmento de rota, sem barra: `/documentos`. */
  href: string;
  rotulo: string;
  descricao?: string;
  /** Chave do ícone em `components/layout/nav-icons`; a imagem fica na UI. */
  icone: ChaveIcone;
  /** Papéis que enxergam o item; lista vazia significa "todos autenticados". */
  requiredRoles: Papel[];
  /** Item aparece apenas para quem participa da Comissão de Estágio. */
  exigeComissaoDeEstagio?: boolean;
  /** Ordem dentro do grupo. */
  ordem?: number;
  grupo: "principal" | "gestao" | "administracao";
}

export const NAV: ItemNav[] = [
  {
    href: "/documentos",
    icone: "documentos",
    rotulo: "Documentos",
    descricao: "Catálogo dos documentos do Kit de Estágio.",
    requiredRoles: ["aluno", "administrador"],
    grupo: "principal",
    ordem: 1,
  },
  {
    href: "/estagio",
    icone: "estagio",
    rotulo: "Estágio",
    descricao: "Cadastrar o estágio, o convênio e o horário.",
    requiredRoles: ["aluno"],
    grupo: "principal",
    ordem: 2,
  },
  {
    href: "/perfil",
    icone: "perfil",
    rotulo: "Perfil",
    descricao: "Dados pessoais, contato e preferências.",
    requiredRoles: ["aluno"],
    grupo: "principal",
    ordem: 3,
  },
  {
    href: "/coordenacao/estagios",
    icone: "estagios",
    rotulo: "Estágios",
    descricao: "Acompanhar estágios dos alunos.",
    requiredRoles: ["coordenador_estagio", "coordenador_curso"],
    grupo: "gestao",
    ordem: 1,
  },
  {
    href: "/coordenacao/frequencia",
    icone: "frequencia",
    rotulo: "Frequência e avaliação",
    descricao: "Registrar e conferir a Ficha de Frequência e Avaliação.",
    requiredRoles: ["coordenador_estagio"],
    exigeComissaoDeEstagio: true,
    grupo: "gestao",
    ordem: 2,
  },
  {
    href: "/coordenacao/documentos",
    icone: "documentos-curso",
    rotulo: "Documentos do curso",
    descricao: "Filtrar a fila de documentos por curso e situação.",
    requiredRoles: ["coordenador_curso", "coordenador_estagio"],
    grupo: "gestao",
    ordem: 3,
  },
  {
    href: "/solicitacoes",
    icone: "solicitacoes",
    rotulo: "Cadastros pendentes",
    descricao: "Autorizar ou recusar cadastros de alunos aguardando matrícula conferida.",
    requiredRoles: ["coordenador_estagio", "coordenador_curso", "administrador"],
    grupo: "gestao",
    ordem: 4,
  },
  {
    href: "/admin/usuarios",
    icone: "usuarios",
    rotulo: "Usuários",
    descricao: "Cadastrar, editar e inativar usuários.",
    requiredRoles: ["administrador"],
    grupo: "administracao",
    ordem: 1,
  },
  {
    href: "/admin/convenios",
    icone: "convenios",
    rotulo: "Convênios",
    descricao: "Cadastrar convênios e registrar renovações.",
    requiredRoles: ["administrador"],
    grupo: "administracao",
    ordem: 2,
  },
  {
    href: "/admin/matriculas",
    icone: "matriculas",
    rotulo: "Matrículas",
    descricao: "Lançar e consultar as matrículas válidas do sistema.",
    requiredRoles: ["administrador"],
    grupo: "administracao",
    ordem: 3,
  },
  {
    href: "/coordenacao/estatisticas",
    icone: "estatisticas",
    rotulo: "Estatísticas",
    descricao: "Pesquisar estágios e indicadores por curso e instituição.",
    requiredRoles: ["administrador", "coordenador_estagio", "coordenador_curso"],
    grupo: "gestao",
    ordem: 4,
  },
  {
    href: "/coordenacao/cadastros",
    icone: "convenios",
    rotulo: "Cadastros de apoio",
    descricao: "Gerenciar convênios, cursos, turmas, períodos e responsáveis.",
    requiredRoles: ["coordenador_estagio"],
    grupo: "gestao",
    ordem: 5,
  },
  {
    href: "/coordenacao/templates",
    icone: "documentos",
    rotulo: "Templates de documentos",
    requiredRoles: ["coordenador_estagio"],
    grupo: "gestao",
    ordem: 6,
  },
];

/** Itens visíveis para o usuário, na ordem declarada. */
export function itensPara(usuario: Usuario | null): ItemNav[] {
  if (!usuario || usuario.situacao !== "ativo") return [];

  return NAV.filter((item) => {
    if (item.exigeComissaoDeEstagio) {
      // O administrador tem acesso a todas as áreas (§4); para os demais, a
      // Comissão de Estágio é condição do papel de Coordenador de Estágio.
      if (usuario.papeis.includes("administrador")) return true;

      return (
        usuario.papeis.includes("coordenador_estagio") && Boolean(usuario.membroComissaoEstagio)
      );
    }

    if (item.requiredRoles.length === 0) return true;

    return podeAcessarAlgum(usuario, item.requiredRoles);
  }).sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99));
}

/** Agrupa os itens visíveis na ordem de exibição da navbar. */
export function gruposPara(
  usuario: Usuario | null,
): { grupo: ItemNav["grupo"]; itens: ItemNav[] }[] {
  const ordemGrupos: ItemNav["grupo"][] = ["principal", "gestao", "administracao"];

  return ordemGrupos
    .map((grupo) => ({ grupo, itens: itensPara(usuario).filter((item) => item.grupo === grupo) }))
    .filter((secao) => secao.itens.length > 0);
}

/** true quando o item existe no registro e é visível para o usuário. */
export function itemVisivel(usuario: Usuario | null, href: string): boolean {
  return itensPara(usuario).some((item) => item.href === href);
}
