import { esquemaCep } from "@/lib/domain/schemas";

/**
 * Busca de endereço por CEP (6.4).
 *
 * A consulta real é do ViaCEP, com o backend fazendo a requisição e devolvendo
 * logradouro, bairro, cidade e estado. Nesta entrega a base fica em memória, com
 * os CEPs que os fixtures e as telas usam, para o fluxo ser demonstrável de
 * ponta a ponta; trocar por fetch é mexer só nesta função, porque o resto da
 * tela já trata "encontrado" e "não encontrado" do mesmo jeito.
 *
 * O número e o complemento nunca vêm do CEP: são os únicos campos que o aluno
 * preenche sozinho, então ficam de fora do catálogo e do retorno.
 */

/** Endereço que a consulta devolve, sem os campos que o aluno preenche. */
export interface EnderecoPorCep {
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

/** Base em memória de CEPs conhecidos, com a chave em oito dígitos. */
const CATALOGO_CEP: Record<string, EnderecoPorCep> = {
  "23940000": {
    cep: "23940-000",
    logradouro: "Rua das Acácias",
    bairro: "Centro",
    cidade: "Pinheiral",
    estado: "RJ",
  },
  "23935000": {
    cep: "23935-000",
    logradouro: "Avenida Brasil",
    bairro: "Centro",
    cidade: "Volta Redonda",
    estado: "RJ",
  },
  "27511000": {
    cep: "27511-000",
    logradouro: "Avenida Getúlio Vargas",
    bairro: "Centro",
    cidade: "Barra Mansa",
    estado: "RJ",
  },
  "20040030": {
    cep: "20040-030",
    logradouro: "Avenida Rio Branco",
    bairro: "Centro",
    cidade: "Rio de Janeiro",
    estado: "RJ",
  },
};

/** Mensagem para o CEP que não existe no catálogo. */
export const CEP_NAO_ENCONTRADO = "CEP não encontrado. Confira o número ou preencha o endereço.";

/**
 * Consulta o endereço de um CEP.
 *
 * Devolve `null` para CEP inválido e para CEP que não está no catálogo, que é o
 * mesmo caminho da tela: sinalizar e deixar o aluno preencher o endereço à mão.
 */
export async function buscarEnderecoPorCep(cep: string): Promise<EnderecoPorCep | null> {
  const valido = esquemaCep.safeParse(cep);

  if (!valido.success) return null;

  const encontrado = CATALOGO_CEP[valido.data];

  if (!encontrado) return null;

  return { ...encontrado, cep: valido.data };
}
