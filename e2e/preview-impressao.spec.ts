import { expect, test } from "@playwright/test";

/**
 * Preview de documento independente do tema (2.5): a folha abre clara mesmo
 * com a interface no tema escuro e, na impressão, a interface some e o papel
 * sai branco com texto preto, sem áreas escuras de fundo.
 *
 * A conferência usa `emulateMedia({ media: "print" })`, que aplica exatamente as
 * regras de `@media print` que o navegador usa ao imprimir. A varredura de
 * cores cobre a folha do documento, que é o que vai ao papel; a página
 * dedicada ao preview (8.13) não carrega outra interface ao redor.
 */

const FOLHA = "[data-preview-impressao]";

/** Cor de fundo computada do primeiro elemento que casar com o seletor. */
async function fundoDe(page: import("@playwright/test").Page, seletor: string) {
  return page
    .locator(seletor)
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
}

/**
 * Lista os elementos visíveis fora do esperado dentro do escopo: fundo claro
 * demais ou texto escuro demais na folha. A folha é conteúdo de impressão,
 * então fundo tem de ser branco e texto tem de ser preto.
 */
async function coresForaDoEsperado(
  page: import("@playwright/test").Page,
  seletor: string,
  propriedade: "backgroundColor" | "color",
) {
  return page.evaluate(
    ({ raiz, propriedade }) => {
      const encontradas: string[] = [];
      const inicio = document.querySelector(raiz);

      if (!inicio) return encontradas;

      for (const elemento of Array.from(inicio.querySelectorAll<HTMLElement>("*"))) {
        const estilo = getComputedStyle(elemento);
        const caixa = elemento.getBoundingClientRect();

        if (estilo.display === "none" || estilo.visibility === "hidden") continue;
        if (caixa.width === 0 || caixa.height === 0) continue;

        const valor = estilo[propriedade];
        const canais = valor.match(/[\d.]+/g);

        if (!canais) continue;

        const [r, g, b, a] = canais.map(Number);

        if (propriedade === "backgroundColor" && a === 0) continue;

        const luminancia = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        const foraDoEsperado =
          propriedade === "backgroundColor" ? luminancia < 0.5 : luminancia > 0.5;

        if (foraDoEsperado) encontradas.push(`${elemento.tagName}: ${valor}`);
      }

      return encontradas;
    },
    { raiz: seletor, propriedade },
  );
}

test.describe("preview de documento", () => {
  test("abre claro com a interface no tema escuro", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));
    await page.goto("/laboratorio");

    await expect(page.locator("html")).toHaveClass(/dark/);

    const folha = page.locator(FOLHA);

    await expect(folha).toBeVisible();
    expect(await fundoDe(page, FOLHA)).toBe("rgb(255, 255, 255)");
    expect(await folha.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(17, 17, 17)");
    await expect(folha).toContainText("Termo de Compromisso de Estágio");
  });

  test("imprime a folha branca e sem cor escura", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));
    await page.goto("/laboratorio");

    await page.emulateMedia({ media: "print" });

    expect(await fundoDe(page, "html")).toBe("rgb(255, 255, 255)");
    expect(await fundoDe(page, "body")).toBe("rgb(255, 255, 255)");

    await expect(page.getByRole("button", { name: "Imprimir documento" })).toBeHidden();
    await expect(page.locator(FOLHA)).toBeVisible();

    expect(await coresForaDoEsperado(page, FOLHA, "backgroundColor")).toEqual([]);
    expect(await coresForaDoEsperado(page, FOLHA, "color")).toEqual([]);
  });
});
