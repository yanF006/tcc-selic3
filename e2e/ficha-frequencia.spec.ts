import { expect, test, type Page } from "@playwright/test";

/**
 * Registro da Ficha de Frequência já assinada pela concedente (8.12). A
 * coordenação escolhe o estágio, lança horas e avaliações, registra a ficha
 * e ela fica associada ao estágio como documento consultável.
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

test.describe("registro da Ficha de Frequência", () => {
  test("registra a ficha assinada e a associa ao estágio", async ({ page }) => {
    await entrar(page, "ana.correia@ifrj.edu.br");
    await page.goto("/coordenacao/frequencia");

    await expect(page.getByRole("heading", { name: "Frequência e avaliação" })).toBeVisible();

    await page.getByRole("link", { name: /João Pedro Lima — Laboratório/ }).click();
    await expect(page.getByRole("button", { name: "Registrar ficha assinada" })).toBeVisible();

    await page.getByLabel("Endereço", { exact: true }).fill("Rua das Bandeirantes, 45");
    await page
      .getByLabel("Área de atuação do estágio", { exact: true })
      .fill("Automação industrial");
    await page.getByLabel("Setor", { exact: true }).fill("Manutenção");
    await page.getByLabel("Responsável", { exact: true }).fill("Eduardo Campos");
    await page
      .getByLabel("Nome do(a) supervisor(a) da concedente", { exact: true })
      .fill("Sandra Lopes");

    if ((await page.getByLabel("Mês — linha 1", { exact: true }).count()) === 0) {
      await page.getByRole("button", { name: "Adicionar linha" }).click();
    }

    await page.getByLabel("Ano — linha 1", { exact: true }).fill("2024");
    await page.getByLabel("Mês — linha 1", { exact: true }).fill("Maio");
    await page.getByLabel("Dias úteis — linha 1", { exact: true }).fill("21");
    await page.getByLabel("Dias trabalhados — linha 1", { exact: true }).fill("20");
    await page.getByLabel("Horas trabalhadas — linha 1", { exact: true }).fill("160");

    await page.getByLabel("Assiduidade", { exact: true }).fill("9.5");
    await page.getByLabel("Pontualidade", { exact: true }).fill("7.5");
    await expect(page.getByTestId("faixa-criterio_1")).toContainText("E — Excelente");
    await expect(page.getByLabel("Conceito global", { exact: true })).toHaveValue("8.5");

    await page.getByRole("button", { name: "Registrar ficha assinada" }).click();

    await expect(
      page.getByText("Ficha de Frequência registrada e associada ao estágio."),
    ).toBeVisible();
    await expect(page.getByText("Documento Registrado", { exact: true })).toBeVisible();
    await expect(page.getByText("Registrado", { exact: true })).toBeVisible();

    await page.reload();

    await expect(page.getByText("Documento Registrado", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Endereço", { exact: true })).toHaveValue(
      "Rua das Bandeirantes, 45",
    );
    await expect(page.getByLabel("Mês — linha 1", { exact: true })).toHaveValue("Maio");
    await expect(page.getByLabel("Horas trabalhadas — linha 1", { exact: true })).toHaveValue(
      "160",
    );
    await expect(page.getByLabel("Assiduidade", { exact: true })).toHaveValue("9.5");
    await expect(page.getByLabel("Conceito global", { exact: true })).toHaveValue("8.5");

    await page.goto("/documentos/tpl-ficha-frequencia?estagio=est-joao-lab");

    await expect(page.getByText("Documento Registrado", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Assiduidade", { exact: true })).toHaveValue("9.5");

    const fichaNaLista = page
      .locator("li")
      .filter({ hasText: "Ficha Individual de Frequência e Avaliação" });

    await expect(fichaNaLista).toHaveCount(1);
    await expect(fichaNaLista).toContainText("Registrado");
  });
});
