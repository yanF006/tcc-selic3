import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import type { Curso, Periodo, SituacaoUsuario, Turma } from "@/lib/domain/types";

type ClienteCatalogo = Pick<PrismaClient, "curso" | "turma" | "periodo" | "turmaPeriodo">;

export interface OpcoesAcademicas {
  cursos: Curso[];
  turmas: Turma[];
  periodos: Periodo[];
}

/**
 * Leitura dos cadastros acadêmicos usados pelo cadastro e pelos selects.
 * Aceita o cliente principal ou um `TransactionClient`, para revalidar as
 * opções dentro da transação de cadastro.
 */
export async function listarOpcoesAcademicas(
  cliente: ClienteCatalogo,
): Promise<OpcoesAcademicas> {
  const [cursos, turmas, periodos] = await Promise.all([
    cliente.curso.findMany({ orderBy: { nome: "asc" } }),
    cliente.turma.findMany({
      orderBy: { nome: "asc" },
      include: { turmaPeriodos: { select: { periodoId: true } } },
    }),
    cliente.periodo.findMany({ orderBy: [{ ano: "desc" }, { semestre: "desc" }] }),
  ]);

  return {
    cursos: cursos.map((curso) => ({
      id: curso.id,
      nome: curso.nome,
      codigo: curso.codigo,
      situacao: curso.situacao as SituacaoUsuario,
    })),
    turmas: turmas.map((turma) => ({
      id: turma.id,
      nome: turma.nome,
      cursoId: turma.cursoId,
      periodoIds: turma.turmaPeriodos.map((vinculo) => vinculo.periodoId),
      situacao: turma.situacao as SituacaoUsuario,
    })),
    periodos: periodos.map((periodo) => ({
      id: periodo.id,
      rotulo: periodo.rotulo,
      ano: periodo.ano,
      semestre: periodo.semestre === 1 ? 1 : 2,
      situacao: periodo.situacao as SituacaoUsuario,
    })),
  };
}
