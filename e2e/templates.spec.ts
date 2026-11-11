import { expect, test, type Page } from "@playwright/test";

test.use({ actionTimeout: 15_000 });

async function entrar(page: Page, email: string) {
  await page.goto("about:blank");
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("selic123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((url) => url.pathname !== "/login");
}

test("data de assinatura fica em branco no aditivo e não é solicitada no sistema", async ({ page }) => {
  await entrar(page, "maria.souza@aluno.ifrj.edu.br");
  await page.goto("/documentos/tpl-termo-aditivo?estagio=est-maria-tecnoweb");
  await expect(page.getByLabel("Data do Termo de Compromisso", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/____\/____\/________/)).toBeVisible();
  await page.getByLabel("Novo término", { exact: true }).fill("30082027");
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await expect(page.getByText("Rascunho salvo.", { exact: true })).toBeVisible();
});

test("gestão não oferece editor e o endereço antigo leva ao catálogo fixo", async ({ page }) => {
  await entrar(page, "felipe.andrade@ifrj.edu.br");
  await expect(page.getByRole("link", { name: "Templates de documentos", exact: true })).toHaveCount(0);
  await page.goto("/coordenacao/templates");
  await expect(page).toHaveURL(/\/documentos$/);
  await expect(page.getByRole("button", { name: "Cadastrar nova versão", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Arquivo .docx do template")).toHaveCount(0);
  await expect(page.getByText("Lei de Estágio", { exact: true }).first()).toBeVisible();
});
