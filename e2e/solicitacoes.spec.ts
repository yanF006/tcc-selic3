import { expect, test } from "@playwright/test";

/**
 * Fila de cadastros pendentes (5.6) e bloqueio do cadastro pendente nas áreas
 * autenticadas (5.7).
 *
 * Os testes criam o próprio cadastro pendente pelo fluxo público, para poder
 * rodar várias vezes contra o mesmo servidor de desenvolvimento.
 */

const SUFIXO = Date.now().toString(36);
/** Só dígitos: a matrícula do SIGAA tem dez dígitos. */
const DIGITOS = Date.now().toString().slice(-6);
const SENHA = "selic123";

async function entrar(page: import("@playwright/test").Page, email: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(SENHA);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 }),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);
}

/** Cria um cadastro pendente pelo fluxo público e devolve o nome da pessoa. */
let contador = 0;

async function criarCadastroPendente(page: import("@playwright/test").Page): Promise<string> {
  contador += 1;

  const nome = `Fila ${SUFIXO}-${contador}`;
  const matricula = `2026${DIGITOS}${contador}`.slice(0, 10);

  await page.goto("/cadastro");
  await page.getByLabel("Matrícula (SIGAA)").fill(matricula);
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(`pendente.${SUFIXO}.${contador}@aluno.ifrj.edu.br`);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await page.getByLabel("Confirmar senha").fill(SENHA);
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByText(/não consta nos registros importados/)).toBeVisible();

  await page.getByLabel("Nome completo").fill(nome);
  await page.getByLabel("CPF").fill("123.456.789-09");
  await page.getByLabel("Data de nascimento").fill("2005-03-14");
  await page.getByLabel("Endereço").fill("Rua das Acácias");
  await page.getByLabel("Bairro").fill("Centro");
  await page.getByLabel("Cidade").fill("Pinheiral");
  await page.getByLabel("Curso", { exact: true }).click();
  await page.getByRole("option", { name: "Informática" }).click();
  await page.getByLabel("Turma", { exact: true }).click();
  await page.getByRole("option", { name: "INF 2026.1 — 1º período" }).click();
  await page.getByLabel("Período", { exact: true }).click();
  await page.getByRole("option", { name: "2026.1", exact: true }).click();
  await page.getByRole("button", { name: "Concluir cadastro" }).click();

  await expect(page.getByRole("heading", { name: "Cadastro enviado" })).toBeVisible();

  return nome;
}

/** Entra como um cargo de gestão e abre a fila de cadastros pendentes. */
async function abrirFila(page: import("@playwright/test").Page, email: string): Promise<void> {
  await entrar(page, email);
  await page.goto("/solicitacoes");
  await expect(page.getByRole("heading", { name: "Cadastros pendentes" })).toBeVisible();
}

test.describe("fila de cadastros pendentes", () => {
  test("coordenação autoriza o cadastro pendente e o aluno passa a entrar", async ({ page }) => {
    const nome = await criarCadastroPendente(page);

    await abrirFila(page, "ana.correia@ifrj.edu.br");

    const linha = page.getByRole("row").filter({ hasText: nome });

    await expect(linha).toHaveCount(1);
    await expect(linha.getByText("Pendente", { exact: true })).toBeVisible();

    await linha.getByLabel("Motivo da decisão").fill("Matrícula conferida com a secretaria.");
    await linha.getByRole("button", { name: "Autorizar acesso" }).click();

    // A decisão tira a solicitação da fila de pendentes.
    await expect(linha).toHaveCount(0);

    // O cadastro aprovado aparece na lista de autorizadas com o motivo.
    await page.getByLabel("Situação").click();
    await page.getByRole("option", { name: "Autorizadas" }).click();

    const aprovada = page.getByRole("row").filter({ hasText: nome });

    await expect(aprovada).toHaveCount(1);
    await expect(aprovada.getByText("Autorizado", { exact: true })).toBeVisible();
    await expect(aprovada).toContainText("Matrícula conferida com a secretaria.");
  });

  test("recusa com motivo e mantém o cadastro fora do acesso", async ({ page }) => {
    const nome = await criarCadastroPendente(page);

    await abrirFila(page, "carla.menezes@ifrj.edu.br");

    const linha = page.getByRole("row").filter({ hasText: nome });

    await linha.getByLabel("Motivo da decisão").fill("Matrícula não pertence a este campus.");
    await linha.getByRole("button", { name: "Recusar cadastro" }).click();

    await expect(linha).toHaveCount(0);

    await page.getByLabel("Situação").click();
    await page.getByRole("option", { name: "Recusadas" }).click();

    const recusada = page.getByRole("row").filter({ hasText: nome });

    await expect(recusada).toHaveCount(1);
    await expect(recusada.getByText("Recusado", { exact: true })).toBeVisible();
    await expect(recusada).toContainText("Matrícula não pertence a este campus.");
  });

  test("administrador enxerga a mesma fila", async ({ page }) => {
    await abrirFila(page, "felipe.andrade@ifrj.edu.br");

    await page.getByLabel("Situação").click();
    await page.getByRole("option", { name: "Todas" }).click();

    await expect(page.getByTestId("total-solicitacoes")).toContainText("solicitação(ões)");
  });

  test("aluno não acessa a fila", async ({ page }) => {
    await entrar(page, "maria.souza@aluno.ifrj.edu.br");
    await page.goto("/solicitacoes");

    await expect(page).toHaveURL(/\/nao-autorizado/);
  });
});

test.describe("cadastro pendente nas áreas autenticadas", () => {
  test("aluno pendente vê aviso e nenhum dado do sistema", async ({ page }) => {
    await entrar(page, "paula.batista@aluno.ifrj.edu.br");

    await expect(page).toHaveURL(/\/documentos/);
    await expect(
      page.getByRole("heading", { name: "Cadastro aguardando autorização" }),
    ).toBeVisible();
    await expect(page.getByText(/Nenhum dado do sistema/)).toBeVisible();

    // Nenhum dado de aluno aparece na página.
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByText(/Convênio de Estágio/)).toHaveCount(0);
    await expect(page.getByText(/Documentos pendentes/)).toHaveCount(0);
  });

  test("aluno pendente não acessa as áreas de gestão", async ({ page }) => {
    await entrar(page, "paula.batista@aluno.ifrj.edu.br");

    await page.goto("/solicitacoes");

    await expect(page).toHaveURL(/\/nao-autorizado/);
  });
});
