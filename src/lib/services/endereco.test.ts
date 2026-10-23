import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarEnderecoPorCep } from "./endereco";
import { consultarViaCep } from "./viacep-servidor";
import { GET } from "@/app/api/enderecos/cep/route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const resposta = (dados: unknown, status = 200) => new Response(JSON.stringify(dados), { status });
const endereco = {
  cep: "23940-000",
  logradouro: "Rua Nova",
  bairro: "Centro",
  localidade: "Pinheiral",
  uf: "RJ",
  complemento: "Ignorar",
};
const simular = (dados: unknown, status = 200) =>
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async () => resposta(dados, status)),
  );

describe("consulta de CEP", () => {
  it("normaliza a entrada e mapeia o provedor sem número/complemento", async () => {
    simular(endereco);
    const esperado = {
      status: "encontrado",
      endereco: {
        cep: "23940000",
        logradouro: "Rua Nova",
        bairro: "Centro",
        cidade: "Pinheiral",
        estado: "RJ",
      },
    };
    expect(await consultarViaCep("23940-000")).toEqual(esperado);
    expect(await consultarViaCep("23940000")).toEqual(esperado);
    expect(fetch).toHaveBeenCalledWith(
      "https://viacep.com.br/ws/23940000/json/",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
  it("não transporta CEP inválido na fachada, rota ou adaptador", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect(await buscarEnderecoPorCep("123")).toEqual({ status: "invalido" });
    expect(await consultarViaCep("https://exemplo.com")).toEqual({ status: "invalido" });
    expect((await GET(new Request("http://localhost/api/enderecos/cep?cep=abc"))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([true, "true"])("distingue CEP inexistente (%s)", async (erro) => {
    simular({ erro });
    expect(await consultarViaCep("99999999")).toEqual({ status: "nao_encontrado" });
  });
  it("aceita resposta parcial sem preencher campos vazios", async () => {
    simular({ cep: "23940000", localidade: "Pinheiral", bairro: " " });
    expect(await consultarViaCep("23940000")).toEqual({
      status: "encontrado",
      endereco: { cep: "23940000", cidade: "Pinheiral" },
    });
  });
  it.each([null, [], {}, { cep: "23940000" }, { ...endereco, cep: "20040030" }])(
    "rejeita resposta inutilizável: %j",
    async (dados) => {
      simular(dados);
      expect(await consultarViaCep("23940000")).toEqual({ status: "indisponivel" });
    },
  );
  it("trata HTTP, JSON e falha de rede sem repetir", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(resposta({}, 503))
        .mockResolvedValueOnce(new Response("invalido"))
        .mockRejectedValueOnce(new Error("offline")),
    );
    for (let i = 0; i < 3; i++)
      expect(await consultarViaCep("23940000")).toEqual({ status: "indisponivel" });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it.each([
    [consultarViaCep, 5_000],
    [buscarEnderecoPorCep, 7_000],
  ] as const)("limita a espera e limpa o temporizador", async (consulta, tempo) => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, opcoes) =>
          new Promise((_resolve, reject) =>
            opcoes.signal.addEventListener("abort", () => reject(opcoes.signal.reason)),
          ),
      ),
    );
    const pendente = consulta("23940000");
    await vi.advanceTimersByTimeAsync(tempo);
    expect(await pendente).toEqual({ status: "indisponivel" });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("propaga cancelamento deliberado", async () => {
    const controle = new AbortController();
    controle.abort();
    vi.stubGlobal("fetch", vi.fn());
    await expect(buscarEnderecoPorCep("23940000", controle.signal)).rejects.toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("oferece rota pública com status e sem cache", async () => {
    simular(endereco);
    const resultado = await GET(new Request("http://localhost/api/enderecos/cep?cep=23940000"));
    expect(resultado.status).toBe(200);
    expect(resultado.headers.get("Cache-Control")).toBe("no-store");
    expect(await resultado.json()).toMatchObject({
      status: "encontrado",
      endereco: { cidade: "Pinheiral" },
    });
    simular({ erro: true });
    expect((await GET(new Request("http://localhost/api/enderecos/cep?cep=99999999"))).status).toBe(
      200,
    );
    simular({}, 500);
    expect((await GET(new Request("http://localhost/api/enderecos/cep?cep=23940000"))).status).toBe(
      503,
    );
  });
  it("fachada normaliza CEP e valida o corpo/status", async () => {
    simular({ status: "encontrado", endereco: { cep: "23940000", cidade: "Pinheiral" } });
    expect(await buscarEnderecoPorCep("23940-000")).toMatchObject({ status: "encontrado" });
    expect(fetch).toHaveBeenCalledWith("/api/enderecos/cep?cep=23940000", expect.anything());
    for (const dados of [
      {},
      { status: "encontrado", endereco: { cep: "20040030", cidade: "Rio" } },
      { status: "invalido" },
    ]) {
      simular(dados);
      expect(await buscarEnderecoPorCep("23940000")).toEqual({ status: "indisponivel" });
    }
    simular({ status: "indisponivel" }, 503);
    expect(await buscarEnderecoPorCep("23940000")).toEqual({ status: "indisponivel" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await buscarEnderecoPorCep("23940000")).toEqual({ status: "indisponivel" });
  });
});
