/** Valores mínimos do documento "Convênio de Estágio" usados no cadastro. */
export function documentoConvenio(
  razaoSocial: string,
  cnpj: string,
  inicioVigencia: string,
  extra: Record<string, unknown> = {},
) {
  return {
    dadosDocumento: {
      razaoSocial,
      cnpj,
      // Como o formulário envia: dd/mm/aaaa.
      inicioVigencia: inicioVigencia.split("-").reverse().join("/"),
      responsavel: "Representante Legal",
      cep: "27197-000",
      logradouro: "Rua do Convênio",
      numero: "10",
      bairro: "Centro",
      cidade: "Pinheiral",
      uf: "RJ",
      endereco: "Rua do Convênio, 10, Centro",
      ...extra,
    },
  };
}
