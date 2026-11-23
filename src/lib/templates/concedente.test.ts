import { describe, expect, it } from "vitest";
import { completarComConvenio, descritorCadastroConvenio } from "./concedente";

const convenio = {
  razaoSocial: "Escola Modelo",
  cnpj: "11.222.333/0001-81",
  responsavel: "Maria Diretora",
  telefone: "(24) 3333-4444",
  email: "contato@escola.test",
  cep: "27197-000",
  logradouro: "Rua A",
  numero: "10",
  complemento: "",
  bairro: "Centro",
  cidade: "Pinheiral",
  uf: "RJ",
  endereco: "Rua A, 10, Centro",
};

describe("dados da concedente vindos do convênio", () => {
  it("completa campos e endereço vazios do Termo de Compromisso", () => {
    const valores = completarComConvenio(
      "tpl-termo-compromisso",
      { cnpj: "", telefone: "" },
      convenio,
    );
    expect(valores).toMatchObject({
      cnpj: convenio.cnpj,
      responsavel: "Maria Diretora",
      telefone: convenio.telefone,
      email: convenio.email,
      logradouro: "Rua A",
      cidade: "Pinheiral",
      uf: "RJ",
      endereco: "Rua A, 10, Centro",
    });
  });

  it("preserva o que já foi digitado e não mistura endereços", () => {
    const valores = completarComConvenio(
      "tpl-termo-compromisso",
      { responsavel: "Outro Representante", cidade: "Volta Redonda" },
      convenio,
    );
    expect(valores.responsavel).toBe("Outro Representante");
    expect(valores.cidade).toBe("Volta Redonda");
    expect(valores.logradouro).toBeUndefined();
    expect(valores.cnpj).toBe(convenio.cnpj);
  });

  it("usa os grupos de endereço de cada documento", () => {
    expect(completarComConvenio("tpl-relatorio-semestral", {}, convenio)).toMatchObject({
      instituicaoLogradouro: "Rua A",
      instituicaoEndereco: "Rua A, 10, Centro",
      instituicaoTelefone: convenio.telefone,
      instituicaoEmail: convenio.email,
    });
    expect(completarComConvenio("tpl-formulario-liberacao", {}, convenio)).toMatchObject({
      logradouroLocal: "Rua A",
      enderecoLocal: "Rua A, 10, Centro",
    });
  });

  it("não altera nada sem dados do convênio", () => {
    expect(completarComConvenio("tpl-termo-compromisso", { cnpj: "" }, undefined)).toEqual({
      cnpj: "",
    });
  });

  it("o cadastro pede a concedente e o início da vigência, sem fim, cláusulas ou assinaturas", () => {
    const ids = descritorCadastroConvenio().secoes.flatMap((secao) =>
      secao.campos.map((campo) => campo.id),
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        "razaoSocial",
        "cnpj",
        "responsavel",
        "logradouro",
        "inicioVigencia",
      ]),
    );
    expect(ids).not.toEqual(expect.arrayContaining(["fimVigencia"]));
    expect(ids).not.toContain("assinaturaCoordenador");
    expect(ids).not.toContain("clausulas");
  });
});
