import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createServer, type Socket } from "node:net";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { opcoesDeConexao } from "@/lib/db/prisma";
import {
  BancoIndisponivelError,
  registrarFalhaBanco,
  traduzirErroPersistencia,
} from "@/lib/db/erros";

import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base =
  process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");
const ambiente = {
  SELIC_DB_CA_CERT: ca,
  SELIC_DB_CONNECTION_LIMIT: "1",
  SELIC_DB_CONNECT_TIMEOUT_MS: "1500",
  SELIC_DB_ACQUIRE_TIMEOUT_MS: "2500",
  SELIC_DB_INITIALIZATION_TIMEOUT_MS: "2000",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("TLS e limites do cliente de banco", () => {
  it("consulta o MySQL com cadeia confiável e hostname válido", async () => {
    const prisma = new PrismaClient({
      adapter: new PrismaMariaDb(opcoesDeConexao(configuracao.url, ambiente)),
    });
    try {
      expect(await prisma.$queryRaw`SELECT 1 AS valor`).toEqual([{ valor: BigInt(1) }]);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("recusa o certificado quando sua CA não é confiável", async () => {
    const prisma = new PrismaClient({
      adapter: new PrismaMariaDb(
        opcoesDeConexao(configuracao.url, { ...ambiente, SELIC_DB_CA_CERT: "" }),
      ),
    });
    try {
      await expect(
        prisma.$queryRaw`SELECT 1`.catch((erro) => {
          throw traduzirErroPersistencia(erro);
        }),
      ).rejects.toBeInstanceOf(BancoIndisponivelError);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("recusa hostname incompatível mesmo quando a CA é confiável", async () => {
    const opcoes = opcoesDeConexao(configuracao.url, ambiente);
    const ssl = { ...opcoes.ssl, servername: "outro-host.invalid" };
    const prisma = new PrismaClient({
      adapter: new PrismaMariaDb({
        ...opcoes,
        ssl,
      }),
    });
    try {
      await expect(
        prisma.$queryRaw`SELECT 1`.catch((erro) => {
          throw traduzirErroPersistencia(erro);
        }),
      ).rejects.toBeInstanceOf(BancoIndisponivelError);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("encerra handshake sem resposta dentro do limite e redige o diagnóstico", async () => {
    const sockets = new Set<Socket>();
    const servidor = createServer((socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });
    await new Promise<void>((resolve) => servidor.listen(0, "127.0.0.1", resolve));
    const endereco = servidor.address();
    if (!endereco || typeof endereco === "string") throw new Error("Porta de teste ausente.");
    const url = new URL(configuracao.url);
    url.port = String(endereco.port);
    vi.stubEnv("DATABASE_URL", url.toString());
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const prisma = new PrismaClient({
      adapter: new PrismaMariaDb(opcoesDeConexao(url.toString(), ambiente)),
    });
    const inicio = performance.now();
    try {
      let falha: unknown;
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (erro) {
        falha = erro;
      }
      expect(falha).toBeInstanceOf(Error);
      expect(traduzirErroPersistencia(falha)).toBeInstanceOf(BancoIndisponivelError);
      expect(performance.now() - inicio).toBeLessThan(6000);
      registrarFalhaBanco(falha, performance.now() - inicio);
      const diagnostico = JSON.stringify(aviso.mock.calls);
      expect(diagnostico).not.toContain(configuracao.senha);
      expect(diagnostico).not.toContain(configuracao.usuario);
      expect(diagnostico).not.toContain("mysql://");
      expect(aviso.mock.calls[0]?.[1]).toHaveProperty("code");
    } finally {
      await prisma.$disconnect();
      sockets.forEach((socket) => socket.destroy());
      await new Promise<void>((resolve) => servidor.close(() => resolve()));
    }
  });
});
