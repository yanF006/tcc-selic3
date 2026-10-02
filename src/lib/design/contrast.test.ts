import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CONTRASTE_NAO_TEXTO_AA,
  CONTRASTE_TEXTO_AA,
  lerTokensDoCss,
  razaoDeContraste,
} from "./contrast";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

const temas = [
  { nome: "claro", seletor: ":root" },
  { nome: "escuro", seletor: ".dark" },
  { nome: "impressao", seletor: ".impressao" },
] as const;

const paresDeTexto = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["muted-foreground", "background"],
  ["muted-foreground", "muted"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["success-foreground", "success"],
  ["warning-foreground", "warning"],
  ["info-foreground", "info"],
  ["destructive", "background"],
  ["success", "background"],
  ["warning", "background"],
  ["info", "background"],
  ["foreground", "muted"],
] as const;

describe.each(temas)("contraste no tema $nome", ({ seletor }) => {
  const tokens = lerTokensDoCss(css, seletor);

  it.each(paresDeTexto)("%s sobre %s atinge 4,5:1", (texto, fundo) => {
    expect(razaoDeContraste(tokens[texto], tokens[fundo])).toBeGreaterThanOrEqual(
      CONTRASTE_TEXTO_AA,
    );
  });

  it("anel de foco tem contraste de 3:1 contra o fundo", () => {
    expect(razaoDeContraste(tokens.ring, tokens.background)).toBeGreaterThanOrEqual(
      CONTRASTE_NAO_TEXTO_AA,
    );
  });

  it("borda de campo tem contraste de 3:1 contra o fundo", () => {
    expect(razaoDeContraste(tokens.input, tokens.background)).toBeGreaterThanOrEqual(
      CONTRASTE_NAO_TEXTO_AA,
    );
  });
});

describe("contrastes medidos", () => {
  it.each(temas)("registra as razões do tema $nome", ({ seletor }) => {
    const tokens = lerTokensDoCss(css, seletor);
    const medicoes = paresDeTexto.map(
      ([texto, fundo]) =>
        `${texto}/${fundo}=${razaoDeContraste(tokens[texto], tokens[fundo]).toFixed(2)}`,
    );

    console.log(`[contraste ${seletor}] ${medicoes.join(" ")}`);

    expect(medicoes.length).toBe(paresDeTexto.length);
  });
});