import type { Usuario } from "./types";

/**
 * Regras de leitura do cadastro de usuário, puras e compartilháveis pela
 * interface: o mesmo curso precisa aparecer igual na tabela, no filtro e no
 * perfil, sem cada tela repetir a lógica.
 */

/**
 * Curso do usuário. O Coordenador de Curso tem o curso em `cursoId`; o aluno
 * tem o curso nos dados pessoais informados no cadastro.
 */
export function cursoDoUsuario(usuario: Usuario): string | undefined {
  return usuario.cursoId ?? usuario.dadosPessoais?.cursoId;
}

/** true quando a matrícula do cadastro está registrada como válida no sistema. */
export function matriculaInformada(usuario: Usuario): string | null {
  return usuario.matricula?.trim() || null;
}
