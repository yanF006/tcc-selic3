import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DocumentPreview } from "./document-preview";

import { CONTRASTE_TEXTO_AA, lerTokensDoCss, razaoDeContraste } from "@/lib/design/contrast";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("escopo de tokens de impressão", () => {
  const impressao = lerTokensDoCss(css, ".impressao");
  const escuro = lerTokensDoCss(css, ".dark");

  it("mantém fundo claro e texto escuro, iguais aos do tema claro", () => {
    const claro = lerTokensDoCss(css, ":root");

    expect(impressao.background).toBe("#ffffff");
    expect(impressao.foreground).toBe("#111111");
    expect(impressao.background).toBe(claro.background);
  });

  it("não herda o fundo do tema escuro", () => {
    expect(escuro.background).not.toBe(impressao.background);
  });

  it("atinge 4,5:1 entre texto e fundo na folha", () => {
    expect(razaoDeContraste(impressao.foreground, impressao.background)).toBeGreaterThanOrEqual(
      CONTRASTE_TEXTO_AA,
    );
  });
});

describe("folha de preview", () => {
  it("renderiza o conteúdo dentro do escopo de impressão", () => {
    render(
      <DocumentPreview titulo="Termo de Compromisso de Estágio">
        <p>Maria de Souza</p>
      </DocumentPreview>,
    );

    const folha = screen.getByRole("document", { name: "Termo de Compromisso de Estágio" });

    expect(folha.className).toContain("impressao");
    expect(folha).toHaveTextContent("Maria de Souza");
  });

  it("identifica a folha para a verificação de impressão", () => {
    render(<DocumentPreview titulo="Ficha de Acompanhamento">conteúdo</DocumentPreview>);

    expect(document.querySelector("[data-preview-impressao]")).toBeInTheDocument();
  });
});

describe("regras de impressão", () => {
  it("esconde a interface e fixa a folha clara ao imprimir", () => {
    expect(css).toMatch(/@media print\s*{[^}]*\.sem-impressao\s*{[^}]*display:\s*none/);
    expect(css).toMatch(/@media print\s*{[\s\S]*?html\.dark,[\s\S]*?background:\s*#ffffff/);
  });
});
