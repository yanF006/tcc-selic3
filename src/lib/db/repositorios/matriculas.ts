import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import type { MatriculaImportada } from "@/lib/domain/types";

import { paraBancoMatricula, paraDominioMatricula } from "@/lib/db/mapeadores/matriculas";

type ClienteMatriculas = Pick<PrismaClient, "matriculaImportada">;

export interface RepositorioMatriculas {
  contar(): Promise<number>;
  listar(): Promise<MatriculaImportada[]>;
  criar(registro: MatriculaImportada): Promise<void>;
  atualizar(registro: MatriculaImportada): Promise<void>;
  salvarMuitos(registros: MatriculaImportada[]): Promise<void>;
  excluir(id: string): Promise<void>;
}

export function criarRepositorioMatriculas(cliente: ClienteMatriculas): RepositorioMatriculas {
  return {
    contar: () => cliente.matriculaImportada.count(),

    async listar() {
      const linhas = await cliente.matriculaImportada.findMany({
        orderBy: [{ importadaEm: "asc" }, { id: "asc" }],
      });

      return linhas.map(paraDominioMatricula);
    },

    async criar(registro) {
      await cliente.matriculaImportada.create({
        data: paraBancoMatricula(registro),
      });
    },

    async atualizar(registro) {
      const { id, ...dados } = paraBancoMatricula(registro);

      await cliente.matriculaImportada.update({
        where: { id },
        data: dados,
      });
    },

    async salvarMuitos(registros) {
      await cliente.matriculaImportada.createMany({
        data: registros.map(paraBancoMatricula),
      });
    },

    async excluir(id) {
      await cliente.matriculaImportada.deleteMany({ where: { id } });
    },
  };
}
