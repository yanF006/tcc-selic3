import { expect, test } from "@playwright/test";

/**
 * Administração de usuários (11.1, 11.2, 11.3) e mutações em memória (3.4):
 * cadastrar aluno com e sem autorização de matrícula, cadastrar coordenador de
 * curso vinculado ao curso, recusar cadastro sem papel, editar, inativar sem
 * excluir e confirmar que a inativação bloqueia o acesso.
 */

const SENHA = "selic123";

/**
 * O estado do simulador vive em memória no processo do servidor, então cada
 * execução usa identificadores novos para não colidir com cadastros de rodadas
 * anteriores.
 */
const SUFIXO = Date.now().toString(36);

async function entrarComoAdministrador(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();

  await page.getByLabel("E-mail", { exact: true }).fill("felipe.andrade@ifrj.edu.br");
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);

  await Promise.all([
    page.waitForURL((url) => url.pathname === "/admin/usuarios", { timeout: 60_000 }),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);
}

/** Filtra a lista por um termo para o registro ficar na primeira página. */
async function buscar(page: import("@playwright/test").Page, termo: string) {
  await page.getByLabel("Buscar por nome, e-mail ou matrícula").fill(termo);
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByTestId("total-usuarios")).toContainText("encontrado(s)");
}

async function abrirFormulario(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Novo usuário" }).click();

  return page.getByRole("dialog");
}

test.describe("cadastro pela administração", () => {
  test("cadastra aluno com autorização de matrícula fora do SIGAA", async ({ page }) => {
    await entrarComoAdministrador(page);

    const nome = `Aluno Autorizado ${SUFIXO}`;
    const dialogo = await abrirFormulario(page);

    await dialogo.getByLabel("Nome", { exact: true }).fill(nome);
    await dialogo
      .getByLabel("E-mail", { exact: true })
      .fill(`aluno.autorizado${SUFIXO}@aluno.ifrj.edu.br`);
    await dialogo.getByLabel("Papel", { exact: true }).click();
    await page.getByRole("option", { name: "Aluno", exact: true }).click();
    await dialogo.getByLabel("Matrícula (SIGAA)").fill("2026555001");
    await dialogo.getByRole("checkbox").check();
    await dialogo.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Cadastro recusado" })).toHaveCount(0);

    await buscar(page, nome);

    const linha = page.getByRole("row").filter({ hasText: nome });

    // Matrícula autorizada entra como pendente, aguardando a liberação.
    await expect(linha.getByText("Pendente")).toBeVisible();
  });

  test("recusa matrícula fora do SIGAA sem autorização explícita", async ({ page }) => {
    await entrarComoAdministrador(page);

    const dialogo = await abrirFormulario(page);

    await dialogo.getByLabel("Nome", { exact: true }).fill(`Aluno Sem Autorização ${SUFIXO}`);
    await dialogo
      .getByLabel("E-mail", { exact: true })
      .fill(`sem.autorizacao${SUFIXO}@aluno.ifrj.edu.br`);
    await dialogo.getByLabel("Papel", { exact: true }).click();
    await page.getByRole("option", { name: "Aluno", exact: true }).click();
    await dialogo.getByLabel("Matrícula (SIGAA)").fill("2026999888");
    await dialogo.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "não consta no SIGAA" })).toBeVisible();
  });

  test("recusa cadastro sem papel definido", async ({ page }) => {
    await entrarComoAdministrador(page);

    const dialogo = await abrirFormulario(page);

    await dialogo.getByLabel("Nome", { exact: true }).fill(`Sem Papel ${SUFIXO}`);
    await dialogo.getByLabel("E-mail", { exact: true }).fill(`sem.papel${SUFIXO}@ifrj.edu.br`);
    await dialogo.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Escolha o papel" })).toBeVisible();
  });

  test("cadastra coordenador de curso vinculado ao curso", async ({ page }) => {
    await entrarComoAdministrador(page);

    const nome = `Coordenadora Curso ${SUFIXO}`;
    const dialogo = await abrirFormulario(page);

    await dialogo.getByLabel("Nome", { exact: true }).fill(nome);
    await dialogo
      .getByLabel("E-mail", { exact: true })
      .fill(`coordenador.curso${SUFIXO}@ifrj.edu.br`);
    await dialogo.getByLabel("Papel", { exact: true }).click();
    await page.getByRole("option", { name: "Coordenador de Curso" }).click();
    await dialogo.getByLabel("Curso", { exact: true }).click();
    await page.getByRole("option", { name: /Eletricidade/ }).click();
    await dialogo.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Cadastro recusado" })).toHaveCount(0);

    await buscar(page, nome);

    const linha = page.getByRole("row").filter({ hasText: nome });

    await expect(linha.getByText("Coordenador de Curso")).toBeVisible();
    await expect(linha.getByText("Eletricidade")).toBeVisible();
  });
});

test.describe("edição, inativação e exclusão", () => {
  test("edita, inativa sem excluir e o acesso é bloqueado", async ({ page, context }) => {
    await entrarComoAdministrador(page);

    const nome = `Rita de Cálculo ${SUFIXO}`;
    const nomeEditado = `Rita Nogueira ${SUFIXO}`;
    const dialogo = await abrirFormulario(page);

    await dialogo.getByLabel("Nome", { exact: true }).fill(nome);
    await dialogo.getByLabel("E-mail", { exact: true }).fill(`rita.nogueira${SUFIXO}@ifrj.edu.br`);
    await dialogo.getByLabel("Papel", { exact: true }).click();
    await page.getByRole("option", { name: "Administrador" }).click();
    await dialogo.getByRole("button", { name: "Cadastrar" }).click();

    await buscar(page, nome);
    await expect(page.getByRole("cell", { name: nome, exact: true })).toBeVisible();

    // Editar
    await page.getByRole("button", { name: `Ações de ${nome}` }).click();
    await page.getByRole("menuitem", { name: "Editar cadastro" }).click();

    const edicao = page.getByRole("dialog");

    await edicao.getByLabel("Nome", { exact: true }).fill(nomeEditado);
    await edicao.getByRole("button", { name: "Salvar alterações" }).click();

    await buscar(page, nomeEditado);
    await expect(page.getByRole("cell", { name: nomeEditado, exact: true })).toBeVisible();

    // A matrícula do aluno é imutável depois do cadastro.
    await page.getByRole("button", { name: `Ações de ${nomeEditado}` }).click();
    await page.getByRole("menuitem", { name: "Inativar acesso" }).click();

    const linha = page.getByRole("row").filter({ hasText: nomeEditado });

    await expect(linha.getByText("Inativo")).toBeVisible();
    await expect(page.getByTestId("total-usuarios")).toContainText("encontrado(s)");

    // A inativação bloqueia o acesso: a sessão do usuário inativo não abre área
    // autenticada, e o cadastro continua na lista.
    await context.addCookies([
      {
        name: "selic-sessao",
        value: await idDoUsuario(page, nomeEditado),
        url: "http://127.0.0.1:3000",
      },
    ]);
    await page.goto("/admin/usuarios");

    await expect(page).toHaveURL(/\/login/);
  });

  test("recusa excluir aluno com estágios registrados", async ({ page }) => {
    await entrarComoAdministrador(page);

    await buscar(page, "maria");

    await page.getByRole("button", { name: "Ações de Maria de Souza Oliveira" }).click();
    await page.getByRole("menuitem", { name: "Excluir cadastro" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Inative o cadastro" })).toBeVisible();
  });
});

test.describe("filtros", () => {
  test("filtra a lista por papel, situação e busca", async ({ page }) => {
    await entrarComoAdministrador(page);

    // Busca por e-mail encontra exatamente o cadastro inativo.
    await buscar(page, "carla.eletro");

    const linha = page.getByRole("row").filter({ hasText: "carla.eletro@ifrj.edu.br" });

    await expect(linha).toHaveCount(1);
    await expect(linha.getByText("Inativo")).toBeVisible();

    // Papel sem resultado: a pessoa não é aluna.
    await page.getByLabel("Papel", { exact: true }).click();
    await page.getByRole("option", { name: "Aluno", exact: true }).click();

    await expect(page.getByTestId("total-usuarios")).toContainText("Nenhum usuário encontrado");

    // Coordenador de curso devolve o mesmo cadastro.
    await page.getByLabel("Papel", { exact: true }).click();
    await page.getByRole("option", { name: "Coordenador de Curso" }).click();

    await expect(linha).toHaveCount(1);

    // Situação ativa esvazia o resultado: o único cadastro do recorte é inativo.
    await page.getByLabel("Situação", { exact: true }).click();
    await page.getByRole("option", { name: "Ativo", exact: true }).click();

    await expect(page.getByTestId("total-usuarios")).toContainText("Nenhum usuário encontrado");

    await page.getByLabel("Situação", { exact: true }).click();
    await page.getByRole("option", { name: "Inativo", exact: true }).click();

    await expect(linha).toHaveCount(1);
    await expect(page.getByTestId("total-usuarios")).toContainText("encontrado(s)");
  });
});

/** Lê o identificador do cadastro a partir da resposta do servidor. */
async function idDoUsuario(page: import("@playwright/test").Page, nome: string): Promise<string> {
  const celula = page.getByRole("cell", { name: nome, exact: true });
  const linha = page.getByRole("row").filter({ has: celula });

  await expect(linha).toHaveCount(1);

  const id = await linha.getAttribute("data-usuario-id");

  if (!id) throw new Error("A linha da tabela não expõe data-usuario-id.");

  return id;
}
