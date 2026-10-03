import { expect, test } from "@playwright/test";

/**
 * Preferência de tema (2.2, 2.4): o tema salvo entra já na primeira renderização,
 * sem piscar o tema claro, persiste entre sessões e acompanha a preferência do
 * sistema quando a opção é Sistema.
 */

const SENHA = "selic123";

/** Login comum para verificar a persistência depois de sair e entrar de novo. */
async function entrar(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("felipe.andrade@ifrj.edu.br");
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await Promise.all([
    page.waitForURL((url) => url.pathname !== "/login", { timeout: 60_000 }),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);
}

async function escolherTema(
  page: import("@playwright/test").Page,
  opcao: "Claro" | "Escuro" | "Sistema",
) {
  await page.getByRole("button", { name: "Alterar tema" }).click();
  await page.getByRole("menuitem", { name: opcao }).click();
}

test.describe("tema", () => {
  test("aplica o tema salvo já na primeira renderização", async ({ page }) => {
    // A preferência é gravada antes de qualquer script da página, como quem já
    // tivesse escolhido o tema escuro numa visita anterior.
    await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));

    await page.goto("/login", { waitUntil: "domcontentloaded" });

    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("persiste o tema escolhido após logout e novo login", async ({ page }) => {
    await entrar(page);

    await escolherTema(page, "Escuro");
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.getByRole("button", { name: /Felipe Andrade/ }).first().click();
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.getByLabel("E-mail", { exact: true }).fill("felipe.andrade@ifrj.edu.br");
    await page.getByLabel("Senha", { exact: true }).fill(SENHA);
    await Promise.all([
      page.waitForURL((url) => url.pathname !== "/login", { timeout: 60_000 }),
      page.getByRole("button", { name: "Entrar" }).click(),
    ]);

    await expect(page.locator("html")).toHaveClass(/dark/);

    // Voltar para o claro evita contaminar as demais execuções com o tema salvo.
    await escolherTema(page, "Claro");
    await expect(page.locator("html")).toHaveClass(/light/);
  });

  test("acompanha a preferência do sistema quando a opção é Sistema", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => window.localStorage.setItem("theme", "system"));

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.emulateMedia({ colorScheme: "light" });

    await expect(page.locator("html")).toHaveClass(/light/);
  });
});
