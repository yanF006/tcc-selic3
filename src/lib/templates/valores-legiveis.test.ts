import { describe, expect, it } from "vitest";

import { valoresLegiveis } from "./valores-legiveis";

import type { DescriptorDocumento } from "@/lib/templates/descriptors";

const DESCRITOR: DescriptorDocumento = {
  templateId: "tpl-teste",
  titulo: "Documento de teste",
  descricao: "Descritor de teste",
  preenchivel: true,
  auto: [
    { id: "campus", rotulo: "Campus", tipo: "texto", origem: "literal", somenteLeitura: true },
  ],
  secoes: [
    {
      id: "campos",
      titulo: "Campos",
      campos: [
        { id: "texto", rotulo: "Texto", tipo: "texto", origem: "digitado" },
        {
          id: "grade",
          rotulo: "Meses",
          tipo: "grade",
          origem: "digitado",
          colunas: [
            { chave: "mes", rotulo: "Mês", tipo: "texto" },
            { chave: "horas", rotulo: "Horas", tipo: "numero" },
          ],
        },
        { id: "fixo", rotulo: "Texto fixo", tipo: "fixo", origem: "literal", ajuda: "Conteúdo fixo." },
        {
          id: "instrucao",
          rotulo: "Instrução",
          tipo: "instrucao",
          origem: "literal",
          ajuda: "Orienta o preenchimento.",
        },
        { id: "vazio", rotulo: "Vazio", tipo: "texto", origem: "digitado" },
      ],
    },
  ],
};

describe("valoresLegiveis", () => {
  it("mantém o valor digitado e o texto fixo do descritor", () => {
    const legiveis = valoresLegiveis(DESCRITOR, { campus: "Pinheiral", texto: "Maria" });

    expect(legiveis.campus).toBe("Pinheiral");
    expect(legiveis.texto).toBe("Maria");
    expect(legiveis.fixo).toBe("Conteúdo fixo.");
  });

  it("junta as linhas de uma grade em um texto legível", () => {
    const legiveis = valoresLegiveis(DESCRITOR, {
      grade: [
        { mes: "Maio", horas: 160 },
        { mes: "Junho", horas: 120 },
      ],
    });

    expect(legiveis.grade).toBe("Maio · 160 ; Junho · 120");
  });

  it("não exibe instrução de preenchimento como valor e marca vazio", () => {
    const legiveis = valoresLegiveis(DESCRITOR, {});

    expect(legiveis.instrucao).toBe("");
    expect(legiveis.vazio).toBe("—");
  });
});
