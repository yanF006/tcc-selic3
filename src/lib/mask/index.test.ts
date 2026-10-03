import { describe, expect, it } from "vitest";

import {
  MASCARAS,
  mascaraCep,
  mascaraCelular,
  mascaraCpf,
  mascaraData,
  mascaraHora,
  mascaraHoras,
  mascaraRg,
  mascaraTelefone,
  mascaraTelefoneOuCelular,
} from "./index";

describe("máscaraCpf", () => {
  it.each([
    ["", ""],
    ["1", "1"],
    ["123", "123"],
    ["123456", "123.456"],
    ["123456789", "123.456.789"],
    ["12345678901", "123.456.789-01"],
  ])("aplica a máscara em %j", (entrada, esperado) => {
    expect(mascaraCpf(entrada)).toBe(esperado);
  });

  it("recusa letras e símbolos", () => {
    expect(mascaraCpf("abc123.456x789-01")).toBe("123.456.789-01");
  });

  it("limita a onze dígitos mesmo colando texto maior", () => {
    expect(mascaraCpf("123456789012345")).toBe("123.456.789-01");
  });
});

describe("máscaraRg", () => {
  it("formata o padrão de nove dígitos", () => {
    expect(mascaraRg("123456789")).toBe("12.34567-89");
  });

  it("formata o padrão de sete dígitos", () => {
    expect(mascaraRg("1234567")).toBe("12.34567");
  });
});

describe("máscaraCelular", () => {
  it("formata celular de nove dígitos", () => {
    expect(mascaraCelular("2198765432")).toBe("(21) 9876-5432");
  });

  it("formata celular de onze dígitos", () => {
    expect(mascaraCelular("21998765432")).toBe("(21) 99876-5432");
  });

  it("formata durante a digitação", () => {
    expect(mascaraCelular("2198")).toBe("(21) 98");
  });
});

describe("máscaraTelefone", () => {
  it("formata telefone fixo", () => {
    expect(mascaraTelefone("2133334444")).toBe("(21) 3333-4444");
  });

  it("escolhe celular quando há onze dígitos", () => {
    expect(mascaraTelefoneOuCelular("21998765432")).toBe("(21) 99876-5432");
  });

  it("escolhe fixo quando há dez dígitos", () => {
    expect(mascaraTelefoneOuCelular("2133334444")).toBe("(21) 3333-4444");
  });
});

describe("máscaraCep", () => {
  it("formata o CEP de oito dígitos", () => {
    expect(mascaraCep("23940000")).toBe("23940-000");
  });

  it("formata parcialmente durante a digitação", () => {
    expect(mascaraCep("23940")).toBe("23940");
  });
});

describe("máscaraData", () => {
  it("formata dd/mm/aaaa", () => {
    expect(mascaraData("01022026")).toBe("01/02/2026");
  });

  it("formata parcialmente durante a digitação", () => {
    expect(mascaraData("0102")).toBe("01/02");
  });
});

describe("máscaraHora e máscaraHoras", () => {
  it("formata o horário", () => {
    expect(mascaraHora("0830")).toBe("08:30");
  });

  it("formata as horas com uma casa decimal", () => {
    expect(mascaraHoras("55")).toBe("5,5");
  });
});

describe("catálogo de máscaras", () => {
  it("exibe todas as máscaras aplicadas no catálogo", () => {
    expect(Object.keys(MASCARAS).sort()).toEqual(
      [
        "celular",
        "cep",
        "cpf",
        "data",
        "hora",
        "horas",
        "rg",
        "telefone",
        "telefoneOuCelular",
      ].sort(),
    );
  });

  it("nenhuma máscara devolve letras", () => {
    const entradas = ["abc", "a1b2c3", "---", "()"];

    for (const mascara of Object.values(MASCARAS)) {
      for (const entrada of entradas) {
        expect(mascara(entrada)).not.toMatch(/[a-zA-Z]/);
      }
    }
  });
});
