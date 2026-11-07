import { describe, expect, it } from "vitest";
import { carregarConfiguracaoAutenticacao } from "./configuracao";

const segredo = "segredo-exclusivo-dos-testes-de-configuracao";

describe("configuração de autenticação", () => {
  it("exige segredo e origem explícitos sem fallback de desenvolvimento", () => {
    expect(() => carregarConfiguracaoAutenticacao({})).toThrow(/BETTER_AUTH_URL/);
    expect(() =>
      carregarConfiguracaoAutenticacao({ BETTER_AUTH_URL: "https://selic.teste.local" }),
    ).toThrow(/BETTER_AUTH_SECRET/);
    expect(
      carregarConfiguracaoAutenticacao({
        BETTER_AUTH_URL: "https://selic.teste.local/",
        BETTER_AUTH_SECRET: segredo,
      }),
    ).toEqual({ origem: "https://selic.teste.local", segredo });
  });

  it.each([
    "https://selic.teste.local/caminho",
    "https://usuario:senha@selic.teste.local",
    "https://selic.teste.local?origem=outra",
    "file:///tmp/selic",
  ])("recusa origem inválida: %s", (origem) => {
    expect(() =>
      carregarConfiguracaoAutenticacao({ BETTER_AUTH_URL: origem, BETTER_AUTH_SECRET: segredo }),
    ).toThrow();
  });

  it("exige HTTPS em produção", () => {
    expect(() =>
      carregarConfiguracaoAutenticacao({
        NODE_ENV: "production",
        BETTER_AUTH_URL: "http://selic.teste.local",
        BETTER_AUTH_SECRET: segredo,
      }),
    ).toThrow(/HTTPS/);
  });
});
