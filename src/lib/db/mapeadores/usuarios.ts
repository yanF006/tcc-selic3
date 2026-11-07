import "server-only";

import type { Campus, DadosPessoais, SituacaoUsuario, Usuario } from "@/lib/domain/types";
import type { Prisma } from "@/generated/prisma/client";
import { esquemaPapel } from "@/lib/domain/schemas";

/** Linha de `usuarios` como o repositório a recebe do Prisma. */
export interface LinhaUsuario {
  id: string;
  nome: string;
  email: string;
  papel: string;
  situacao: string;
  campus: string;
  matricula: string | null;
  cursoId: string | null;
  membroComissaoEstagio: boolean;
  dadosPessoais: unknown;
  criadoEm: Date;
}

/**
 * Converte o usuário de domínio para a forma persistida. `dbNull` é o marcador
 * `Prisma.DbNull`, necessário para limpar o JSON opcional no MySQL.
 */
export function paraBancoUsuario(usuario: Usuario, dbNull: unknown) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: esquemaPapel.parse(usuario.papel),
    situacao: usuario.situacao,
    campus: usuario.campus,
    matricula: usuario.matricula ?? null,
    cursoId: usuario.cursoId ?? null,
    membroComissaoEstagio: usuario.membroComissaoEstagio ?? false,
    dadosPessoais: usuario.dadosPessoais
      ? (usuario.dadosPessoais as unknown as Prisma.InputJsonValue)
      : (dbNull as Prisma.InputJsonValue),
    criadoEm: new Date(usuario.criadoEm),
  };
}

export function paraDominioUsuario(linha: LinhaUsuario): Usuario {
  return {
    id: linha.id,
    nome: linha.nome,
    email: linha.email,
    papel: esquemaPapel.parse(linha.papel),
    situacao: linha.situacao as SituacaoUsuario,
    campus: linha.campus as Campus,
    matricula: linha.matricula ?? undefined,
    cursoId: linha.cursoId ?? undefined,
    membroComissaoEstagio: linha.membroComissaoEstagio,
    dadosPessoais: (linha.dadosPessoais as DadosPessoais | null) ?? undefined,
    criadoEm: linha.criadoEm.toISOString(),
  };
}
