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

test("filtra o histórico por instituição e situação com total de resultados (7.4)", async ({
  page,
}) => {
  await entrar(page, "maria.souza@aluno.ifrj.edu.br");
  await page.goto("/estagio");
  await expect(page.getByText("Total de resultados: 2")).toBeVisible();
  await page.getByLabel("Buscar estágios").fill("Hospital");
  await expect(page.getByText("Total de resultados: 1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Estágio #cnoweb", exact: true })).toHaveCount(0);
  await page.getByLabel("Buscar estágios").fill("sem resultado");
  await expect(page.getByText("Nenhum estágio corresponde aos filtros aplicados.")).toBeVisible();
  await page.getByLabel("Buscar estágios").fill("");
  await page.getByLabel("Filtrar situação").click();
  await page.getByRole("option", { name: "Concluído", exact: true }).click();
  await expect(page.getByText("Total de resultados: 1")).toBeVisible();
});

test("edita o próprio estágio, salva seleção e solicita exclusão com autorização (7.8, 7.10)", async ({
  page,
}) => {
  await entrar(page, "luiza.santos@aluno.ifrj.edu.br");
  await page.goto("/estagio?estagio=est-sem-endereco");
  await expect(
    page.getByText("Tecnoweb Serviços de Tecnologia Ltda.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Editar estágio", exact: true }).click();
  await page.getByLabel("Data de Fim").fill("2026-01-01");
  await page.getByRole("button", { name: "Salvar Estágio" }).click();
  await expect(page.getByLabel("Data de Fim")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#dataFim-erro")).toHaveText(
    "A data final deve ser igual ou posterior à data inicial.",
  );
  await page.getByLabel("Data de Fim").fill("2026-08-27");
  await page.getByRole("button", { name: "Salvar Estágio" }).click();
  await expect(page.getByText("Período: 2026-03-02 a 2026-08-27")).toBeVisible();
  await page.getByRole("button", { name: "Selecionar documentos" }).click();
  await page.getByLabel("Plano de Atividades de Estágio", { exact: true }).check();
  await page.getByRole("button", { name: "Salvar seleção" }).click();
  await expect(
    page.getByRole("link", { name: "Plano de Atividades de Estágio", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Plano de Atividades de Estágio", exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Solicitar exclusão" }).click();
  await expect(page.getByText("Exclusão aguardando autorização", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Exclusão aguardando autorização", { exact: true })).toBeVisible();
  await expect(page.getByText("Detalhes do Estágio", { exact: true })).toBeVisible();
});

test("coordenação vê somente o curso e a edição registra sua autoria (7.11)", async ({ page }) => {
  await entrar(page, "carla.menezes@ifrj.edu.br");
  await page.goto("/coordenacao/estagios");
  await expect(
    page.getByText("Aluno: Maria de Souza Oliveira", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Aluno: João Pedro Lima", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Estágio #cnoweb", exact: true }).click();
  await page.getByRole("button", { name: "Editar estágio", exact: true }).click();
  await page.getByLabel("Data de Fim").fill("2026-08-27");
  await page.getByRole("button", { name: "Salvar Estágio" }).click();
  await expect(page.getByText(/Última edição por Carla Menezes/)).toBeVisible();
  await expect(page).toHaveURL(/\/coordenacao\/estagios\?estagio=est-maria-tecnoweb/);
});

test("aluno não abre documento de estágio pertencente a outra pessoa", async ({ page }) => {
  await entrar(page, "maria.souza@aluno.ifrj.edu.br");
  await page.goto("/documentos/tpl-termo-compromisso?estagio=est-joao-lab");
  await expect(page.getByText("Estágio não encontrado", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar rascunho" })).toHaveCount(0);
});

test("remove preenchimento da seleção sem apagar sua consulta pela coordenação (7.9)", async ({
  page,
}) => {
  await entrar(page, "maria.souza@aluno.ifrj.edu.br");
  await page.goto("/documentos/tpl-ficha-acompanhamento?estagio=est-maria-tecnoweb");
  if ((await page.getByLabel("Data — linha 1").count()) === 0)
    await page.getByRole("button", { name: "Adicionar linha" }).click();
  await page.getByLabel("Data — linha 1").fill("02/03/2026");
  await page.getByLabel("Entrada — linha 1").fill("09:00");
  await page.getByLabel("Saída — linha 1").fill("15:00");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText("Rascunho salvo.")).toBeVisible();
  await page.goto("/estagio?estagio=est-maria-tecnoweb");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator('[data-template-id="tpl-ficha-acompanhamento"]')
    .getByRole("button", { name: "Remover" })
    .click();
  await expect(page.locator('[data-template-id="tpl-ficha-acompanhamento"]')).toHaveCount(0);
  await entrar(page, "carla.menezes@ifrj.edu.br");
  await page.goto("/coordenacao/estagios?estagio=est-maria-tecnoweb");
  await expect(page.getByTestId("documentos-inativos")).toContainText("Ficha de Acompanhamento");
  await expect(page.getByTestId("documentos-inativos")).toContainText("Inativo");
});

test("cadastra estágio, seleciona documento e registra/corrige horas dentro dos limites (14.2)", async ({
  page,
}) => {
  await entrar(page, "luiza.santos@aluno.ifrj.edu.br");
  await page.goto("/estagio");
  await page.getByRole("button", { name: "Cadastrar Estágio", exact: true }).click();
  await page.getByLabel("Convênio", { exact: true }).click();
  await expect(page.getByRole("option", { name: /Cooperativa/ })).toHaveCount(0);
  await page.getByRole("option", { name: /Convênio de Estágio — Tecnoweb/ }).click();
  await page.getByLabel("Orientador", { exact: true }).click();
  await page.getByRole("option", { name: "Carla Menezes", exact: true }).click();
  await page.getByLabel("Supervisor", { exact: true }).click();
  await page.getByRole("option", { name: "Ricardo Alves", exact: true }).click();
  await page.getByLabel("Data de Início").fill("2027-01-04");
  await page.getByLabel("Data de Fim").fill("2027-01-29");
  await page.getByLabel(/Ficha de Acompanhamento/).check();
  await page.getByRole("button", { name: "Salvar Estágio" }).click();
  await expect(page.getByText("Período: 2027-01-04 a 2027-01-29")).toBeVisible();
  await expect(page.getByRole("link", { name: /Ficha de Acompanhamento/ })).toBeVisible();
  await page.getByLabel("Data", { exact: true }).fill("2027-01-05");
  await page.getByLabel("Entrada", { exact: true }).fill("09:00");
  await page.getByLabel("Saída", { exact: true }).fill("17:00");
  await page.getByLabel(/Desligar intervalo de almoço/).check();
  await page.getByRole("button", { name: "Lançar horas", exact: true }).click();
  await expect(page.getByText("Lançamento recusado", { exact: true })).toBeVisible();
  await page.getByLabel("Saída", { exact: true }).fill("15:00");
  await page.getByRole("button", { name: "Lançar horas", exact: true }).click();
  await expect(page.getByTestId("total-horas")).toHaveText("5,00 h");
  await page.getByRole("button", { name: "Corrigir", exact: true }).click();
  await page.getByLabel("Nova saída", { exact: true }).fill("14:00");
  await page.getByRole("button", { name: "Registrar correção", exact: true }).click();
  await expect(page.getByTestId("total-horas")).toHaveText("4,00 h");
  await expect(page.getByTestId("historico-lancamentos")).toContainText("Lançamento original");
  await expect(page.getByTestId("historico-lancamentos")).toContainText("Correção de");
});
