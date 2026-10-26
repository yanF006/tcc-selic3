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

async function aplicar(page: Page) {
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/coordenacao/estatisticas"),
    page.getByRole("button", { name: "Aplicar filtros", exact: true }).click(),
  ]);
}

test("pesquisa por aluno, orientador, supervisor e instituição com total (12.1)", async ({
  page,
}) => {
  await entrar(page, "ana.correia@ifrj.edu.br");
  await page.goto("/coordenacao/estatisticas");

  await expect(
    page.getByRole("heading", { name: "Estatísticas — Campus Pinheiral", level: 1 }),
  ).toBeVisible();
  await expect(page.getByTestId("total-estatisticas")).toHaveText("Total de resultados: 5");
  await expect(page.getByRole("table", { name: "Estágios da pesquisa" })).toBeVisible();

  await page.getByLabel("Aluno").selectOption("Maria de Souza Oliveira");
  await aplicar(page);
  await expect(page.getByTestId("total-estatisticas")).toHaveText("Total de resultados: 2");

  await page.getByRole("link", { name: "Limpar filtros", exact: true }).click();
  await expect(page.getByTestId("total-estatisticas")).toHaveText("Total de resultados: 5");
  await expect(page.getByLabel("Aluno")).toHaveValue("");

  await page.getByLabel("Orientador").selectOption("Carla Menezes");
  await aplicar(page);
  await expect(page.getByTestId("total-estatisticas")).toHaveText("Total de resultados: 4");

  await page.goto("/coordenacao/estatisticas?supervisor=Ricardo");
  await expect(page.getByTestId("total-estatisticas")).toHaveText("Total de resultados: 3");

  await page.goto("/coordenacao/estatisticas?instituicao=Hospital");
  await expect(page.getByTestId("total-estatisticas")).toHaveText("Total de resultados: 1");
  await expect(
    page.getByRole("table", { name: "Estágios da pesquisa" }).getByRole("cell", {
      name: "Hospital Municipal de Pinheiral",
    }),
  ).toBeVisible();

  await page.goto("/coordenacao/estatisticas?aluno=sem%20resultado");
  await expect(page.getByTestId("total-estatisticas")).toHaveText("Total de resultados: 0");
  await expect(page.getByText("Nenhum estágio encontrado", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Aluno")).toBeVisible();
});

test("combina o filtro de concluídos e distingue preparação das demais situações (12.2, 7.13)", async ({
  page,
}) => {
  await entrar(page, "ana.correia@ifrj.edu.br");
  await page.goto("/coordenacao/estatisticas?situacao=concluido");

  await expect(page.getByTestId("total-estatisticas")).toHaveText("Total de resultados: 2");
  await expect(page.getByRole("cell", { name: "Concluído" })).toHaveCount(2);

  await page.goto("/coordenacao/estatisticas?situacao=concluido&aluno=Maria");
  await expect(page.getByTestId("total-estatisticas")).toHaveText("Total de resultados: 1");

  await page.goto("/coordenacao/estatisticas");
  const painel = page.locator('section[aria-label="Estágios por situação"]');
  await expect(painel.getByText("Em preparação", { exact: true })).toBeVisible();
  await expect(painel.locator('a[href*="situacao=em_preparacao"]')).toHaveText("1");
  await expect(painel.locator('a[href*="situacao=em_andamento"]')).toHaveText("2");
  await expect(painel.locator('a[href*="situacao=concluido"]')).toHaveText("2");

  await painel.locator('a[href*="situacao=em_preparacao"]').click();
  await expect(page.getByTestId("total-estatisticas")).toHaveText("Total de resultados: 1");
  await expect(page.getByRole("cell", { name: "Em preparação", exact: true })).toBeVisible();
});

test("filtra por curso, ano e semestre e ordena pela data de início (12.3)", async ({ page }) => {
  await entrar(page, "ana.correia@ifrj.edu.br");
  await page.goto("/coordenacao/estatisticas?cursoId=curso-eletro");
  await expect(page.getByTestId("total-estatisticas")).toHaveText("Total de resultados: 1");
  await expect(
    page.getByRole("table", { name: "Estágios da pesquisa" }).getByRole("cell", {
      name: "João Pedro Lima",
    }),
  ).toBeVisible();

  await page.goto("/coordenacao/estatisticas?ano=2025");
  await expect(page.getByTestId("total-estatisticas")).toHaveText("Total de resultados: 1");
  await expect(page.getByText("2025-08-04", { exact: true })).toBeVisible();

  await page.goto("/coordenacao/estatisticas?ano=2026&semestre=1");
  await expect(page.getByTestId("total-estatisticas")).toHaveText("Total de resultados: 2");
  const datas = await page
    .locator('tbody tr td[data-coluna="inicio"]')
    .evaluateAll((celulas) => celulas.map((celula) => celula.textContent));
  expect(datas).toEqual([...datas].sort());
});

test("abre a lista de registros a partir dos indicadores e mostra horas (12.5, 12.6, 12.10)", async ({
  page,
}) => {
  await entrar(page, "ana.correia@ifrj.edu.br");
  await page.goto("/coordenacao/estatisticas");

  const convenios = page.locator('section[aria-label="Convênios"]');
  const ativos = convenios.locator('a[href*="convenios=ativo"]').first();
  const expirados = convenios.locator('a[href*="convenios=expirado"]').first();
  expect(Number(await ativos.textContent())).toBeGreaterThanOrEqual(2);
  expect(Number(await expirados.textContent())).toBeGreaterThanOrEqual(2);

  await page.getByRole("link", { name: "Abrir lista", exact: true }).first().click();
  await expect(page).toHaveURL(/convenios=ativo/);
  await expect(
    page
      .getByRole("table", { name: "Convênios do indicador" })
      .getByRole("row")
      .filter({ hasText: "Tecnoweb" }),
  ).toBeVisible();

  await page.goto("/coordenacao/estatisticas");
  await expect(page.getByTestId("deferidos")).toHaveText(/^\d+$/);
  await expect(page.getByTestId("indeferidos")).toHaveText(/^\d+$/);
  await expect(page.getByTestId("taxa-aproveitamento")).toHaveText(/^\d+%$/);
  await expect(page.getByTestId("pendencias")).toContainText(/pendência\(s\) em \d+ estágio/);

  await page.getByRole("link", { name: "Formulário de Liberação", exact: true }).click();
  const documentosIndicador = page.getByRole("table", { name: "Documentos do indicador" });
  await expect(documentosIndicador).toBeVisible();
  await expect(documentosIndicador.getByRole("row").nth(1)).toBeVisible();

  await page.goto("/coordenacao/estatisticas");
  await expect(page.getByText("Horas por aluno", { exact: true })).toBeVisible();
  const totaisDeHoras = page.getByRole("region", { name: "Totais de horas" });
  await expect(
    totaisDeHoras
      .getByRole("cell")
      .filter({ hasText: /^[\d.]+ h$/ })
      .first(),
  ).toBeVisible();
});

test("restringe o coordenador de curso ao próprio curso e sinaliza o recorte (12.9)", async ({
  page,
}) => {
  await entrar(page, "carla.menezes@ifrj.edu.br");
  await page.goto("/coordenacao/estatisticas");

  await expect(
    page.getByRole("heading", {
      name: "Estatísticas — Análise e Desenvolvimento de Sistemas",
      level: 1,
    }),
  ).toBeVisible();
  await expect(page.getByText(/Recorte do curso/)).toBeVisible();
  await expect(page.getByTestId("total-estatisticas")).toHaveText("Total de resultados: 4");
  await expect(page.getByRole("cell", { name: "João Pedro Lima" })).toHaveCount(0);
});
