import { expect, test, type Page } from "@playwright/test";

test.use({ actionTimeout: 15_000 });
async function entrar(page: Page, email = "ana.correia@ifrj.edu.br") {
  await page.goto("about:blank");
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("Selic@123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((url) => url.pathname !== "/login");
}

test("convênio calcula vigência, filtra e preserva os estágios ao expirar", async ({ page }) => {
  await entrar(page);
  await page.goto("/coordenacao/cadastros");
  await page.getByLabel("Razão social", { exact: true }).fill("Instituto de revisão");
  await page.getByLabel("Nome fantasia", { exact: true }).fill("Convênio para revisão");
  await page.getByLabel("CNPJ", { exact: true }).fill("11222333000181");
  const endereco = page.getByRole("group", { name: "Endereço da concedente", exact: true });
  await endereco.getByRole("button", { name: "Alterar endereço" }).click();
  await endereco.getByLabel("Logradouro", { exact: true }).fill("Rua da Revisão");
  await endereco.getByLabel("Número", { exact: true }).fill("20");
  await endereco.getByLabel("Cidade", { exact: true }).fill("Pinheiral");
  await page.getByLabel("Responsável legal", { exact: true }).fill("Rita Revisora");
  await page.getByLabel("Início da vigência", { exact: true }).fill("29022024");
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
  await page.getByLabel("Senha", { exact: true }).fill("Selic@2026");
  await page.getByLabel("Confirmar senha").fill("Selic@2026");
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

test("dados do convênio preenchem a concedente nos documentos do estágio", async ({ page }) => {
  await entrar(page);
  await page.goto("/coordenacao/cadastros");
  await page.getByLabel("Razão social", { exact: true }).fill("Escola Concedente Ltda.");
  await page.getByLabel("Nome fantasia", { exact: true }).fill("Escola Concedente");
  await page.getByLabel("CNPJ", { exact: true }).fill("11.444.777/0001-61");
  const endereco = page.getByRole("group", { name: "Endereço da concedente", exact: true });
  await endereco.getByRole("button", { name: "Alterar endereço" }).click();
  await endereco.getByLabel("Logradouro", { exact: true }).fill("Rua das Escolas");
  await endereco.getByLabel("Número", { exact: true }).fill("45");
  await endereco.getByLabel("Cidade", { exact: true }).fill("Pinheiral");
  await page.getByLabel("Telefone", { exact: true }).fill("2433335555");
  await page.getByLabel("Responsável legal", { exact: true }).fill("Helena Diretora");
  await page
    .getByLabel("Início da vigência", { exact: true })
    .fill(new Date().toLocaleDateString("pt-BR"));
  await page.getByRole("button", { name: "Salvar cadastro", exact: true }).click();
  await expect(page.getByText("Cadastro salvo.", { exact: true })).toBeVisible();

  await entrar(page, "maria.souza@aluno.ifrj.edu.br");
  await page.goto("/estagio");
  await page.getByRole("button", { name: "Solicitar estágio", exact: true }).click();
  await page.getByLabel("Convênio", { exact: true }).click();
  await page.getByRole("option", { name: /Escola Concedente/ }).click();
  await page.getByLabel("Dados dos documentos iniciais").selectOption("tpl-termo-compromisso");
  await expect(page.getByLabel("CNPJ da instituição", { exact: true })).toHaveValue(
    "11.444.777/0001-61",
  );
  await expect(page.getByLabel("Representada por", { exact: true })).toHaveValue("Helena Diretora");
  const concedente = page.getByRole("group", { name: "Endereço da concedente", exact: true });
  await expect(concedente.getByLabel("Logradouro", { exact: true })).toHaveValue("Rua das Escolas");
  await expect(concedente.getByLabel("Número", { exact: true })).toHaveValue("45");
});

test("preencher o documento Convênio de Estágio cadastra e depois atualiza o convênio", async ({
  page,
}) => {
  await entrar(page);
  await page.goto("/documentos/tpl-convenio-estagio");
  await page.getByLabel("Razão social", { exact: true }).fill("Colégio do Documento Ltda.");
  await page.getByLabel("Nome fantasia", { exact: true }).fill("Colégio do Documento");
  await page.getByLabel("CNPJ", { exact: true }).fill("22.333.444/0001-05");
  const endereco = page.getByRole("group", { name: "Endereço da concedente", exact: true });
  await endereco.getByRole("button", { name: "Alterar endereço" }).click();
  await endereco.getByLabel("Logradouro", { exact: true }).fill("Rua do Documento");
  await endereco.getByLabel("Número", { exact: true }).fill("7");
  await page.getByLabel("Responsável legal", { exact: true }).fill("Bruno Gestor");
  await page.getByLabel("Início da vigência", { exact: true }).fill("01022026");
  await page.getByRole("button", { name: "Cadastrar convênio", exact: true }).click();
  await expect(page.getByText(/Convênio cadastrado/)).toBeVisible();
  await expect(page.getByLabel("Fim da vigência", { exact: true })).toHaveValue("01/02/2031");

  await page.reload();
  await expect(page.getByRole("button", { name: "Atualizar convênio", exact: true })).toBeVisible();
  await page.getByLabel("Responsável legal", { exact: true }).fill("Bruna Gestora");
  await page.getByRole("button", { name: "Atualizar convênio", exact: true }).click();
  await expect(page.getByText(/Convênio atualizado/)).toBeVisible();

  await page.goto("/coordenacao/cadastros");
  await page.getByLabel("Buscar cadastros").fill("Colégio do Documento");
  await expect(page.getByText("Total de resultados: 1", { exact: true })).toBeVisible();
  await expect(page.locator('[data-testid^="cadastro-"]')).toContainText("2031-02-01");
});
