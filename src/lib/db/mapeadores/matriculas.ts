import "server-only";

import type { MatriculaImportada } from "@/lib/domain/types";

/** Linha de `matriculas` como o repositório a recebe do Prisma. */
export interface LinhaMatricula {
  id: string;
  matricula: string;
  nome: string;
  curso: string;
  origem: string;
  importadaEm: Date;
}

export function paraBancoMatricula(registro: MatriculaImportada) {
  return {
    id: registro.id,
    matricula: registro.matricula,
    nome: registro.nome,
    curso: registro.curso,
    origem: registro.origem,
    importadaEm: new Date(registro.importadaEm),
  };
}

export function paraDominioMatricula(linha: LinhaMatricula): MatriculaImportada {
  return {
    id: linha.id,
    matricula: linha.matricula,
    nome: linha.nome,
    curso: linha.curso,
    origem: linha.origem as MatriculaImportada["origem"],
    importadaEm: linha.importadaEm.toISOString(),
  };
}
