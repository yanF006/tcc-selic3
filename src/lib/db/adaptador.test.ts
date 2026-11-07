import { describe, expect, it } from "vitest";

import { fonteDadosSelecionada, VARIAVEL_FONTE_DADOS } from "./adaptador";

const URL_BANCO = "mysql://usuario:senha@127.0.0.1:33306/selic_teste_app";

describe("seleção da fonte de dados", () => {
  it("usa simulação quando não há banco nem escolha explícita", () => {
    expect(fonteDadosSelecionada({})).toBe("simulado");
  });

  it("mantém testes unitários em simulação mesmo com DATABASE_URL", () => {
    expect(fonteDadosSelecionada({ NODE_ENV: "test", DATABASE_URL: URL_BANCO })).toBe("simulado");
  });

  it("usa persistência em produção/desenvolvimento quando DATABASE_URL existe", () => {
    expect(fonteDadosSelecionada({ NODE_ENV: "production", DATABASE_URL: URL_BANCO })).toBe(
      "persistente",
    );
    expect(fonteDadosSelecionada({ NODE_ENV: "development", DATABASE_URL: URL_BANCO })).toBe(
      "persistente",
    );
  });

  it("permite selecionar persistência explicitamente nos testes", () => {
    expect(
      fonteDadosSelecionada({
        NODE_ENV: "test",
        [VARIAVEL_FONTE_DADOS]: "persistente",
        DATABASE_URL: URL_BANCO,
      }),
    ).toBe("persistente");
  });

  it("permite selecionar simulação explicitamente mesmo com banco configurado", () => {
    expect(
      fonteDadosSelecionada({
        [VARIAVEL_FONTE_DADOS]: "simulado",
        DATABASE_URL: URL_BANCO,
      }),
    ).toBe("simulado");
  });

  it("recusa persistência explícita sem DATABASE_URL", () => {
    expect(() =>
      fonteDadosSelecionada({
        NODE_ENV: "test",
        [VARIAVEL_FONTE_DADOS]: "persistente",
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it("recusa valor desconhecido em vez de cair silenciosamente no simulador", () => {
    expect(() =>
      fonteDadosSelecionada({
        [VARIAVEL_FONTE_DADOS]: "auto",
      }),
    ).toThrow(/SELIC_PERSISTENCIA/);
  });
});
