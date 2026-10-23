import type { Page } from "@playwright/test";
import { expect, test } from "./suporte/cep";

/**
 * Preenchimento dos documentos dirigido por descritor (D5, 8.6–8.15). Os testes
 * entram como aluno para cobrir a seleção de estágio (8.10), os campos
 * automáticos somente leitura (8.6), a recusa por perfil (8.11), o cálculo da
 * carga horária (8.8), o salvar/reabrir do rascunho (8.9) e o download do
 * documento preenchido, aceito (8.14) ou recusado por pendência (8.15).
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

test.describe("preenchimento de documentos", () => {
  test("não duplica os rótulos dos campos com máscara na liberação", async ({ page }) => {
    await entrar(page, "maria.souza@aluno.ifrj.edu.br");
    await page.goto("/documentos/tpl-formulario-liberacao?estagio=est-maria-hospital");

    for (const rotulo of ["Telefone", "Celular", "Telefone do(a) supervisor(a)"]) {
      await expect(page.getByText(rotulo, { exact: true })).toHaveCount(1);
      await expect(page.getByLabel(rotulo, { exact: true })).toBeEditable();
    }

    const grupo = page.getByRole("group", { name: "Endereço do aluno", exact: true });
    await expect(grupo.getByLabel("CEP", { exact: true })).toHaveCount(1);
    await grupo.getByRole("button", { name: "Alterar endereço" }).click();
    const cep = grupo.getByLabel("CEP", { exact: true });
    await cep.fill("23940000");
    await expect(cep).toHaveValue("23940-000");
  });

  test("exige escolher o estágio antes de abrir o formulário (8.10)", async ({ page }) => {
    await entrar(page, "maria.souza@aluno.ifrj.edu.br");
    await page.goto("/documentos/tpl-formulario-liberacao");

    await expect(page.getByText("Selecione o estágio", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Estágio #/ }).first()).toBeVisible();
  });

  test("mostra o dado automático do cadastro como somente leitura (8.6)", async ({ page }) => {
    await entrar(page, "maria.souza@aluno.ifrj.edu.br");
    await page.goto("/documentos/tpl-ficha-acompanhamento?estagio=est-maria-tecnoweb");

    await expect(page.locator("p#aluno")).toHaveText("Maria de Souza Oliveira");
    await expect(page.locator("p#aluno")).toHaveAttribute("aria-readonly", "true");
    await expect(page.locator("input#aluno")).toHaveCount(0);
  });

  test("recusa o formulário para um perfil sem permissão de preenchimento (8.11)", async ({
    page,
  }) => {
    await entrar(page, "maria.souza@aluno.ifrj.edu.br");
    await page.goto("/documentos/tpl-ficha-frequencia");

    await expect(page.getByText("Preenchimento de outro perfil")).toBeVisible();
    await expect(page.getByText(/Coordenador de Estágio/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar rascunho" })).toHaveCount(0);
  });

  test("pré-preenche a carga horária total e deixa editar (8.8)", async ({ page }) => {
    await entrar(page, "joao.lima@aluno.ifrj.edu.br");
    await page.goto("/documentos/tpl-termo-compromisso?estagio=est-joao-lab");

    const carga = page.getByLabel("Carga horária total");

    await expect(carga).toBeVisible();
    await expect(carga).toBeEditable();
    await carga.fill("180");
    await expect(carga).toHaveValue("180");
  });

  test("salva o rascunho e reaproveita os valores ao reabrir (8.9)", async ({ page }) => {
    await entrar(page, "maria.souza@aluno.ifrj.edu.br");
    await page.goto("/documentos/tpl-ficha-acompanhamento?estagio=est-maria-tecnoweb");

    await page.getByRole("button", { name: "Adicionar linha" }).click();
    await page.getByLabel("Data — linha 1").fill("02/03/2026");
    await page.getByLabel("Entrada — linha 1").fill("09:00");
    await page.getByLabel("Saída — linha 1").fill("15:00");

    await page.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect(page.getByText("Rascunho salvo.")).toBeVisible();

    await page.reload();

    await expect(page.getByLabel("Data — linha 1")).toHaveValue("02/03/2026");
    await expect(page.getByLabel("Entrada — linha 1")).toHaveValue("09:00");
    await expect(page.getByLabel("Saída — linha 1")).toHaveValue("15:00");
    await expect(page.getByText("Documentos preenchidos deste estágio")).toBeVisible();
  });

  test("baixa o documento preenchido em docx (8.14)", async ({ page }) => {
    await entrar(page, "maria.souza@aluno.ifrj.edu.br");
    await page.goto("/documentos/tpl-ficha-acompanhamento?estagio=est-maria-tecnoweb");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Baixar docx" }).click(),
    ]);

    expect(download.suggestedFilename()).toContain("Ficha de Acompanhamento");
  });

  test("recusa o download enquanto houver pendência e aponta os campos (8.15)", async ({
    page,
  }) => {
    await entrar(page, "luiza.santos@aluno.ifrj.edu.br");
    await page.goto("/documentos/tpl-relatorio-semestral?estagio=est-sem-endereco");

    await page.getByRole("button", { name: "Baixar docx" }).click();

    await expect(page.getByText("Corrija o documento")).toBeVisible();
    await expect(page.getByText("Há campos obrigatórios pendentes.")).toBeVisible();
  });

  test("bloqueia a gravação acima do limite de palavras por seção (8.16)", async ({ page }) => {
    await entrar(page, "joao.lima@aluno.ifrj.edu.br");
    await page.goto("/documentos/tpl-proposta-atuacao-pedagogica?estagio=est-joao-lab");

    const introducao = page.getByLabel("Introdução");

    await expect(introducao).toBeVisible();
    await introducao.fill(Array(401).fill("palavra").join(" "));

    await expect(page.getByText("401 de 400 palavras")).toBeVisible();

    await page.getByRole("button", { name: "Salvar rascunho" }).click();

    await expect(page.getByText("Corrija o documento")).toBeVisible();
    await expect(page.getByText(/Introdução tem 401 palavras e o limite é 400/)).toBeVisible();
  });

  test("lista os comprovantes e recusa a submissão com item pendente (8.18)", async ({ page }) => {
    await entrar(page, "maria.souza@aluno.ifrj.edu.br");
    await page.goto("/documentos/tpl-requerimento-aproveitamento?estagio=est-maria-hospital");

    const quintoComprovante = page.getByLabel(/Formulário para escolha do professor/);

    await expect(quintoComprovante).toBeVisible();
    await expect(quintoComprovante).not.toBeChecked();

    await page.getByRole("button", { name: "Submeter a parecer" }).click();

    await expect(page.getByText("Corrija o documento")).toBeVisible();
    await expect(page.locator("#comprovante_5-mensagem")).toContainText("é obrigatório");

    await quintoComprovante.check();
    await page.getByRole("button", { name: "Submeter a parecer" }).click();
    await expect(page.getByText("Documento submetido a parecer.")).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Baixar docx" }).click(),
    ]);

    expect(download.suggestedFilename()).toContain("Requerimento");
  });

  test("permite completar o endereço ausente no documento e bloqueia geração incompleta (8.7)", async ({
    page,
  }) => {
    await entrar(page, "luiza.santos@aluno.ifrj.edu.br");
    await page.goto("/documentos/tpl-relatorio-semestral?estagio=est-sem-endereco");
    const grupo = page.getByRole("group", { name: "Endereço do aluno", exact: true });
    await grupo.getByRole("button", { name: "Alterar endereço" }).click();
    await expect(grupo.getByLabel("Logradouro")).toBeEditable();
    await expect(grupo.getByLabel("Logradouro")).toHaveValue("");
    await page.getByRole("button", { name: "Baixar docx" }).click();
    await expect(grupo.getByText("Endereço é obrigatório.")).toBeVisible();
  });

  test("mostra a faixa e recalcula o conceito global das avaliações (8.17)", async ({ page }) => {
    await entrar(page, "ana.correia@ifrj.edu.br");
    await page.goto("/documentos/tpl-ficha-frequencia?estagio=est-maria-tecnoweb");
    await expect(page.locator("#aluno")).toHaveText("Maria de Souza Oliveira");
    await page.getByLabel("Assiduidade", { exact: true }).fill("9.5");
    await expect(page.getByTestId("faixa-criterio_1")).toContainText("E — Excelente");
    await expect(page.getByLabel("Conceito global", { exact: true })).toHaveValue("9.5");
    await page.getByLabel("Pontualidade", { exact: true }).fill("7.5");
    await expect(page.getByLabel("Conceito global", { exact: true })).toHaveValue("8.5");
    await expect(page.getByLabel("Conceito global", { exact: true })).not.toBeEditable();
  });
});
