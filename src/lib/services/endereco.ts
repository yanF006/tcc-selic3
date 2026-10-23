import { esquemaCep } from "@/lib/domain/schemas";
import { esquemaResultadoCep, mensagensCep, type ResultadoCep } from "@/lib/domain/consulta-cep";
import { requisicaoCep } from "./requisicao-cep";

export type { EnderecoPorCep, ResultadoCep } from "@/lib/domain/consulta-cep";
export const CEP_NAO_ENCONTRADO = mensagensCep.nao_encontrado;

export async function buscarEnderecoPorCep(
  cep: string,
  sinal?: AbortSignal,
): Promise<ResultadoCep> {
  const valido = esquemaCep.safeParse(cep);
  if (!valido.success) return { status: "invalido" };
  try {
    return await requisicaoCep(
      `/api/enderecos/cep?cep=${valido.data}`,
      7_000,
      async (resposta) => {
        const resultado = esquemaResultadoCep.safeParse(await resposta.json());
        if (!resultado.success) return { status: "indisponivel" };
        const esperado =
          resultado.data.status === "invalido"
            ? 400
            : resultado.data.status === "indisponivel"
              ? 503
              : 200;
        if (resposta.status !== esperado) return { status: "indisponivel" };
        if (resultado.data.status === "encontrado" && resultado.data.endereco.cep !== valido.data)
          return { status: "indisponivel" };
        return resultado.data;
      },
      sinal,
    );
  } catch (erro) {
    if (sinal?.aborted) throw erro;
    return { status: "indisponivel" };
  }
}
