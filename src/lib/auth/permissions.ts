import type { Papel, Usuario } from "@/lib/domain/types";
import { esquemaPapel } from "@/lib/domain/schemas";

/**
 * Matriz de autorização (D1, §4). Toda verificação de acesso do sistema passa
 * por este módulo: nenhuma tela decide permissão por conta própria.
 *
 * O cargo atual deve satisfazer as exigências. O administrador satisfaz
 * qualquer exigência, porque tem acesso a todas as áreas.
 */

export type Papeis = readonly Papel[];

/** Papel com acesso irrestrito, conforme §4 do design. */
export const PAPEL_COM_TODAS_AS_PERMISSOES: Papel = "administrador";

export function satisfazTodas(papel: Papel, papeisExigidos: Papeis): boolean {
  if (!esquemaPapel.safeParse(papel).success) return false;
  if (papeisExigidos.length === 0) return true;

  if (papel === PAPEL_COM_TODAS_AS_PERMISSOES) return true;

  return papeisExigidos.every((exigido) => papel === exigido);
}

export function podeAcessar(usuario: Usuario | null, papeisExigidos: Papeis): boolean {
  if (!usuario) return false;
  if (usuario.situacao !== "ativo") return false;

  return satisfazTodas(usuario.papel, papeisExigidos);
}

/** Verdadeiro quando o conjunto do usuário cobre pelo menos um dos papéis. */
export function podeAcessarAlgum(usuario: Usuario | null, papeisExigidos: Papeis): boolean {
  if (!usuario) return false;
  if (usuario.situacao !== "ativo") return false;
  if (!esquemaPapel.safeParse(usuario.papel).success) return false;
  if (usuario.papel === PAPEL_COM_TODAS_AS_PERMISSOES) return true;

  return papeisExigidos.includes(usuario.papel);
}

export function papelDoUsuario(usuario: Usuario | null): Papel | null {
  return usuario && esquemaPapel.safeParse(usuario.papel).success ? usuario.papel : null;
}

/**
 * A Comissão de Estágio é uma condição do papel de Coordenador de Estágio
 * (decisão do design), não um quinto papel.
 */
export function participaDaComissaoDeEstagio(usuario: Usuario | null): boolean {
  return Boolean(usuario?.papel === "coordenador_estagio" && usuario.membroComissaoEstagio);
}

/** Área (route group) a que o usuário pertence, para redirecionar após o login. */
export function areaDe(usuario: Usuario | null): "admin" | "coordenacao" | "aluno" | null {
  // Cadastro pendente pertence à área do aluno, mas só enxerga o aviso (5.7).
  if (!usuario || usuario.situacao === "inativo") return null;
  if (!esquemaPapel.safeParse(usuario.papel).success) return null;
  if (usuario.papel === PAPEL_COM_TODAS_AS_PERMISSOES) return "admin";
  if (usuario.papel === "coordenador_estagio") return "coordenacao";
  if (usuario.papel === "coordenador_curso") return "coordenacao";

  return "aluno";
}

export interface ResultadoGuarda {
  permitido: boolean;
  motivo?: "sem_sessao" | "papel_insuficiente" | "cadastro_inativo";
}

/** Resultado legível para a tela de acesso não autorizado. */
export function avaliarAcesso(usuario: Usuario | null, papeisExigidos: Papeis): ResultadoGuarda {
  if (!usuario) return { permitido: false, motivo: "sem_sessao" };
  if (usuario.situacao !== "ativo") return { permitido: false, motivo: "cadastro_inativo" };

  return satisfazTodas(usuario.papel, papeisExigidos)
    ? { permitido: true }
    : { permitido: false, motivo: "papel_insuficiente" };
}
