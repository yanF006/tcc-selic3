import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { Pagina, SolicitacaoAcesso } from "@/lib/domain/types";

import {
  paraDominioSolicitacao,
  type LinhaSolicitacao,
} from "@/lib/db/mapeadores/solicitacoes";

type ClienteSolicitacoes = Pick<PrismaClient, "solicitacaoAcesso">;

export interface ConsultaSolicitacoesPersistente {
  situacao?: string;
  cursoId?: string;
  busca?: string;
  pagina?: number;
  tamanho?: number;
}

export interface RepositorioSolicitacoes {
  listarPaginado(consulta: ConsultaSolicitacoesPersistente): Promise<Pagina<SolicitacaoAcesso>>;
  buscarPorId(id: string): Promise<SolicitacaoAcesso | null>;
  atualizar(solicitacao: SolicitacaoAcesso): Promise<void>;
}

const TAMANHO_PADRAO = 10;

const incluirUsuario = {
  usuario: { include: { dadosPessoaisAluno: true } },
} as const;

function filtrosDe(consulta: ConsultaSolicitacoesPersistente): Prisma.SolicitacaoAcessoWhereInput {
  const filtros: Prisma.SolicitacaoAcessoWhereInput = {};

  if (consulta.situacao) filtros.situacao = consulta.situacao;
  if (consulta.cursoId) filtros.cursoId = consulta.cursoId;

  const termo = consulta.busca?.trim();
  if (termo) {
    filtros.OR = [
      { usuario: { nome: { contains: termo } } },
      { usuario: { email: { contains: termo } } },
      { usuario: { matricula: { contains: termo } } },
    ];
  }

  return filtros;
}

export function criarRepositorioSolicitacoes(
  cliente: ClienteSolicitacoes,
): RepositorioSolicitacoes {
  return {
    async listarPaginado(consulta) {
      const where = filtrosDe(consulta);
      const tamanho = Math.max(1, consulta.tamanho ?? TAMANHO_PADRAO);
      const total = await cliente.solicitacaoAcesso.count({ where });
      const paginas = Math.max(1, Math.ceil(total / tamanho));
      const pagina = Math.min(Math.max(1, consulta.pagina ?? 1), paginas);
      const linhas = (await cliente.solicitacaoAcesso.findMany({
        where,
        include: incluirUsuario,
        orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
        skip: (pagina - 1) * tamanho,
        take: tamanho,
      })) as unknown as LinhaSolicitacao[];

      return {
        itens: linhas.map(paraDominioSolicitacao),
        total,
        pagina,
        tamanhoPagina: tamanho,
      };
    },

    async buscarPorId(id) {
      const linha = (await cliente.solicitacaoAcesso.findUnique({
        where: { id },
        include: incluirUsuario,
      })) as unknown as LinhaSolicitacao | null;

      return linha ? paraDominioSolicitacao(linha) : null;
    },

    async atualizar(solicitacao) {
      await cliente.solicitacaoAcesso.update({
        where: { id: solicitacao.id },
        data: {
          situacao: solicitacao.situacao,
          motivo: solicitacao.motivo ?? null,
          decididoPorId: solicitacao.decididoPorId ?? null,
          decididoEm: solicitacao.decididoEm ? new Date(solicitacao.decididoEm) : null,
        },
      });
    },
  };
}
