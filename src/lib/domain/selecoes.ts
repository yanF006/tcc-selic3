import type { Periodo, Turma } from "./types";

export function periodosDoCurso(
  cursoId: string,
  turmas: Turma[],
  periodos: Periodo[],
  turmaAtualId?: string,
) {
  const vinculadas = turmas.filter(
    (turma) =>
      turma.cursoId === cursoId && (turma.situacao === "ativo" || turma.id === turmaAtualId),
  );
  return periodos.filter((periodo) =>
    vinculadas.some((turma) => !turma.periodoIds || turma.periodoIds.includes(periodo.id)),
  );
}
