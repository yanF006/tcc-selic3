import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BancoIndisponivelError, detalhesDoErro, redigir } from "./erros";
import { atualizarUsuario } from "./persistencia";

const mocks = vi.hoisted(() => {
  const prisma = {
    usuario: {
      count: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    matriculaImportada: {
      count: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    authSession: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };

  return {
    prisma,
    bancoConfigurado: vi.fn(() => true),
    carregarCliente: vi.fn(),
    descartarCliente: vi.fn(),
  };
});

vi.mock("./prisma", () => ({
  bancoConfigurado: mocks.bancoConfigurado,
  carregarCliente: mocks.carregarCliente,
  descartarCliente: mocks.descartarCliente,
}));

const usuarioDoBanco = {
  id: "usr-do-banco",
  nome: "Usuário do Banco",
  email: "usuario.do.banco@ifrj.edu.br",
  papel: "aluno",
  situacao: "ativo",
  campus: "Pinheiral",
  matricula: "20260000001",
  cursoId: null,
  membroComissaoEstagio: false,
  dadosPessoais: null,
  criadoEm: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  vi.clearAllMocks();
  mocks.bancoConfigurado.mockReturnValue(true);
  mocks.carregarCliente.mockResolvedValue({
    prisma: mocks.prisma,
    Prisma: { DbNull: null },
  });
  mocks.prisma.usuario.count.mockResolvedValue(1);
  mocks.prisma.matriculaImportada.count.mockResolvedValue(1);
  mocks.prisma.usuario.findMany.mockResolvedValue([usuarioDoBanco]);
  mocks.prisma.usuario.findUnique.mockResolvedValue(usuarioDoBanco);
  mocks.prisma.matriculaImportada.findMany.mockResolvedValue([]);
  mocks.prisma.usuario.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.usuario.update.mockResolvedValue(usuarioDoBanco);
  mocks.prisma.$transaction.mockImplementation(
    async (operacao: (tx: typeof mocks.prisma) => Promise<unknown>) => operacao(mocks.prisma),
  );
  mocks.prisma.matriculaImportada.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.DATABASE_URL;
  vi.restoreAllMocks();
});

describe("escrita persistente de usuário", () => {
  it("grava o usuário em uma transação única no banco", async () => {
    await atualizarUsuario(usuarioDoBanco as never);

    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.authSession.deleteMany).not.toHaveBeenCalled();
  });

  it("revoga as sessões quando a conta deixa de estar ativa", async () => {
    await atualizarUsuario({ ...usuarioDoBanco, situacao: "inativo" } as never);

    expect(mocks.prisma.authSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: usuarioDoBanco.id },
    });
  });

  it("falha de conexão vira indisponibilidade sem cair em dados simulados", async () => {
    const causa = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    mocks.prisma.$transaction.mockRejectedValueOnce(causa);

    await expect(atualizarUsuario(usuarioDoBanco as never)).rejects.toBeInstanceOf(
      BancoIndisponivelError,
    );
    expect(mocks.descartarCliente).toHaveBeenCalled();
  });
});

describe("diagnóstico de falhas", () => {
  it("preserva campos e causa sem credenciais", () => {
    process.env.DATABASE_URL = "mysql://avnadmin:senha-secreta@db.invalid:3306/selic";

    const causa = Object.assign(
      new Error(
        "Access denied for avnadmin usando mysql://avnadmin:senha-secreta@db.invalid/selic",
      ),
      { code: "ER_ACCESS_DENIED", errno: 1045, sqlState: "28000" },
    );
    const erro = new Error("Falha ao gravar", { cause: causa });
    erro.name = "ErroDeConexao";

    const detalhes = detalhesDoErro(erro);
    const serializado = JSON.stringify(detalhes);

    expect(detalhes).toMatchObject({
      name: "ErroDeConexao",
      message: "Falha ao gravar",
      cause: {
        code: "ER_ACCESS_DENIED",
        errno: 1045,
        sqlState: "28000",
      },
    });
    expect(serializado).not.toContain("senha-secreta");
    expect(serializado).not.toContain("avnadmin");
    expect(serializado).not.toContain("mysql://");
  });

  it("preserva a causa do driver guardada em meta", () => {
    process.env.DATABASE_URL = "mysql://selic:segredo@db.invalid:3306/selic";
    const driver = Object.assign(new Error("pool timeout"), {
      code: "45028",
      errno: 45028,
      sqlState: "HY000",
    });
    const prisma = Object.assign(new Error("Invalid invocation"), {
      code: "P2039",
      meta: { driverAdapterError: driver },
    });

    const detalhes = detalhesDoErro(prisma);

    expect(detalhes).toMatchObject({
      code: "P2039",
      cause: {
        name: "Error",
        message: "pool timeout",
        code: "45028",
        errno: 45028,
        sqlState: "HY000",
      },
    });
  });

  it("reconhece a causa do adaptador mesmo quando ela é um objeto simples", () => {
    process.env.DATABASE_URL = "mysql://selic:segredo@db.invalid:3306/selic";
    const prisma = Object.assign(new Error("Invalid invocation"), {
      code: "P2039",
      meta: {
        driverAdapterError: {
          name: "DriverAdapterError",
          message: "pool timeout",
          cause: { code: "45028", errno: 45028, sqlState: "HY000" },
        },
      },
    });

    expect(detalhesDoErro(prisma)).toMatchObject({
      cause: {
        name: "DriverAdapterError",
        message: "pool timeout",
        cause: { code: "45028", errno: 45028, sqlState: "HY000" },
      },
    });
  });

  it("registra a causa completa uma vez por tentativa", async () => {
    process.env.DATABASE_URL = "mysql://usuario:segredo@db.invalid:3306/selic";
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const causa = Object.assign(new Error("connect ECONNREFUSED"), {
      code: "ECONNREFUSED",
      errno: -111,
      sqlState: "HY000",
    });

    mocks.prisma.$transaction.mockRejectedValueOnce(causa);

    await expect(atualizarUsuario(usuarioDoBanco as never)).rejects.toBeInstanceOf(BancoIndisponivelError);

    expect(aviso).toHaveBeenCalledTimes(1);
    const detalhes = aviso.mock.calls[0]?.[1] as Record<string, unknown>;

    expect(detalhes).toMatchObject({
      name: "Error",
      message: "connect ECONNREFUSED",
      code: "ECONNREFUSED",
      errno: -111,
      sqlState: "HY000",
    });
  });

  it("redige URL e credenciais em textos isolados", () => {
    process.env.DATABASE_URL = "mysql://usuario:segredo@db.invalid:3306/selic";
    const texto = redigir("mysql://usuario:segredo@db.invalid/selic password=segredo usuario");
    const caminho = redigir("/home/yan/tcc-selic3/src/lib/db/persistencia.ts");

    expect(texto).not.toContain("segredo");
    expect(texto).not.toContain("usuario");
    expect(texto).not.toContain("mysql://");
    expect(caminho).toContain("tcc-selic3");
  });
});
