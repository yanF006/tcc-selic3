import { expect, test, type Page } from "@playwright/test";

/**
 * Página de impressão do documento preenchido (8.13): a partir do formulário, o
 * usuário abre a folha dedicada, que fica isolada em tokens de impressão, sem a
 * interface ao redor, e imprime o documento com fundo branco e texto preto.
 */

const SENHA = "selic123";
const FOLHA = "[data-preview-impressao]";

async function entrar(page: Page, email: string) {
  await page.goto("/login");

  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);

  await Promise.all([
    page.waitForURL((url) => url.pathname !== "/login", { timeout: 60_000 }),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);
}

async function fundoDe(page: Page, seletor: string) {
  return page
    .locator(seletor)
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
}

test.describe("impressão do documento preenchido", () => {
  test("abre a folha dedicada e imprime o documento sem a interface (8.13)", async ({ page }) => {
    await entrar(page, "maria.souza@aluno.ifrj.edu.br");

    // Preenche a Ficha de Acompanhamento e salva o rascunho.
    await page.goto("/documentos/tpl-ficha-acompanhamento?estagio=est-maria-tecnoweb");

    await page.getByRole("button", { name: "Adicionar linha" }).click();
    await page.getByLabel("Data — linha 1").fill("02/03/2026");
    await page.getByLabel("Entrada — linha 1").fill("09:00");
    await page.getByLabel("Saída — linha 1").fill("15:00");

    await page.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect(page.getByText("Rascunho salvo.")).toBeVisible();

    // Abre a página de impressão pelo botão.
    await page.getByRole("link", { name: "Imprimir" }).click();

    await expect(page).toHaveURL(/\/documentos\/tpl-ficha-acompanhamento\/imprimir\?documento=/);
    await expect(page.getByRole("button", { name: "Imprimir documento" })).toBeVisible();
    await expect(page.locator(FOLHA)).toContainText("02/03/2026");

    // Sem a interface ao redor: nenhuma navbar na página de impressão.
    await expect(page.getByRole("navigation", { name: "Navegação principal" })).toHaveCount(0);

    // A folha abre clara mesmo com a interface no tema escuro.
    await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));
    await page.reload();

    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await fundoDe(page, FOLHA)).toBe("rgb(255, 255, 255)");

    // Na impressão, a barra de ações sai e a folha sai branca.
    await page.emulateMedia({ media: "print" });

    await expect(page.getByRole("button", { name: "Imprimir documento" })).toBeHidden();
    expect(await fundoDe(page, "html")).toBe("rgb(255, 255, 255)");
    await expect(page.locator(FOLHA)).toBeVisible();
  });
});
