import { expect, test } from "@playwright/test";

/**
 * Guarda de sessão e de papel (4.1, 4.6, 4.7). As verificações rodam contra o
 * servidor de desenvolvimento com a flag do seletor de papel desligada; o
 * teste do seletor sobe o servidor com a flag ligada.
 */

const SENHA = "selic123";

/**
 * Entra com uma conta de desenvolvimento e espera a navegação. O tempo é
 * generoso porque o servidor de desenvolvimento compila a rota na primeira
 * visita.
 */
async function entrar(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();

  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(SENHA);

  await Promise.all([
    page.waitForURL((url) => url.pathname !== "/login", { timeout: 60_000 }),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);
}

test.describe("acesso sem sessão", () => {
  test("leva ao login preservando o destino", async ({ page }) => {
    await page.goto("/documentos");

    await expect(page).toHaveURL(/\/login\?redirect=%2Fdocumentos/);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  });

  test("não entrega dados das áreas protegidas", async ({ page }) => {
    await page.goto("/admin/usuarios");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("Usuários", { exact: true })).toHaveCount(0);
  });
});

test.describe("login e logout", () => {
  test("aluno entra, navega e sai voltando ao login", async ({ page }) => {
    await entrar(page, "maria.souza@aluno.ifrj.edu.br");

    await expect(page).toHaveURL(/\/documentos$/);

    const navegacao = page.getByRole("navigation", { name: "Navegação principal" });

    await expect(navegacao.getByRole("link", { name: "Documentos" })).toBeVisible();
    await expect(navegacao.getByRole("link", { name: "Estágio" })).toBeVisible();
    await expect(navegacao.getByRole("link", { name: "Perfil" })).toBeVisible();
    await expect(navegacao.getByRole("link", { name: "Usuários" })).toHaveCount(0);

    await page.getByRole("button", { name: /Maria de Souza/ }).click();
    await page.getByRole("button", { name: "Sair" }).click();

    await expect(page).toHaveURL(/\/login$/);

    await page.reload();

    await expect(page).toHaveURL(/\/login$/);
  });

  test("coordenador de curso não alcança rota de administração", async ({ page }) => {
    await entrar(page, "carla.menezes@ifrj.edu.br");

    await expect(page).toHaveURL(/\/coordenacao\/estagios$/);

    const navegacao = page.getByRole("navigation", { name: "Navegação principal" });

    await expect(navegacao.getByRole("link", { name: "Documentos do curso" })).toBeVisible();
    await expect(navegacao.getByRole("link", { name: "Usuários" })).toHaveCount(0);

    await page.goto("/admin/usuarios");

    await expect(page).toHaveURL(/\/nao-autorizado$/);
    await expect(page.getByRole("heading", { name: "Acesso não autorizado" })).toBeVisible();
    await expect(page.getByText("maria.souza@aluno.ifrj.edu.br")).toHaveCount(0);
  });

  test("frequência exige membro da Comissão de Estágio", async ({ page }) => {
    await entrar(page, "ana.correia@ifrj.edu.br");

    const navegacao = page.getByRole("navigation", { name: "Navegação principal" });

    await expect(navegacao.getByRole("link", { name: "Frequência e avaliação" })).toBeVisible();
    await page.goto("/coordenacao/frequencia");
    await expect(page.getByRole("heading", { name: "Frequência e avaliação" })).toBeVisible();
  });

  test("administrador alcança todas as áreas", async ({ page }) => {
    await entrar(page, "felipe.andrade@ifrj.edu.br");

    await expect(page).toHaveURL(/\/admin\/usuarios$/);

    await page.goto("/coordenacao/estatisticas");
    await expect(page.getByRole("heading", { name: "Estatísticas" })).toBeVisible();

    await page.goto("/documentos");
    await expect(page.getByRole("heading", { name: "Documentos" })).toBeVisible();
  });

  test("não mostra o seletor de papel com a flag desligada", async ({ page }) => {
    await entrar(page, "maria.souza@aluno.ifrj.edu.br");

    await expect(page.getByRole("button", { name: /Ver como/ })).toHaveCount(0);
  });

  test("recusa senha errada sem sair do login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("maria.souza@aluno.ifrj.edu.br");
    await page.getByLabel("Senha").fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  /**
   * 5.1: e-mail inexistente e senha incorreta recebem exatamente a mesma
   * mensagem, sem revelar se a conta existe.
   */
  test("usa a mesma mensagem para e-mail inexistente e senha incorreta", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("E-mail").fill("maria.souza@aluno.ifrj.edu.br");
    await page.getByLabel("Senha").fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();

    const aviso = page.getByRole("alert").filter({ hasText: "Não foi possível entrar" });
    const mensagemSenha = await aviso.textContent();

    await page.getByLabel("E-mail").fill("conta.inexistente@aluno.ifrj.edu.br");
    await page.getByLabel("Senha").fill("selic123");
    await page.getByRole("button", { name: "Entrar" }).click();

    const mensagemInexistente = await aviso.textContent();

    expect(mensagemInexistente).toBe(mensagemSenha);
    expect(mensagemInexistente).toContain("E-mail ou senha inválidos.");
    await expect(page).toHaveURL(/\/login/);
  });
});
