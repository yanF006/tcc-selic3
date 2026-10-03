import { expect, test } from "@playwright/test";

/**
 * Formulários de acesso (correção de UX): indicação do formato do e-mail,
 * obrigatoriedade visível e opção de mostrar a senha enquanto digita.
 */

test.describe("login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  });

  test("marca os campos obrigatórios", async ({ page }) => {
    await expect(page.getByText("são obrigatórios")).toBeVisible();
    await expect(page.getByLabel("E-mail", { exact: true })).toHaveAttribute(
      "aria-required",
      "true",
    );
    await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute(
      "aria-required",
      "true",
    );
  });

  test("confere o formato do e-mail enquanto a pessoa digita", async ({ page }) => {
    const email = page.getByLabel("E-mail", { exact: true });

    await email.fill("maria.souza");
    await email.blur();

    await expect(page.getByText("Formato de e-mail inválido. Use nome@dominio.")).toBeVisible();
    await expect(email).toHaveAttribute("aria-invalid", "true");

    await email.fill("maria.souza@aluno.ifrj.edu.br");

    await expect(page.getByText("Formato de e-mail válido.")).toBeVisible();
    await expect(email).not.toHaveAttribute("aria-invalid", "true");
  });

  test("mostra e esconde a senha", async ({ page }) => {
    const senha = page.getByLabel("Senha", { exact: true });

    await senha.fill("selic123");
    await expect(senha).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Mostrar a senha" }).click();

    // Exibir troca o rótulo do mesmo botão, então é ele que carrega o estado.
    const ocultar = page.getByRole("button", { name: "Ocultar a senha" });

    await expect(senha).toHaveAttribute("type", "text");
    await expect(senha).toHaveValue("selic123");
    await expect(ocultar).toHaveAttribute("aria-pressed", "true");

    await ocultar.click();

    await expect(senha).toHaveAttribute("type", "password");
    await expect(senha).toHaveValue("selic123");
  });

  test("conferir a senha não impede o acesso", async ({ page }) => {
    await page.getByLabel("E-mail", { exact: true }).fill("maria.souza@aluno.ifrj.edu.br");
    await page.getByRole("button", { name: "Mostrar a senha" }).click();
    await page.getByLabel("Senha", { exact: true }).fill("selic123");

    await Promise.all([
      page.waitForURL((url) => url.pathname === "/documentos", { timeout: 60_000 }),
      page.getByRole("button", { name: "Entrar" }).click(),
    ]);
  });
});

test.describe("cadastro público", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cadastro");
    await expect(page.getByRole("heading", { name: "Criar cadastro" })).toBeVisible();
  });

  test("confere e-mail e senha na primeira etapa", async ({ page }) => {
    await expect(page.getByText("são obrigatórios")).toBeVisible();

    const email = page.getByLabel("E-mail", { exact: true });

    await email.fill("nova.aluna@ifrj");
    await email.blur();
    await expect(page.getByText("Formato de e-mail inválido. Use nome@dominio.")).toBeVisible();

    await email.fill("nova.aluna@aluno.ifrj.edu.br");
    await expect(page.getByText("Formato de e-mail válido.")).toBeVisible();

    // Senha curta é apontada no próprio campo.
    await page.getByLabel("Senha", { exact: true }).fill("abc");
    await page.getByLabel("Confirmar senha").click();
    await expect(page.getByText("A senha deve ter ao menos 8 caracteres.")).toBeVisible();

    // As duas senhas podem ser exibidas digitando.
    await page.getByLabel("Senha", { exact: true }).fill("selic123");
    await page.getByLabel("Confirmar senha").fill("selic123");
    await page.getByRole("button", { name: "Mostrar a senha" }).click();
    await page.getByRole("button", { name: "Mostrar a confirmação" }).click();

    await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute("type", "text");
    await expect(page.getByLabel("Confirmar senha")).toHaveAttribute("type", "text");
  });
});
test.describe("tela estreita", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("recolhe a navegação e não cria rolagem horizontal", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();

    const rolagemHorizontal = async () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

    expect(await rolagemHorizontal()).toBeLessThanOrEqual(1);

    await page.getByLabel("E-mail", { exact: true }).fill("felipe.andrade@ifrj.edu.br");
    await page.getByLabel("Senha", { exact: true }).fill("selic123");

    await Promise.all([
      page.waitForURL((url) => url.pathname === "/admin/usuarios", { timeout: 60_000 }),
      page.getByRole("button", { name: "Entrar" }).click(),
    ]);

    await page.goto("/admin/matriculas");

    expect(await rolagemHorizontal()).toBeLessThanOrEqual(1);

    // A linha principal some no celular e a navegação vem no painel.
    const abrir = page.getByRole("button", { name: "Abrir o menu" });

    await expect(abrir).toBeVisible();
    await abrir.click();

    const painel = page.locator("#painel-navegacao");

    await expect(painel.getByRole("link", { name: "Matrículas" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fechar o menu" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  test("redimensionar não perde o que já foi digitado", async ({ page }) => {
    await page.goto("/login");

    const email = page.getByLabel("E-mail", { exact: true });

    await email.fill("maria.souza@aluno.ifrj.edu.br");
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(email).toHaveValue("maria.souza@aluno.ifrj.edu.br");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(email).toHaveValue("maria.souza@aluno.ifrj.edu.br");
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  });
});
