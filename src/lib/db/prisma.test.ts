import { describe, expect, it } from "vitest";

import {
  TIMEOUT_AQUISICAO_PADRAO_MS,
  TIMEOUT_CONEXAO_PADRAO_MS,
  TIMEOUT_INICIALIZACAO_PADRAO_MS,
  opcoesDeConexao,
} from "./prisma";

const URL_BANCO = "mysql://usuario:senha@db.invalid:3307/selic";

describe("opções de conexão", () => {
  it("usa timeouts de 8–12 s com initializationTimeout menor que acquireTimeout", () => {
    const opcoes = opcoesDeConexao(URL_BANCO, {});

    expect(opcoes.host).toBe("db.invalid");
    expect(opcoes.port).toBe(3307);
    expect(opcoes.database).toBe("selic");
    expect(opcoes.connectTimeout).toBe(TIMEOUT_CONEXAO_PADRAO_MS);
    expect(opcoes.acquireTimeout).toBe(TIMEOUT_AQUISICAO_PADRAO_MS);
    expect(opcoes.initializationTimeout).toBe(TIMEOUT_INICIALIZACAO_PADRAO_MS);
    expect(opcoes.initializationTimeout).toBeLessThan(opcoes.acquireTimeout);
    expect(opcoes.connectTimeout).toBeGreaterThanOrEqual(8_000);
    expect(opcoes.acquireTimeout).toBeLessThanOrEqual(12_000);
  });

  it("aceita sobrescrita por ambiente e mantém initializationTimeout abaixo de acquireTimeout", () => {
    const opcoes = opcoesDeConexao(URL_BANCO, {
      SELIC_DB_CONNECT_TIMEOUT_MS: "9000",
      SELIC_DB_ACQUIRE_TIMEOUT_MS: "11000",
      SELIC_DB_INITIALIZATION_TIMEOUT_MS: "10500",
    });

    expect(opcoes.connectTimeout).toBe(9_000);
    expect(opcoes.acquireTimeout).toBe(11_000);
    expect(opcoes.initializationTimeout).toBe(10_500);
    expect(opcoes.initializationTimeout).toBeLessThan(opcoes.acquireTimeout);
  });

  it("limita initializationTimeout ao acquireTimeout menos 1 ms", () => {
    const opcoes = opcoesDeConexao(URL_BANCO, {
      SELIC_DB_ACQUIRE_TIMEOUT_MS: "10000",
      SELIC_DB_INITIALIZATION_TIMEOUT_MS: "20000",
    });

    expect(opcoes.initializationTimeout).toBe(9_999);
  });
});
