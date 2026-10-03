import { describe, expect, it } from "vitest";

import { buscarEnderecoPorCep } from "./endereco";

describe("busca de endereço por CEP", () => {
  it("devolve logradouro, bairro, cidade e estado de um CEP existente", async () => {
    const endereco = await buscarEnderecoPorCep("23940-000");

    expect(endereco).toEqual({
      cep: "23940000",
      logradouro: "Rua das Acácias",
      bairro: "Centro",
      cidade: "Pinheiral",
      estado: "RJ",
    });
  });

  it("aceita o CEP com ou sem máscara", async () => {
    const comMascara = await buscarEnderecoPorCep("23935-000");
    const semMascara = await buscarEnderecoPorCep("23935000");

    expect(comMascara).not.toBeNull();
    expect(semMascara).toEqual(comMascara);
  });

  it("devolve null para CEP inexistente, mantendo o preenchimento manual", async () => {
    await expect(buscarEnderecoPorCep("99999-999")).resolves.toBeNull();
  });

  it("devolve null para CEP incompleto ou com letras", async () => {
    await expect(buscarEnderecoPorCep("2394-000")).resolves.toBeNull();
    await expect(buscarEnderecoPorCep("abcdefgh")).resolves.toBeNull();
  });
});