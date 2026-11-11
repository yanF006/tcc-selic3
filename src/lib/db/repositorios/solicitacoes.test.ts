import { describe, expect, it, vi } from "vitest";

import { criarRepositorioSolicitacoes } from "./solicitacoes";

function linha(overrides: Record<string, unknown> = {}) {
  return {
    id: "sol-1",
    usuarioId: "usr-1",
    cursoId: "curso-ads",
    situacao: "pendente",
    motivo: "Matrícula não está registrada no sistema.",
    decididoPorId: null,
    decididoEm: null,
    criadoEm: new Date("2026-11-10T10:00:00.000Z"),
    usuario: {
      nome: "Aluno Pendente",
      email: "pendente@teste.local",
      matricula: "20261234567",
      dadosPessoais: {
        nomeCompleto: "Aluno Pendente",
        cpf: "12345678901",
        rg: "1234567",
        dataNascimento: "2000-01-01",
        email: "pendente@teste.local",
        telefone: "24999990000",
        celular: "24999990001",
        endereco: {
          cep: "27100000",
          logradouro: "Rua A",
          numero: "1",
          bairro: "Centro",
          cidade: "Pinheiral",
          estado: "RJ",
        },
        cursoId: "curso-ads",
        turmaId: "turma-1",
        periodoId: "periodo-1",
      },
      dadosPessoaisAluno: null,
    },
    ...overrides,
  };
}

function criarCliente(linhas: unknown[], total = linhas.length) {
  return {
    solicitacaoAcesso: {
      count: vi.fn().mockResolvedValue(total),
      findMany: vi.fn().mockResolvedValue(linhas),
      findUnique: vi.fn().mockResolvedValue(linhas[0] ?? null),
      update: vi.fn().mockResolvedValue({}),
    },
  } as unknown as Parameters<typeof criarRepositorioSolicitacoes>[0];
}

describe("repositório de solicitações", () => {
  it("monta busca, filtro de curso, desempate criação/ID e paginação", async () => {
    const cliente = criarCliente([linha()], 21);
    const repositorio = criarRepositorioSolicitacoes(cliente);

    const pagina = await repositorio.listarPaginado({
      situacao: "pendente",
      cursoId: "curso-ads",
      busca: "Pendente",
      pagina: 2,
      tamanho: 10,
    });

    expect(cliente.solicitacaoAcesso.count).toHaveBeenCalledWith({
      where: {
        situacao: "pendente",
        cursoId: "curso-ads",
        OR: [
          { usuario: { nome: { contains: "Pendente" } } },
          { usuario: { email: { contains: "Pendente" } } },
          { usuario: { matricula: { contains: "Pendente" } } },
        ],
      },
    });
    expect(cliente.solicitacaoAcesso.findMany).toHaveBeenCalledWith({
      where: expect.any(Object),
      include: { usuario: { include: { dadosPessoaisAluno: true } } },
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      skip: 10,
      take: 10,
    });
    expect(pagina).toMatchObject({ total: 21, pagina: 2, tamanhoPagina: 10 });
    expect(pagina.itens[0]).toMatchObject({
      id: "sol-1",
      nome: "Aluno Pendente",
      email: "pendente@teste.local",
      matricula: "20261234567",
      situacao: "pendente",
      dadosPessoais: { cursoId: "curso-ads", email: "pendente@teste.local" },
    });
  });

  it("limita a página ao último recorte e busca por ID com o mesmo vínculo", async () => {
    const cliente = criarCliente([linha()], 5);
    const repositorio = criarRepositorioSolicitacoes(cliente);

    const pagina = await repositorio.listarPaginado({ pagina: 99, tamanho: 2 });
    const encontrada = await repositorio.buscarPorId("sol-1");

    expect(pagina.pagina).toBe(3);
    expect(cliente.solicitacaoAcesso.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 4, take: 2 }),
    );
    expect(cliente.solicitacaoAcesso.findUnique).toHaveBeenCalledWith({
      where: { id: "sol-1" },
      include: { usuario: { include: { dadosPessoaisAluno: true } } },
    });
    expect(encontrada?.id).toBe("sol-1");
  });

  it("atualiza somente os campos de decisão", async () => {
    const cliente = criarCliente([linha()]);
    const repositorio = criarRepositorioSolicitacoes(cliente);

    await repositorio.atualizar({
      id: "sol-1",
      nome: "Aluno Pendente",
      email: "pendente@teste.local",
      matricula: "20261234567",
      dadosPessoais: {
        nomeCompleto: "Aluno Pendente",
        cpf: "12345678901",
        rg: "1234567",
        dataNascimento: "2000-01-01",
        email: "pendente@teste.local",
        telefone: "24999990000",
        celular: "24999990001",
        endereco: {
          cep: "27100000",
          logradouro: "Rua A",
          numero: "1",
          bairro: "Centro",
          cidade: "Pinheiral",
          estado: "RJ",
        },
        cursoId: "curso-ads",
        turmaId: "turma-1",
        periodoId: "periodo-1",
      },
      situacao: "autorizado",
      motivo: "Documentação conferida.",
      decididoPorId: "usr-admin",
      criadoEm: "2026-11-10T10:00:00.000Z",
      decididoEm: "2026-11-10T11:00:00.000Z",
    });

    expect(cliente.solicitacaoAcesso.update).toHaveBeenCalledWith({
      where: { id: "sol-1" },
      data: {
        situacao: "autorizado",
        motivo: "Documentação conferida.",
        decididoPorId: "usr-admin",
        decididoEm: new Date("2026-11-10T11:00:00.000Z"),
      },
    });
  });
});
