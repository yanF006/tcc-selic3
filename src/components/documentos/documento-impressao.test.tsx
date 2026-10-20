import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DocumentoImpressao } from "./documento-impressao";

import { descritorPorTemplate } from "@/lib/templates/descriptors";

describe("folha de impressão do documento", () => {
  it("desenha os valores legíveis dentro do escopo de impressão", () => {
    const descriptor = descritorPorTemplate("tpl-ficha-frequencia")!;

    render(
      <DocumentoImpressao
        descriptor={descriptor}
        valores={{
          aluno: "Maria de Souza",
          endereco: "Rua das Acácias, 215",
          areaAtuacao: "Desenvolvimento de software",
          meses: [{ ano: 2026, mes: "Maio", diasUteis: 21, diasTrabalhados: 20, horasTrabalhadas: 160 }],
        }}
      />,
    );

    const folha = screen.getByRole("document", {
      name: "Ficha Individual de Frequência e Avaliação",
    });

    expect(folha.className).toContain("impressao");
    expect(folha).toHaveTextContent("Maria de Souza");
    expect(folha).toHaveTextContent("Rua das Acácias, 215");
    expect(folha).toHaveTextContent("Maio · 21 · 20 · 160");
    expect(document.querySelector("[data-preview-impressao]")).toBeInTheDocument();
  });

  it("não renderiza controle de formulário, apenas texto", () => {
    const descriptor = descritorPorTemplate("tpl-termo-compromisso")!;

    render(<DocumentoImpressao descriptor={descriptor} valores={{}} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
