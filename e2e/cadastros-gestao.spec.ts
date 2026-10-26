import { expect, test, type Page } from "@playwright/test";

test.use({ actionTimeout: 15_000 });
async function entrar(page: Page, email = "ana.correia@ifrj.edu.br") {
  await page.goto("about:blank");
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("selic123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((url) => url.pathname !== "/login");
}

test("convênio calcula vigência, filtra e preserva os estágios ao expirar", async ({ page }) => {
  await entrar(page);
  await page.goto("/coordenacao/cadastros");
  await page.getByLabel("Nome do cadastro").fill("Convênio para revisão");
  await page.getByLabel("Instituição", { exact: true }).fill("Instituto de revisão");
  await page.getByLabel("CNPJ", { exact: true }).fill("11222333000181");
  await page.getByLabel("Data de assinatura").fill("2024-02-29");
  await page.getByRole("button", { name: "Salvar cadastro", exact: true }).click();
  await expect(page.getByText("Cadastro salvo.", { exact: true })).toBeVisible();
  await page.getByLabel("Buscar cadastros").fill("Instituto de revisão");
  await expect(page.getByText("Total de resultados: 1", { exact: true })).toBeVisible();
  await expect(page.locator('[data-testid^="cadastro-"]')).toContainText("2029-02-28");
  await page.getByLabel("Buscar cadastros").fill("");
  const vinculado = page.getByTestId("cadastro-conv-ti-pinheiral");
  await expect(vinculado).toContainText("estágios vinculados");
  page.once("dialog", (dialog) => dialog.accept());
  await vinculado.getByRole("button", { name: "Excluir cadastro", exact: true }).click();
  await expect(page.getByText(/Convênio possui estágios vinculados/)).toBeVisible();
  await vinculado.getByRole("button", { name: "Classificar como expirado" }).click();
  await expect(vinculado.getByText("Expirado", { exact: true })).toBeVisible();
  await page.goto("/coordenacao/estagios?estagio=est-maria-tecnoweb");
  await expect(
    page.getByText("Tecnoweb Serviços de Tecnologia Ltda.", { exact: true }),
  ).toBeVisible();
  await page.goto("/coordenacao/cadastros");
  await page
    .getByTestId("cadastro-conv-ti-pinheiral")
    .getByRole("button", { name: "Ativar cadastro" })
    .click();
  await expect(
    page.getByTestId("cadastro-conv-ti-pinheiral").getByText("Ativo", { exact: true }),
  ).toBeVisible();
});

test("curso, turma e períodos ficam vinculados e aparecem nas opções corretas do cadastro", async ({
  page,
}) => {
  await entrar(page);
  await page.goto("/coordenacao/cadastros");
  await page.getByLabel("Tipo de cadastro").selectOption("periodo");
  await page.getByLabel("Ano", { exact: true }).fill("2040");
  await page.getByLabel("Semestre", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "Salvar cadastro", exact: true }).click();
  await expect(page.getByText("Cadastro salvo.", { exact: true })).toBeVisible();
  await page.getByLabel("Tipo de cadastro").selectOption("curso");
  await page.getByLabel("Nome do cadastro").fill("Curso de revisão");
  await page.getByLabel("Código do curso").fill("REVISAO");
  await page.getByRole("button", { name: "Salvar cadastro", exact: true }).click();
  await expect(page.getByText("Cadastro salvo.", { exact: true })).toBeVisible();
  await page.getByLabel("Tipo de cadastro").selectOption("turma");
  await page.getByLabel("Nome do cadastro").fill("Turma de revisão");
  await page.getByLabel("Curso da turma").selectOption({ label: "Curso de revisão" });
  await page.getByRole("checkbox", { name: "2040.1", exact: true }).check();
  await page.getByRole("button", { name: "Salvar cadastro", exact: true }).click();
  await expect(page.getByText("Cadastro salvo.", { exact: true })).toBeVisible();
  await page.goto("about:blank");
  await page.context().clearCookies();
  await page.goto("/cadastro");
  const sufixo = Date.now().toString().slice(-7);
  await page.getByLabel("Matrícula", { exact: true }).fill(`2026${sufixo}`);
  await page.getByLabel("E-mail", { exact: true }).fill(`turma.${sufixo}@exemplo.com`);
  await page.getByLabel("Senha", { exact: true }).fill("selic123");
  await page.getByLabel("Confirmar senha").fill("selic123");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Curso", { exact: true }).click();
  await page.getByRole("option", { name: "Curso de revisão", exact: true }).click();
  await page.getByLabel("Turma", { exact: true }).click();
  await expect(page.getByRole("option", { name: "Turma de revisão", exact: true })).toBeVisible();
  await page.getByRole("option", { name: "Turma de revisão", exact: true }).click();
  await page.getByLabel("Período", { exact: true }).click();
  await expect(page.getByRole("option", { name: "2040.1", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "2026.1", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByLabel("Curso", { exact: true }).click();
  await page
    .getByRole("option", { name: "Análise e Desenvolvimento de Sistemas", exact: true })
    .click();
  await page.getByLabel("Turma", { exact: true }).click();
  await expect(page.getByRole("option", { name: "Turma de revisão", exact: true })).toHaveCount(0);
  await page
    .getByRole("option", { name: /ADS 2026.1/ })
    .first()
    .click();
  await page.getByLabel("Período", { exact: true }).click();
  await expect(page.getByRole("option", { name: "2040.1", exact: true })).toHaveCount(0);
});

test("cadastros com vínculos oferecem inativação sem remover curso ou turma", async ({ page }) => {
  await entrar(page);
  await page.goto("/coordenacao/cadastros");
  for (const [tipo, id] of [
    ["curso", "curso-ads"],
    ["turma", "turma-ads-2026-1a"],
  ]) {
    await page.getByLabel("Tipo de cadastro").selectOption(tipo);
    const registro = page.getByTestId(`cadastro-${id}`);
    page.once("dialog", (dialog) => dialog.accept());
    await registro.getByRole("button", { name: "Excluir cadastro", exact: true }).click();
    await expect(page.getByText(/Cadastro possui vínculos/)).toBeVisible();
    await registro.getByRole("button", { name: "Inativar cadastro", exact: true }).click();
    await expect(registro.getByText("Inativo", { exact: true })).toBeVisible();
    await registro.getByRole("button", { name: "Ativar cadastro", exact: true }).click();
    await expect(registro.getByText("Ativo", { exact: true })).toBeVisible();
  }
});

test("responsável cadastrado pode ser editado e excluído sem deixar contato pessoal", async ({
  page,
}) => {
  await entrar(page);
  await page.goto("/coordenacao/cadastros");
  for (const tipo of ["orientador", "supervisor"]) {
    await page.getByLabel("Tipo de cadastro").selectOption(tipo);
    await page.getByLabel("Nome do cadastro").fill(`Responsável de revisão ${tipo}`);
    await page.getByLabel("E-mail do responsável").fill(`${tipo}.revisao@exemplo.com`);
    await page.getByRole("button", { name: "Salvar cadastro", exact: true }).click();
    await expect(page.getByText("Cadastro salvo.", { exact: true })).toBeVisible();
    const registro = page
      .locator('[data-testid^="cadastro-"]')
      .filter({ hasText: `Responsável de revisão ${tipo}` });
    await registro.getByRole("button", { name: "Editar cadastro", exact: true }).click();
    await page.getByLabel("Telefone do responsável").fill("2133331234");
    await page.getByRole("button", { name: "Salvar cadastro", exact: true }).click();
    await expect(registro).toContainText("2133331234");
    page.once("dialog", (dialog) => dialog.accept());
    await registro.getByRole("button", { name: "Excluir cadastro", exact: true }).click();
    await expect(registro).toHaveCount(0);
    await expect(page.getByText(`${tipo}.revisao@exemplo.com`, { exact: true })).toHaveCount(0);
  }
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByTestId("cadastro-sup-jonathan")
    .getByRole("button", { name: "Excluir cadastro", exact: true })
    .click();
  await expect(page.getByTestId("cadastro-sup-jonathan")).toContainText("Cadastro excluído");
  await page.goto("/coordenacao/estagios?estagio=est-joao-lab");
  await expect(page.getByText("Detalhes do Estágio", { exact: true })).toBeVisible();
  await expect(page.getByText("Cadastro excluído", { exact: true }).first()).toBeVisible();
});
