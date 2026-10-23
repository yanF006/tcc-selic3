import { esquemaCep } from "@/lib/domain/schemas";
import {
  camposConsultaveis,
  type EnderecoPorCep,
  type ResultadoCep,
} from "@/lib/domain/consulta-cep";
import { requisicaoCep } from "./requisicao-cep";

/** Adaptador de servidor; importado somente pelo Route Handler. */
export async function consultarViaCep(cep: string, sinal?: AbortSignal): Promise<ResultadoCep> {
  const valido = esquemaCep.safeParse(cep);
  if (!valido.success) return { status: "invalido" };
  try {
    return await requisicaoCep(
      `https://viacep.com.br/ws/${valido.data}/json/`,
      5_000,
      async (resposta) => {
        if (!resposta.ok) return { status: "indisponivel" };
        const dados: unknown = await resposta.json();
        if (!dados || typeof dados !== "object" || Array.isArray(dados))
          return { status: "indisponivel" };
        const registro = dados as Record<string, unknown>;
        if (registro.erro === true || registro.erro === "true") return { status: "nao_encontrado" };
        const recebido = esquemaCep.safeParse(registro.cep);
        if (!recebido.success || recebido.data !== valido.data) return { status: "indisponivel" };
        const endereco: EnderecoPorCep = { cep: valido.data };
        const origem = {
          logradouro: "logradouro",
          bairro: "bairro",
          cidade: "localidade",
          estado: "uf",
        };
        for (const campo of camposConsultaveis) {
          const valor = registro[origem[campo]];
          if (typeof valor === "string" && valor.trim()) endereco[campo] = valor.trim();
        }
        if (!camposConsultaveis.some((campo) => endereco[campo])) return { status: "indisponivel" };
        return { status: "encontrado", endereco };
      },
      sinal,
    );
  } catch (erro) {
    if (sinal?.aborted) throw erro;
    return { status: "indisponivel" };
  }
}
