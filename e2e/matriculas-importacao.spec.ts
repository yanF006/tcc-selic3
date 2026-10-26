import { expect, test, type Page } from "@playwright/test";

async function entrar(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("selic123");
  await Promise.all([
    page.waitForURL((url) => url.pathname !== "/login"),
    page.getByRole("button", { name: "Entrar", exact: true }).click(),
  ]);
}

test("importa matrículas por arquivo e relata válidas, rejeitadas e ignoradas (11.10)", async ({
  page,
}) => {
  await entrar(page, "felipe.andrade@ifrj.edu.br");
  await page.goto("/admin/matriculas");

  const conteudo = [
    "matricula;nome;curso",
    "20241006904;Maria Duplicada;Análise e Desenvolvimento de Sistemas",
    "20241007777;Aluno Importado;Análise e Desenvolvimento de Sistemas",
    "123;Matrícula Curta;Análise e Desenvolvimento de Sistemas",
  ].join("\n");

  await page.getByLabel("Arquivo .csv de matrículas").setInputFiles({
    name: "matriculas.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(conteudo),
  });
  await expect(page.getByTestId("linhas-importacao")).toContainText("3 linha(s) pronta(s)");
  await page.getByRole("button", { name: "Importar arquivo", exact: true }).click();

  await expect(page.getByTestId("relatorio-importacao")).toHaveText(
    "1 válida(s), 1 rejeitada(s) e 1 ignorada(s).",
  );

  const relatorio = page.getByRole("table", { name: "Relatório da importação" });
  await expect(relatorio.getByRole("row")).toHaveCount(4);
  await expect(relatorio.getByRole("row").filter({ hasText: "20241007777" })).toContainText(
    "Válida",
  );
  await expect(relatorio.getByRole("row").filter({ hasText: "123" })).toContainText("Rejeitada");
  await expect(relatorio.getByRole("row").filter({ hasText: "123" })).toContainText(
    "11 dígitos",
  );
  const ignorada = relatorio.getByRole("row").filter({ hasText: "20241006904" });
  await expect(ignorada).toContainText("Ignorada");
  await expect(ignorada).toContainText("já registrada");

  await page.reload();
  await expect(page.getByRole("row").filter({ hasText: "20241007777" })).toContainText(
    "Aluno Importado",
  );
  await expect(
    page.getByRole("row").filter({ hasText: "20241007777" }).getByText("Importação", { exact: true }),
  ).toBeVisible();
});
