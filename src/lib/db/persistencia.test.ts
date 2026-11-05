import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BancoIndisponivelError, detalhesDoErro, redigir } from "./erros";
import { MENSAGEM_BANCO_INDISPONIVEL } from "./mensagens";
import {
  garantirHidratacao,
  gravarUsuario,
  reiniciarPersistenciaParaTestes,
  estadoDaPersistencia,
} from "./persistencia";
import { listarUsuarios } from "@/lib/services/administracao";
import { obterEstado, reiniciarEstado } from "@/lib/services/store";

const mocks = vi.hoisted(() => {
  const prisma = {
    usuario: {
      count: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    matriculaImportada: {
      count: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
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
  papeis: ["aluno"],
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
  mocks.prisma.matriculaImportada.findMany.mockResolvedValue([]);
  mocks.prisma.usuario.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.matriculaImportada.updateMany.mockResolvedValue({ count: 1 });
  process.env.SELIC_DB_SNAPSHOT_TTL_MS = "2000";
  process.env.SELIC_DB_RETRY_COOLDOWN_MS = "1000";
  reiniciarEstado();
  reiniciarPersistenciaParaTestes();
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.SELIC_DB_SNAPSHOT_TTL_MS;
  delete process.env.SELIC_DB_RETRY_COOLDOWN_MS;
  delete process.env.DATABASE_URL;
  vi.restoreAllMocks();
});

describe("máquina de estados da persistência", () => {
  it("vai de simulado a pronto e hidrata somente uma vez dentro do TTL", async () => {
    await garantirHidratacao();

    expect(estadoDaPersistencia().modo).toBe("pronto");
    expect(obterEstado().usuarios).toHaveLength(1);
    expect(mocks.prisma.usuario.count).toHaveBeenCalledTimes(1);

    vi.setSystemTime(11_999);
    await garantirHidratacao();

    expect(mocks.prisma.usuario.count).toHaveBeenCalledTimes(1);

    vi.setSystemTime(12_000);
    await garantirHidratacao();

    expect(mocks.prisma.usuario.count).toHaveBeenCalledTimes(2);
  });

  it("coalesce hidratações concorrentes em uma única consulta", async () => {
    let resolverContagem: (valor: number) => void = () => undefined;

    mocks.prisma.usuario.count.mockImplementation(
      () =>
        new Promise<number>((resolver) => {
          resolverContagem = resolver;
        }),
    );

    const primeira = garantirHidratacao();
    const segunda = garantirHidratacao();

    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.prisma.usuario.count).toHaveBeenCalledTimes(1);

    resolverContagem(1);
    await Promise.all([primeira, segunda]);

    expect(mocks.prisma.usuario.count).toHaveBeenCalledTimes(1);
    expect(estadoDaPersistencia().modo).toBe("pronto");
  });

  it("permite nova tentativa após cooldown, sem reiniciar o processo", async () => {
    process.env.SELIC_DB_RETRY_COOLDOWN_MS = "50";
    mocks.prisma.usuario.count.mockRejectedValueOnce(
      Object.assign(new Error("connect ECONNREFUSED"), { code: "ER_GET_CONNECTION_TIMEOUT" }),
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(garantirHidratacao()).rejects.toBeInstanceOf(BancoIndisponivelError);
    expect(estadoDaPersistencia().modo).toBe("falha");

    mocks.prisma.usuario.count.mockResolvedValue(1);
    vi.setSystemTime(10_051);

    await garantirHidratacao();

    expect(estadoDaPersistencia().modo).toBe("pronto");
    expect(obterEstado().usuarios[0]?.id).toBe("usr-do-banco");
  });

  it("mantém a falha durante o cooldown sem consultar o banco", async () => {
    process.env.SELIC_DB_RETRY_COOLDOWN_MS = "1000";
    mocks.prisma.usuario.count.mockRejectedValueOnce(new Error("sem conexão"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(garantirHidratacao()).rejects.toBeInstanceOf(BancoIndisponivelError);
    mocks.prisma.usuario.count.mockClear();

    await expect(garantirHidratacao()).rejects.toBeInstanceOf(BancoIndisponivelError);
    expect(mocks.prisma.usuario.count).not.toHaveBeenCalled();
  });

  it("renova o snapshot após mutação bem-sucedida", async () => {
    await garantirHidratacao();
    mocks.prisma.usuario.count.mockClear();

    vi.setSystemTime(11_500);
    await gravarUsuario({ ...obterEstado().usuarios[0], nome: "Nome Atualizado" });

    vi.setSystemTime(12_500);
    await garantirHidratacao();

    expect(mocks.prisma.usuario.count).not.toHaveBeenCalled();
  });

  it("devolve erro em vez de fixtures quando o banco configurado falha", async () => {
    mocks.prisma.usuario.count.mockRejectedValue(new Error("connect timeout"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(listarUsuarios()).rejects.toBeInstanceOf(BancoIndisponivelError);
    await expect(listarUsuarios()).rejects.toThrow(MENSAGEM_BANCO_INDISPONIVEL);
    expect(estadoDaPersistencia().modo).toBe("falha");
  });

  it("mantém o modo simulado quando não há banco configurado", async () => {
    mocks.bancoConfigurado.mockReturnValue(false);
    reiniciarPersistenciaParaTestes();

    await garantirHidratacao();

    expect(estadoDaPersistencia().modo).toBe("simulado");
    expect(mocks.carregarCliente).not.toHaveBeenCalled();
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
    const erro = new Error("Falha ao hidratar", { cause: causa });
    erro.name = "ErroDeConexao";

    const detalhes = detalhesDoErro(erro);
    const serializado = JSON.stringify(detalhes);

    expect(detalhes).toMatchObject({
      name: "ErroDeConexao",
      message: "Falha ao hidratar",
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

    mocks.prisma.usuario.count.mockRejectedValueOnce(causa);

    await expect(garantirHidratacao()).rejects.toBeInstanceOf(BancoIndisponivelError);

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
