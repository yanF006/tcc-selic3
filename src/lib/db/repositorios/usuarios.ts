import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import type { Pagina, SituacaoUsuario, Usuario } from "@/lib/domain/types";

import { paraBancoUsuario, paraDominioUsuario } from "@/lib/db/mapeadores/usuarios";

type ClienteUsuarios = Pick<PrismaClient, "usuario">;

export interface MarcadoresPrisma {
  DbNull: unknown;
}

export interface ConsultaUsuariosPersistente {
  papel?: string;
  situacao?: string;
  cursoId?: string;
  busca?: string;
  pagina?: number;
  tamanho?: number;
}

export interface RepositorioUsuarios {
  contar(): Promise<number>;
  listar(): Promise<Usuario[]>;
  buscarPorId(id: string): Promise<Usuario | null>;
  buscarPorEmail(email: string): Promise<Usuario | null>;
  listarPaginado(consulta: ConsultaUsuariosPersistente): Promise<Pagina<Usuario>>;
  contarPorSituacao(): Promise<Record<SituacaoUsuario, number>>;
  criar(usuario: Usuario): Promise<void>;
  atualizar(usuario: Usuario): Promise<void>;
  salvarMuitos(usuarios: Usuario[]): Promise<void>;
  excluir(id: string): Promise<void>;
}

const TAMANHO_PADRAO = 10;

function filtrosDe(consulta: ConsultaUsuariosPersistente): Prisma.UsuarioWhereInput {
  const filtros: Prisma.UsuarioWhereInput = {};

  if (consulta.papel) filtros.papel = consulta.papel;
  if (consulta.situacao) filtros.situacao = consulta.situacao;
  if (consulta.cursoId) {
    filtros.OR = [
      { cursoId: consulta.cursoId },
      { dadosPessoaisAluno: { is: { cursoId: consulta.cursoId } } },
    ];
  }

  const termo = consulta.busca?.trim();
  if (termo) {
    filtros.AND = [
      {
        OR: [
          { nome: { contains: termo } },
          { email: { contains: termo } },
          { matricula: { contains: termo } },
        ],
      },
    ];
  }

  return filtros;
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

    async buscarPorEmail(email) {
      const linha = await cliente.usuario.findUnique({ where: { email } });

      return linha ? paraDominioUsuario(linha) : null;
    },

    async listarPaginado(consulta) {
      const where = filtrosDe(consulta);
      const tamanho = Math.max(1, consulta.tamanho ?? TAMANHO_PADRAO);
      const total = await cliente.usuario.count({ where });
      const paginas = Math.max(1, Math.ceil(total / tamanho));
      const pagina = Math.min(Math.max(1, consulta.pagina ?? 1), paginas);
      const linhas = await cliente.usuario.findMany({
        where,
        orderBy: [{ nome: "asc" }, { id: "asc" }],
        skip: (pagina - 1) * tamanho,
        take: tamanho,
      });

      return {
        itens: linhas.map(paraDominioUsuario),
        total,
        pagina,
        tamanhoPagina: tamanho,
      };
    },

    async contarPorSituacao() {
      const [ativo, inativo, pendente] = await Promise.all([
        cliente.usuario.count({ where: { situacao: "ativo" } }),
        cliente.usuario.count({ where: { situacao: "inativo" } }),
        cliente.usuario.count({ where: { situacao: "pendente" } }),
      ]);

      return { ativo, inativo, pendente };
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
