import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { Logo } from "./logo";

import {
  CONTRASTE_NAO_TEXTO_AA,
  CONTRASTE_TEXTO_AA,
  lerTokensDoCss,
  razaoDeContraste,
} from "@/lib/design/contrast";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const svg = readFileSync(join(process.cwd(), "public/selic-logo.svg"), "utf8");

/** Cores com que a marca oficial é desenhada. */
const coresDaMarca = [
  ...new Set([...svg.matchAll(/fill="(#[0-9a-fA-F]{3,8})"/g)].map((m) => m[1])),
];

const escopos = [
  { nome: "claro", seletor: ":root" },
  { nome: "escuro", seletor: ".dark" },
  { nome: "impressao", seletor: ".impressao" },
] as const;

describe("nome do logotipo", () => {
  it.each(escopos)("atinge 4,5:1 no escopo $nome", ({ seletor }) => {
    const tokens = lerTokensDoCss(css, seletor);

    expect(razaoDeContraste(tokens["logo-texto"], tokens.background)).toBeGreaterThanOrEqual(
      CONTRASTE_TEXTO_AA,
    );
  });
});

describe("marca oficial", () => {
  it.each(escopos)("tem contraste de 3:1 contra o fundo no escopo $nome", ({ seletor }) => {
    const tokens = lerTokensDoCss(css, seletor);

    for (const cor of coresDaMarca) {
      expect(razaoDeContraste(cor, tokens.background), cor).toBeGreaterThanOrEqual(
        CONTRASTE_NAO_TEXTO_AA,
      );
    }
  });

  it("é o arquivo versionado em Assets", () => {
    expect(svg).toBe(readFileSync(join(process.cwd(), "Assets/selic-logo.svg"), "utf8"));
  });
});

describe("logo", () => {
  it("mostra a marca e o nome uma vez cada", () => {
    render(<Logo />);

    expect(screen.getAllByText("SELic")).toHaveLength(1);
    expect(document.querySelector("[data-parte-logo='marca'] img")).toHaveAttribute(
      "src",
      "/selic-logo.svg",
    );
  });

  it("escala a marca sem fixar a largura da linha", () => {
    render(<Logo tamanho="pequeno" />);

    const marca = document.querySelector("[data-parte-logo='marca'] img") as HTMLImageElement;

    // A altura é o que dimensiona a marca; a largura acompanha o desenho, então
    // o nome não fica preso numa caixa menor que o próprio conteúdo.
    expect(marca.className).toContain("h-6");
    expect(marca.className).toContain("w-auto");
    expect(marca.className).not.toContain("size-");
  });
});
