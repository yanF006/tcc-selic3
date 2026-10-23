import * as React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useConsultaEndereco } from "./use-consulta-endereco";
import type { Endereco } from "@/lib/domain/types";
import type { ResultadoCep } from "@/lib/domain/consulta-cep";
import { buscarEnderecoPorCep } from "@/lib/services/endereco";

vi.mock("@/lib/services/endereco", () => ({ buscarEnderecoPorCep: vi.fn() }));
afterEach(() => vi.clearAllMocks());
const sucesso = (cep = "23940000"): ResultadoCep => ({
  status: "encontrado",
  endereco: { cep, logradouro: "Rua consultada", cidade: "Pinheiral" },
});
function preparar(habilitado = true) {
  return renderHook(
    ({ habilitado, identidade }) => {
      const [valores, setValores] = React.useState<Partial<Endereco>>({
        cep: "23940000",
        logradouro: "Original",
        bairro: "Manual",
        numero: "55",
        complemento: "Sala",
      });
      const consulta = useConsultaEndereco({
        valores,
        habilitado,
        identidade,
        aoMudar: (novos) => setValores((v) => ({ ...v, ...novos })),
      });
      return { ...consulta, valores };
    },
    { initialProps: { habilitado, identidade: 0 } },
  );
}

describe("controlador de endereço", () => {
  it("mantém consultas de duas instâncias independentes", async () => {
    vi.mocked(buscarEnderecoPorCep).mockImplementation(async (cep) =>
      cep === "23940000" ? sucesso() : { status: "nao_encontrado" },
    );
    const primeiro = preparar();
    const segundo = preparar();
    await act(async () => {
      await primeiro.result.current.consultar();
      segundo.result.current.mudar("cep", "99999999");
    });
    await waitFor(() => expect(segundo.result.current.estado).toBe("nao_encontrado"));
    expect(primeiro.result.current.estado).toBe("encontrado");
    expect(primeiro.result.current.valores.logradouro).toBe("Rua consultada");
    expect(segundo.result.current.valores.logradouro).toBe("Original");
  });
  it("não consulta na montagem, máscara ou edição de outro campo", () => {
    const { result } = preparar();
    act(() => result.current.mudar("cep", "23940-000"));
    act(() => result.current.mudar("numero", "s/n"));
    expect(buscarEnderecoPorCep).not.toHaveBeenCalled();
  });
  it("habilitar edição não consulta e modo protegido impede consulta", async () => {
    const { result, rerender } = preparar(false);
    await act(() => result.current.consultar());
    act(() => result.current.mudar("cep", "20040030"));
    rerender({ habilitado: true, identidade: 0 });
    expect(buscarEnderecoPorCep).not.toHaveBeenCalled();
  });
  it("consulta automaticamente por mudança e preenche apenas dados disponíveis", async () => {
    vi.mocked(buscarEnderecoPorCep).mockResolvedValue(sucesso("20040030"));
    const { result } = preparar();
    act(() => result.current.mudar("cep", "20040-030"));
    await waitFor(() => expect(result.current.estado).toBe("encontrado"));
    expect(result.current.valores).toMatchObject({
      logradouro: "Rua consultada",
      bairro: "Manual",
      numero: "55",
      complemento: "Sala",
    });
  });
  it("valida antes de consultar e permite consulta explícita do CEP atual", async () => {
    vi.mocked(buscarEnderecoPorCep).mockResolvedValue(sucesso());
    const { result } = preparar();
    await act(() => result.current.consultar("123"));
    expect(result.current.estado).toBe("invalido");
    expect(buscarEnderecoPorCep).not.toHaveBeenCalled();
    await act(() => result.current.consultar());
    expect(result.current.estado).toBe("encontrado");
  });
  it("preserva edição manual inclusive desfeita durante a espera", async () => {
    let resolver!: (r: ResultadoCep) => void;
    vi.mocked(buscarEnderecoPorCep).mockImplementation(
      () =>
        new Promise((r) => {
          resolver = r;
        }),
    );
    const { result } = preparar();
    act(() => {
      void result.current.consultar();
    });
    act(() => result.current.mudar("logradouro", "Correção"));
    act(() => result.current.mudar("logradouro", "Original"));
    await act(async () => resolver(sucesso()));
    expect(result.current.valores.logradouro).toBe("Original");
    expect(result.current.valores.cidade).toBe("Pinheiral");
  });
  it("ignora respostas antigas mesmo no ciclo A → B → A e mantém estado recente", async () => {
    const resolver: ((r: ResultadoCep) => void)[] = [];
    vi.mocked(buscarEnderecoPorCep).mockImplementation(() => new Promise((r) => resolver.push(r)));
    const { result } = preparar();
    act(() => {
      void result.current.consultar();
    });
    act(() => result.current.mudar("cep", "20040030"));
    act(() => result.current.mudar("cep", "23940000"));
    await act(async () => {
      resolver[0](sucesso());
      resolver[1]({ status: "nao_encontrado" });
    });
    expect(result.current.estado).toBe("consultando");
    expect(result.current.valores.logradouro).toBe("Original");
    await act(async () => resolver[2](sucesso()));
    expect(result.current.estado).toBe("encontrado");
  });
  it.each(["identidade", "habilitado", "salvamento", "desmontagem"])(
    "invalida resposta pendente: %s",
    async (evento) => {
      let resolver!: (r: ResultadoCep) => void;
      let sinal: AbortSignal | undefined;
      vi.mocked(buscarEnderecoPorCep).mockImplementation((_cep, s) => {
        sinal = s;
        return new Promise((r) => {
          resolver = r;
        });
      });
      const { result, rerender, unmount } = preparar();
      act(() => {
        void result.current.consultar();
      });
      if (evento === "identidade") rerender({ habilitado: true, identidade: 1 });
      if (evento === "habilitado") rerender({ habilitado: false, identidade: 0 });
      if (evento === "salvamento") act(() => result.current.invalidar());
      if (evento === "desmontagem") unmount();
      expect(sinal?.aborted).toBe(true);
      await act(async () => resolver(sucesso()));
      expect(result.current.valores.logradouro).toBe("Original");
    },
  );
});
