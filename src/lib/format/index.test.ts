import { describe, expect, it } from "vitest";

import {
  chaveSemana,
  dataParaIso,
  diasEntre,
  formatarData,
  formatarDataExtensa,
  formatarDataHora,
  formatarHoras,
  formatarInteiro,
  formatarMoeda,
  formatarNumero,
  paraData,
  rotuloPeriodo,
} from "./index";

describe("formatarData", () => {
  it("formata data ISO em dd/mm/aaaa", () => {
    expect(formatarData("2026-02-01")).toBe("01/02/2026");
  });

  it("formata data já em formato brasileiro", () => {
    expect(formatarData("2026-12-31")).toBe("31/12/2026");
  });

  it("devolve travessão para valor ausente", () => {
    expect(formatarData(null)).toBe("—");
    expect(formatarData(undefined)).toBe("—");
  });

  it("formata a data extensa em português", () => {
    expect(formatarDataExtensa("2026-02-01")).toBe("01 de fevereiro de 2026");
  });

  it("formata data e hora no fuso de São Paulo", () => {
    expect(formatarDataHora("2026-02-01T14:30:00")).toContain("01/02/2026");
  });
});

describe("paraData", () => {
  it("cria data local sem deslocamento de fuso", () => {
    const data = paraData("2026-02-01");

    expect(data?.getFullYear()).toBe(2026);
    expect(data?.getMonth()).toBe(1);
    expect(data?.getDate()).toBe(1);
  });

  it("devolve null para texto inválido", () => {
    expect(paraData("não é data")).toBeNull();
  });
});

describe("formatarNumero e formatarMoeda", () => {
  it("formata número com duas casas", () => {
    expect(formatarNumero(6)).toBe("6,00");
    expect(formatarNumero(1234.5)).toBe("1.234,50");
  });

  it("formata inteiro sem casas decimais", () => {
    expect(formatarInteiro(1234)).toBe("1.234");
  });

  it("formata moeda em real", () => {
    expect(formatarMoeda(1500)).toContain("1.500,00");
    expect(formatarMoeda(1500)).toMatch(/R\$/);
  });

  it("formata horas com unidade", () => {
    expect(formatarHoras(120)).toBe("120,00 h");
  });
});

describe("datas em Iso e em brasileiro", () => {
  it("converte dd/mm/aaaa para aaaa-mm-dd", () => {
    expect(dataParaIso("01/02/2026")).toBe("2026-02-01");
  });

  it("mantém um valor já em ISO", () => {
    expect(dataParaIso("2026-02-01")).toBe("2026-02-01");
  });

  it("devolve null para formato desconhecido", () => {
    expect(dataParaIso("01-02-26")).toBeNull();
  });

  it("recusa data que não existe no calendário", () => {
    expect(dataParaIso("31/02/2026")).toBeNull();
    expect(dataParaIso("2026-02-31")).toBeNull();
    expect(dataParaIso("00/01/2026")).toBeNull();
    expect(dataParaIso("29/02/2024")).toBe("2024-02-29");
    expect(dataParaIso("29/02/2026")).toBeNull();
  });
});

describe("período e semanas", () => {
  it("monta o rótulo do período letivo", () => {
    expect(rotuloPeriodo(2026, 1)).toBe("2026.1");
  });

  it("calcula dias entre duas datas", () => {
    expect(diasEntre("2026-02-01", "2026-02-28")).toBe(27);
  });

  it("agrupa a data na segunda-feira da semana", () => {
    // 2026-02-01 é um domingo; a semana começa em 2026-01-26.
    expect(chaveSemana("2026-02-01")).toBe("2026-01-26");
  });

  it("mantém a segunda-feira na própria chave", () => {
    expect(chaveSemana("2026-01-26")).toBe("2026-01-26");
  });
});
