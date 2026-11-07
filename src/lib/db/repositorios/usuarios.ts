import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import type { Usuario } from "@/lib/domain/types";

import { paraBancoUsuario, paraDominioUsuario } from "@/lib/db/mapeadores/usuarios";

type ClienteUsuarios = Pick<PrismaClient, "usuario">;

export interface MarcadoresPrisma {
  DbNull: unknown;
}

export interface RepositorioUsuarios {
  contar(): Promise<number>;
  listar(): Promise<Usuario[]>;
  buscarPorId(id: string): Promise<Usuario | null>;
  criar(usuario: Usuario): Promise<void>;
  atualizar(usuario: Usuario): Promise<void>;
  salvarMuitos(usuarios: Usuario[]): Promise<void>;
  excluir(id: string): Promise<void>;
}

/**
 * Repositório de usuários. Aceita tanto o cliente principal quanto um
 * `TransactionClient`, para que o serviço controle a fronteira transacional.
 */
export function criarRepositorioUsuarios(
  cliente: ClienteUsuarios,
  marcadores: MarcadoresPrisma,
): RepositorioUsuarios {
  return {
    contar: () => cliente.usuario.count(),

    async listar() {
      const linhas = await cliente.usuario.findMany({ orderBy: { criadoEm: "asc" } });

      return linhas.map(paraDominioUsuario);
    },

    async buscarPorId(id) {
      const linha = await cliente.usuario.findUnique({ where: { id } });

      return linha ? paraDominioUsuario(linha) : null;
    },

    async criar(usuario) {
      const dados = paraBancoUsuario(usuario, marcadores.DbNull);

      await cliente.usuario.create({ data: dados as Prisma.UsuarioCreateInput });
    },

    async atualizar(usuario) {
      const { id, ...dados } = paraBancoUsuario(usuario, marcadores.DbNull);

      await cliente.usuario.update({
        where: { id },
        data: dados as Prisma.UsuarioUpdateInput,
      });
    },

    async salvarMuitos(usuarios) {
      await cliente.usuario.createMany({
        data: usuarios.map((usuario) =>
          paraBancoUsuario(usuario, marcadores.DbNull),
        ) as Prisma.UsuarioCreateManyInput[],
      });
    },

    async excluir(id) {
      await cliente.usuario.deleteMany({ where: { id } });
    },
  };
}
