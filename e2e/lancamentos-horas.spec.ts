import { expect, test, type Page } from "@playwright/test";

/**
 * Registro de horas do estágio (8.19–8.21): a recusa do lançamento acima do
 * limite diário de 6 h (8.19), o histórico com o lançamento original e a
 * correção identificados (8.20) e o total acumulado recalculado após a
 * correção (8.21). Os lançamentos já presentes na base de demonstração ficam
 * no estágio `est-maria-tecnoweb`.
 */

const SENHA = "selic123";

async function entrar(page: Page, email: string) {
  await page.goto("/login");

  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);

  await Promise.all([
    page.waitForURL((url) => url.pathname !== "/login", { timeout: 60_000 }),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);
}

async function abrirDetalhes(page: Page) {
  await page.goto("/estagio");
  await page.getByText("Estágio #cnoweb", { exact: true }).click();
  await expect(page.getByTestId("total-horas")).toBeVisible();
}

test.describe("lançamento de horas do estágio", () => {
  test("recusa o lançamento acima do limite diário de 6 horas (8.19)", async ({ page }) => {
    await entrar(page, "maria.souza@aluno.ifrj.edu.br");
    await abrirDetalhes(page);

    await page.getByLabel("Data", { exact: true }).fill("2026-03-06");
    await page.getByLabel("Entrada", { exact: true }).fill("09:00");
    await page.getByLabel("Saída", { exact: true }).fill("17:00");
    await page.getByLabel(/Desligar intervalo de almoço/).check();

    await expect(page.getByTestId("previa-horas")).toHaveText("Horas a registrar: 7,00 h");

    await page.getByRole("button", { name: "Lançar horas" }).click();

    await expect(page.getByText("Lançamento recusado")).toBeVisible();
    await expect(
      page.getByText(/A jornada diária não pode passar de 6 horas \(excluído o almoço\)/),
    ).toBeVisible();
  });

  test("mostra original e correção no histórico e recalcula o total (8.20, 8.21)", async ({
    page,
  }) => {
    await entrar(page, "maria.souza@aluno.ifrj.edu.br");
    await abrirDetalhes(page);

    await expect(page.getByTestId("total-horas")).toHaveText("19,50 h");
    await expect(page.getByTestId("tipo-lan-3")).toHaveText("Lançamento original");
    await expect(page.getByTestId("tipo-lan-4")).toHaveText("Correção de lan-3");

    await page
      .getByTestId("lancamento-lan-1")
      .getByRole("button", { name: "Corrigir" })
      .click();
    await page.getByLabel("Nova saída").fill("16:00");
    await page.getByRole("button", { name: "Registrar correção" }).click();

    await expect(page.getByText("Estágio #cnoweb", { exact: true })).toBeVisible();
    await page.getByText("Estágio #cnoweb", { exact: true }).click();
    await expect(page.getByTestId("total-horas")).toBeVisible();

    await expect(page.getByTestId("total-horas")).toHaveText("18,50 h");
    await expect(page.getByText("Correção de lan-1")).toBeVisible();
    await expect(
      page.getByTestId("lancamento-lan-1").getByText("Lançamento original"),
    ).toBeVisible();
  });
});