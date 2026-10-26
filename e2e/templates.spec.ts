import { expect, test, type Page } from "@playwright/test";

test.use({ actionTimeout: 15_000 });
const convenio = "/documentos/tpl-convenio-estagio";
const arquivoDocx = "Contexto/kit-estagio/03 - Convenio de estagio - Campus Pinheiral.docx";

async function entrar(page: Page, email: string) {
  await page.goto("about:blank");
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("selic123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((url) => url.pathname !== "/login");
}

async function abrirGestao(page: Page) {
  await page.goto("/coordenacao/templates");
  await page.getByLabel("Documento do template").selectOption("tpl-convenio-estagio");
}

async function preencherConvenioHistorico(page: Page) {
  await entrar(page, "ana.correia@ifrj.edu.br");
  await page.goto(convenio);
  await page.getByLabel("Razão social", { exact: true }).fill("Instituicao Historica");
  await page.getByLabel("CNPJ", { exact: true }).fill("11222333000181");
  const endereco = page.getByRole("group", { name: "Endereço da concedente", exact: true });
  await endereco.getByRole("button", { name: "Alterar endereço" }).click();
  await endereco.getByLabel("Logradouro", { exact: true }).fill("Rua da Instituição");
  await endereco.getByLabel("Número", { exact: true }).fill("10");
  await page.getByLabel("Responsável legal", { exact: true }).fill("Responsável histórico");
  await page.getByLabel("Início da vigência", { exact: true }).fill("01012026");
  await page.getByLabel("Fim da vigência", { exact: true }).fill("01012031");
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await expect(page.getByText("Rascunho salvo.", { exact: true })).toBeVisible();
}

test("data de assinatura fica em branco no aditivo e não é solicitada no sistema", async ({
  page,
}) => {
  await entrar(page, "maria.souza@aluno.ifrj.edu.br");
  await page.goto("/documentos/tpl-termo-aditivo?estagio=est-maria-tecnoweb");
  await expect(page.getByLabel("Data do Termo de Compromisso", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/____\/____\/________/)).toBeVisible();
  await page.getByLabel("Novo término", { exact: true }).fill("30082027");
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await expect(page.getByText("Rascunho salvo.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Imprimir", exact: true }).click();
  await expect(page.locator("[data-preview-impressao]")).toContainText("____/____/________");
});

test("recusa upload de template fora do formato docx", async ({ page }) => {
  await entrar(page, "felipe.andrade@ifrj.edu.br");
  await abrirGestao(page);
  await page
    .getByLabel("Arquivo .docx do template")
    .setInputFiles({
      name: "invalido.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("Arquivo inválido para o template"),
    });
  await page.getByRole("button", { name: "Cadastrar nova versão", exact: true }).click();
  await expect(
    page.getByText("O arquivo do template deve estar no formato .docx.", { exact: true }),
  ).toBeVisible();
});

test("nova versão é vigente para novos preenchimentos sem alterar o documento anterior", async ({
  page,
}) => {
  await preencherConvenioHistorico(page);
  await expect(page.getByText("Versão 2", { exact: true })).toBeVisible();
  await entrar(page, "felipe.andrade@ifrj.edu.br");
  await abrirGestao(page);
  const razao = page.getByTestId("campo-template-razaoSocial");
  await razao.locator("summary").click();
  await razao.getByLabel("Rótulo do campo", { exact: true }).fill("Razão social da versão nova");
  await page.getByRole("button", { name: "Adicionar campo", exact: true }).click();
  const adicional = page.locator('[data-testid^="campo-template-"]').last();
  await adicional.locator("summary").click();
  await adicional.getByLabel("Chave do campo", { exact: true }).fill("informacaoExtra");
  await adicional.getByLabel("Rótulo do campo", { exact: true }).fill("Informação adicional");
  await adicional.getByRole("checkbox", { name: "Campo obrigatório", exact: true }).check();
  await page.getByLabel("Arquivo .docx do template").setInputFiles(arquivoDocx);
  await page.getByRole("button", { name: "Cadastrar nova versão", exact: true }).click();
  await expect(page.getByText("Versão 3 cadastrada como vigente.", { exact: true })).toBeVisible();
  await expect(page.getByText(/Versão 2 — histórica/)).toBeVisible();
  await page.goto(convenio);
  await expect(page.getByLabel("Informação adicional", { exact: true })).toBeVisible();
  await expect(page.getByText("Versão 3", { exact: true })).toBeVisible();
  await entrar(page, "ana.correia@ifrj.edu.br");
  await page.goto(convenio);
  await expect(page.getByText("Versão 2", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Razão social", { exact: true })).toHaveValue(
    "Instituicao Historica",
  );
  await expect(page.getByLabel("Informação adicional", { exact: true })).toHaveCount(0);
});

test("template com documentos recusa exclusão e a inativação preserva consulta e download", async ({
  page,
}) => {
  await preencherConvenioHistorico(page);
  await entrar(page, "felipe.andrade@ifrj.edu.br");
  await abrirGestao(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Excluir template", exact: true }).click();
  await expect(page.getByText(/Template possui documentos gerados/)).toBeVisible();
  await page.getByRole("button", { name: "Inativar template", exact: true }).click();
  await expect(page.getByText("Template inativo", { exact: true })).toBeVisible();
  await page.goto("/coordenacao/documentos?visao=todos&busca=Ana%20Beatriz");
  const preservado = page
    .locator('[data-testid^="documento-"]')
    .filter({ hasText: "Responsável: Ana Beatriz Correia" });
  await preservado.getByRole("link", { name: "Consultar preenchimento", exact: true }).click();
  await expect(page.getByLabel("Razão social", { exact: true })).toHaveValue(
    "Instituicao Historica",
  );
  await expect(page.getByRole("button", { name: "Salvar rascunho", exact: true })).toBeDisabled();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Baixar docx", exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
  await abrirGestao(page);
  await page.getByRole("button", { name: "Ativar template", exact: true }).click();
  await expect(page.getByText("Template ativo", { exact: true })).toBeVisible();
});
