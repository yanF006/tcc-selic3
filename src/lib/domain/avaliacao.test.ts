import { describe, expect, it } from "vitest";

import { conceitoGlobalDasNotas, faixaDaNota, faixaDeNota } from "./avaliacao";
import { camposDoTemplate } from "@/lib/templates/descriptors";

describe("faixaDeNota", () => {
  it("enquadra cada nota em E, B, R e I nos limites das faixas", () => {
    expect(faixaDeNota(10)).toBe("E");
    expect(faixaDeNota(9)).toBe("E");
    expect(faixaDeNota(9.5)).toBe("E");
    expect(faixaDeNota(8.9)).toBe("B");
    expect(faixaDeNota(8)).toBe("B");
    expect(faixaDeNota(7)).toBe("B");
    expect(faixaDeNota(6.9)).toBe("R");
    expect(faixaDeNota(6)).toBe("R");
    expect(faixaDeNota(5)).toBe("R");
    expect(faixaDeNota(4.9)).toBe("I");
    expect(faixaDeNota(3)).toBe("I");
    expect(faixaDeNota(0)).toBe("I");
  });

  it("detalha a faixa com o intervalo exato", () => {
    expect(faixaDaNota(9.5)).toMatchObject({ faixa: "E", de: 9, ate: 10 });
    expect(faixaDaNota(7.5)).toMatchObject({ faixa: "B" });
    expect(faixaDaNota(5.5)).toMatchObject({ faixa: "R" });
    expect(faixaDaNota(2.5)).toMatchObject({ faixa: "I" });
  });

  it("calcula o conceito global como a média com uma casa decimal", () => {
    expect(conceitoGlobalDasNotas([10, 8, 6, 4])).toBe(7);
    expect(conceitoGlobalDasNotas([9.5, 9.5])).toBe(9.5);
    expect(conceitoGlobalDasNotas([])).toBe(0);
  });

  it("gera a escala qualitativa da autoavaliação com um único nível por fator", () => {
    const fatores = camposDoTemplate("tpl-relatorio-semestral").filter((campo) =>
      campo.id.startsWith("autoavaliacao_"),
    );
    expect(fatores).toHaveLength(11);
    for (const fator of fatores) {
      expect(fator.tipo).toBe("radio");
      expect(fator.obrigatorio).toBe(true);
      expect(fator.opcoes?.map((opcao) => opcao.valor)).toEqual([
        "otimo",
        "bom",
        "regular",
        "insuficiente",
      ]);
    }
  });
});
