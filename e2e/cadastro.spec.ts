import { expect, test } from "./suporte/cep";

/**
 * Cadastro público em duas etapas (5.2 a 5.5, 14.1): confirmação de senha,
 * matrícula fora do formato do SIGAA, unicidade de e-mail sem revelar a conta,
 * matrícula não registrada gerando pendência e selects dependentes de curso,
 * turma e período.
 */

const SUFIXO = Date.now().toString(36);
const SENHA = "selic123";

function email(prefixo: string): string {
  return `${prefixo}.${SUFIXO}@aluno.ifrj.edu.br`;
}

async function preencherEtapaUm(
  page: import("@playwright/test").Page,
  dados: { matricula: string; email: string; senha: string; confirmacao: string },
) {
  await page.getByLabel("Matrícula", { exact: true }).fill(dados.matricula);
  await page.getByLabel("E-mail", { exact: true }).fill(dados.email);
  await page.getByLabel("Senha", { exact: true }).fill(dados.senha);
  await page.getByLabel("Confirmar senha").fill(dados.confirmacao);
  await page.getByRole("button", { name: "Continuar" }).click();
}

async function preencherEtapaDois(page: import("@playwright/test").Page) {
  await page.getByLabel("Nome completo").fill(`Maria Nova ${SUFIXO}`);
  await page.getByLabel("CPF").fill("123.456.789-09");
  await page.getByLabel("Data de nascimento").fill("14/03/2005");
  await page.getByLabel("Celular").fill("21998761234");
  await page.getByLabel("CEP").fill("23940000");
  await page.getByLabel("Endereço").fill("Rua das Acácias");
  await page.getByLabel("Número").fill("120");
  await page.getByLabel("Bairro").fill("Centro");
  await page.getByLabel("Cidade").fill("Pinheiral");
}

test.describe("cadastro público", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cadastro");
    await expect(page.getByRole("heading", { name: "Criar cadastro" })).toBeVisible();
  });

  test("bloqueia confirmação divergente com erro no campo", async ({ page }) => {
    await preencherEtapaUm(page, {
      matricula: "20241006904",
      email: email("divergente"),
      senha: SENHA,
      confirmacao: "outra-senha",
    });

    const erro = page.locator("[data-erro-cadastro='confirmacao']");

    await expect(erro).toBeVisible();
    await expect(erro).toHaveText("A confirmação não bate com a senha.");
    await expect(page.getByLabel("Nome completo")).toHaveCount(0);
  });

  test("recusa matrícula fora do formato do SIGAA na primeira etapa", async ({ page }) => {
    await preencherEtapaUm(page, {
      matricula: "20A3100457",
      email: email("formato"),
      senha: SENHA,
      confirmacao: SENHA,
    });

    // A mensagem aparece junto ao campo e no resumo do formulário.
    await expect(page.locator("#cadastro-matricula-mensagem")).toHaveText(
      "Informe a matrícula do SIGAA.",
    );
    await expect(page.getByLabel("Nome completo")).toHaveCount(0);
  });

  test("recusa e-mail já cadastrado sem revelar a conta", async ({ page }) => {
    await preencherEtapaUm(page, {
      matricula: "20241006904",
      email: "maria.souza@aluno.ifrj.edu.br",
      senha: SENHA,
      confirmacao: SENHA,
    });

    await expect(page.getByRole("alert").filter({ hasText: "Cadastro recusado" })).toBeVisible();
    await expect(page.getByText("não foi possível", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Criar cadastro" })).toBeVisible();
  });

  test("confirma matrícula importada e conclui cadastro", async ({ page }) => {
    await preencherEtapaUm(page, {
      matricula: "20231000788",
      email: email("importada"),
      senha: SENHA,
      confirmacao: SENHA,
    });

    await expect(page.getByText("Etapa 1 conferida")).toBeVisible();
    await expect(page.getByText(/Matrícula registrada no sistema/)).toBeVisible();
    await expect(page.getByLabel("Nome completo")).toHaveValue("João Pedro Lima");

    await preencherEtapaDois(page);

    await page.getByLabel("Curso", { exact: true }).click();
    await page.getByRole("option", { name: "Eletricidade" }).click();
    await page.getByLabel("Turma", { exact: true }).click();
    await page.getByRole("option", { name: "ELE 2026.1 — 1º período" }).first().click();
    await page.getByLabel("Período", { exact: true }).click();
    await page.getByRole("option", { name: "2026.1", exact: true }).first().click();

    await page.getByRole("button", { name: "Concluir cadastro" }).click();

    await expect(page.getByRole("heading", { name: "Cadastro enviado" })).toBeVisible();
    await expect(page.getByText("Acesso liberado")).toBeVisible();
  });

  test("mantém cadastro pendente quando a matrícula não está registrada", async ({ page }) => {
    await preencherEtapaUm(page, {
      matricula: "20230444555",
      email: email("pendente"),
      senha: SENHA,
      confirmacao: SENHA,
    });

    await expect(page.getByText(/não está registrada no sistema/)).toBeVisible();

    await preencherEtapaDois(page);

    await page.getByLabel("Curso", { exact: true }).click();
    await page.getByRole("option", { name: "Informática" }).click();
    await page.getByLabel("Turma", { exact: true }).click();
    await page.getByRole("option", { name: "INF 2026.1 — 1º período" }).first().click();
    await page.getByLabel("Período", { exact: true }).click();
    await page.getByRole("option", { name: "2026.1", exact: true }).first().click();

    await page.getByRole("button", { name: "Concluir cadastro" }).click();

    await expect(page.getByRole("heading", { name: "Cadastro enviado" })).toBeVisible();
    await expect(page.getByText("Aguarde a autorização")).toBeVisible();
  });

  test("limpa turma e período ao trocar o curso", async ({ page }) => {
    await preencherEtapaUm(page, {
      matricula: "20231000999",
      email: email("dependentes"),
      senha: SENHA,
      confirmacao: SENHA,
    });

    await preencherEtapaDois(page);

    await page.getByLabel("Curso", { exact: true }).click();
    await page.getByRole("option", { name: "Eletricidade" }).click();
    await page.getByLabel("Turma", { exact: true }).click();
    await page.getByRole("option", { name: "ELE 2026.1 — 1º período" }).first().click();
    await page.getByLabel("Período", { exact: true }).click();
    await page.getByRole("option", { name: "2026.1", exact: true }).first().click();

    await expect(page.getByLabel("Turma", { exact: true })).toContainText("ELE 2026.1");

    await page.getByLabel("Curso", { exact: true }).click();
    await page.getByRole("option", { name: "Informática" }).click();

    await expect(page.getByLabel("Turma", { exact: true })).toContainText("Selecione a turma");
    await expect(page.getByLabel("Período", { exact: true })).toContainText("Selecione o período");
  });

  test("oferece apenas opções cadastradas e recusa valor não cadastrado", async ({ page }) => {
    await preencherEtapaUm(page, {
      matricula: "20231000999",
      email: email("selecao"),
      senha: SENHA,
      confirmacao: SENHA,
    });

    // Turma e período ficam bloqueados até o curso, e a lista é a cadastrada.
    await expect(page.getByLabel("Turma", { exact: true })).toBeDisabled();
    await expect(page.getByLabel("Período", { exact: true })).toBeDisabled();

    await page.getByLabel("Curso", { exact: true }).click();

    await expect(page.getByRole("option")).toHaveText([
      "Análise e Desenvolvimento de Sistemas",
      "Eletricidade",
      "Informática",
    ]);
    await page.getByRole("option", { name: "Informática" }).click();

    await expect(page.getByLabel("Turma", { exact: true })).toBeEnabled();
    await expect(page.getByLabel("Período", { exact: true })).toBeDisabled();

    await page.getByLabel("Turma", { exact: true }).click();

    const turmas = page.getByRole("option");

    await expect(turmas).toHaveCount(1);
    await expect(turmas.first()).toContainText("INF 2026.1");
    await expect(turmas.first()).not.toContainText("ADS");

    await turmas.first().click();

    await expect(page.getByLabel("Período", { exact: true })).toBeEnabled();

    // O select não aceita digitação livre: digitar não cria opção nova.
    await page.getByLabel("Turma", { exact: true }).press("a");
    await page.getByLabel("Turma", { exact: true }).click();

    await expect(page.getByRole("option")).toHaveCount(1);
    await page.keyboard.press("Escape");

    await expect(page.getByLabel("Turma", { exact: true })).toContainText("INF 2026.1");
  });
});
