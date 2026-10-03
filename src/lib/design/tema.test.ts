import { describe, expect, it } from "vitest";

import {
  TEMAS,
  resolverTema,
  temaDoSistema,
  type TemaAplicado,
  type TemaPreferido,
} from "@/lib/design/tema";

describe("preferência de tema", () => {
  it("oferece as três opções de tema", () => {
    expect(TEMAS.map((tema) => tema.valor)).toEqual(["light", "dark", "system"]);
    expect(TEMAS.map((tema) => tema.rotulo)).toEqual(["Claro", "Escuro", "Sistema"]);
  });

  it("mantém a preferência explícita mesmo com o sistema no outro tema", () => {
    const casos: [TemaPreferido, TemaAplicado, TemaAplicado][] = [
      ["light", "dark", "light"],
      ["dark", "light", "dark"],
    ];

    for (const [preferido, sistema, esperado] of casos) {
      expect(resolverTema(preferido, sistema)).toBe(esperado);
    }
  });

  it("acompanha a preferência do sistema quando a opção é Sistema", () => {
    expect(resolverTema("system", "dark")).toBe("dark");
    expect(resolverTema("system", "light")).toBe("light");
  });

  it("converte a preferência do sistema reportada pelo navegador", () => {
    expect(temaDoSistema(true)).toBe("dark");
    expect(temaDoSistema(false)).toBe("light");
  });
});
