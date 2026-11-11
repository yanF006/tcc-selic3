import { beforeEach, describe, expect, it, vi } from "vitest";

import { criarRepositorioUsuarios } from "./usuarios";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
}));

const cliente = {
  usuario: {
    count: mocks.count,
    findMany: mocks.findMany,
    findUnique: mocks.findUnique,
  },
} as unknown as Parameters<typeof criarRepositorioUsuarios>[0];

const repositorio = criarRepositorioUsuarios(cliente, { DbNull: null });

function linha(overrides: Record<string, unknown> = {}) {
  return {
    id: "usr-1",
    nome: "Maria Souza",
    email: "maria@aluno.ifrj.edu.br",
    papel: "aluno",
    situacao: "ativo",
    campus: "Pinheiral",
    matricula: "20231000111",
    cursoId: null,
    membroComissaoEstagio: false,
    dadosPessoais: null,
    criadoEm: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("repositório de usuários", () => {
  it("monta busca, filtros, ordenação e paginação no banco", async () => {
    mocks.count.mockResolvedValue(4);
    mocks.findMany.mockResolvedValue([linha()]);

    const pagina = await repositorio.listarPaginado({
      busca: "  Maria  ",
      papel: "aluno",
      situacao: "ativo",
      cursoId: "curso-ads",
      pagina: 2,
      tamanho: 3,
    });

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        papel: "aluno",
        situacao: "ativo",
        OR: [
          { cursoId: "curso-ads" },
          { dadosPessoaisAluno: { is: { cursoId: "curso-ads" } } },
        ],
        AND: [
          {
            OR: [
              { nome: { contains: "Maria" } },
              { email: { contains: "Maria" } },
              { matricula: { contains: "Maria" } },
            ],
          },
        ],
      },
      orderBy: [{ nome: "asc" }, { id: "asc" }],
      skip: 3,
      take: 3,
    });
    expect(pagina).toMatchObject({ total: 4, pagina: 2, tamanhoPagina: 3 });
    expect(pagina.itens[0]).toMatchObject({ id: "usr-1", nome: "Maria Souza" });
  });

  it("limita a página ao último recorte quando o total diminui", async () => {
    mocks.count.mockResolvedValue(2);
    mocks.findMany.mockResolvedValue([linha()]);

    const pagina = await repositorio.listarPaginado({ pagina: 99, tamanho: 10 });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
    expect(pagina).toMatchObject({ total: 2, pagina: 1, tamanhoPagina: 10 });
  });

  it("busca usuário por e-mail normalizado e conta por situação", async () => {
    mocks.findUnique.mockResolvedValue(linha());
    mocks.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);

    const usuario = await repositorio.buscarPorEmail("maria@aluno.ifrj.edu.br");
    const totais = await repositorio.contarPorSituacao();

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { email: "maria@aluno.ifrj.edu.br" },
    });
    expect(usuario).toMatchObject({ id: "usr-1", email: "maria@aluno.ifrj.edu.br" });
    expect(totais).toEqual({ ativo: 1, inativo: 2, pendente: 3 });
  });
});
