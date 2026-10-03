import { expect, test } from "@playwright/test";

/**
 * Senha do usuário (5.8 e 5.9). Recuperação por link de uso único e troca
 * autenticada exigindo a senha atual.
 *
 * Os dois testes usam a conta do aluno com estágio concluído e devolvem a senha
 * ao final, percorrendo o próprio fluxo testado: a suíte inteira continua
 * dependendo da senha `selic123`.
 */

const SENHA = "selic123";
const SENHA_NOVA = "selic-nova-456";
const ALUNO = "joao.lima@aluno.ifrj.edu.br";

/** Pede o link de redefinição e devolve o endereço da tela de redefinição. */
async function pedirLink(page: import("@playwright/test").Page, email: string) {
  await page.goto("/recuperar-senha");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Enviar link de redefinição" }).click();

  const link = page.getByRole("link", { name: /\/redefinir-senha\?token=/ });

  await expect(link).toBeVisible();

  return (await link.getAttribute("href")) ?? "";
}

/** Define a senha pelo link e devolve o texto do cartão final. */
async function definirPeloLink(
  page: import("@playwright/test").Page,
  link: string,
  senha: string,
  confirmacao = senha,
) {
  await page.goto(link);
  await page.getByLabel("Nova senha", { exact: true }).fill(senha);
  await page.getByLabel("Confirmar nova senha").fill(confirmacao);
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
}

async function entrar(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test.describe("recuperação de senha", () => {
  /**
   * 5.8: e-mail cadastrado e e-mail inexistente recebem exatamente a mesma
   * confirmação, sem indicar que o e-mail não está cadastrado.
   */
  test("usa a mesma confirmação para e-mail cadastrado e inexistente", async ({ page }) => {
    await page.goto("/recuperar-senha");

    const confirmacao = page.getByRole("status");

    await page.getByLabel("E-mail", { exact: true }).fill(ALUNO);
    await page.getByRole("button", { name: "Enviar link de redefinição" }).click();

    await expect(page.getByRole("heading", { name: "Solicitação registrada" })).toBeVisible();

    const cadastrado = await confirmacao.textContent();

    await page.goto("/recuperar-senha");
    await page.getByLabel("E-mail", { exact: true }).fill("conta.inexistente@aluno.ifrj.edu.br");
    await page.getByRole("button", { name: "Enviar link de redefinição" }).click();

    await expect(page.getByRole("heading", { name: "Solicitação registrada" })).toBeVisible();

    const inexistente = await confirmacao.textContent();

    expect(inexistente).toBe(cadastrado);
    expect(inexistente).toContain("Se houver um cadastro com este e-mail");
    await expect(page.getByText(/não está cadastrado/i)).toHaveCount(0);
  });

  /**
   * 5.8: o link redefine a senha, libera o login com a nova senha e é recusado
   * quando reutilizado, exigindo nova solicitação.
   */
  test("redefine a senha pelo link e recusa o link reutilizado", async ({ page }) => {
    const link = await pedirLink(page, ALUNO);

    await definirPeloLink(page, link, SENHA_NOVA);

    await expect(page.getByRole("heading", { name: "Senha redefinida" })).toBeVisible();

    // A senha nova entra no próximo acesso.
    await entrar(page, ALUNO, SENHA_NOVA);
    await expect(page).toHaveURL(/\/documentos$/);

    // A senha antiga deixa de valer.
    await page.getByRole("button", { name: /João Pedro Lima/ }).click();
    await page.getByRole("button", { name: "Sair" }).click();
    await entrar(page, ALUNO, SENHA);
    await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();

    // O mesmo link não serve uma segunda vez.
    await definirPeloLink(page, link, "outra-senha-789");
    await expect(page.getByRole("heading", { name: "Link não utilizável" })).toBeVisible();
    await expect(
      page.getByText("Este link é inválido, expirou ou já foi utilizado."),
    ).toBeVisible();
    await expect(page.getByLabel("Nova senha", { exact: true })).toHaveCount(0);

    // Devolve a senha original, para os demais testes da suíte.
    await definirPeloLink(page, await pedirLink(page, ALUNO), SENHA);

    await expect(page.getByRole("heading", { name: "Senha redefinida" })).toBeVisible();
  });
});

test.describe("troca de senha autenticada", () => {
  /** 5.9: senha atual incorreta mantém a senha anterior. */
  test("recusa senha atual incorreta e mantém a anterior", async ({ page }) => {
    await entrar(page, ALUNO, SENHA);
    await expect(page).toHaveURL(/\/documentos$/);

    await page.goto("/conta/senha");
    await expect(page.getByRole("heading", { name: "Alterar senha" })).toBeVisible();

    await page.getByLabel("Senha atual", { exact: true }).fill("senha-errada");
    await page.getByLabel("Nova senha", { exact: true }).fill(SENHA_NOVA);
    await page.getByLabel("Confirmar nova senha").fill(SENHA_NOVA);
    await page.getByRole("button", { name: "Alterar senha" }).click();

    await expect(page.locator("#senhaAtual-mensagem")).toHaveText("A senha atual não confere.");

    // A senha anterior continua válida: a troca não aconteceu.
    await page.getByRole("button", { name: /João Pedro Lima/ }).click();
    await page.getByRole("button", { name: "Sair" }).click();
    await entrar(page, ALUNO, SENHA);
    await expect(page).toHaveURL(/\/documentos$/);

    // E a nova senha nunca passou a valer.
    await page.getByRole("button", { name: /João Pedro Lima/ }).click();
    await page.getByRole("button", { name: "Sair" }).click();
    await entrar(page, ALUNO, SENHA_NOVA);
    await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();
  });

  /** 5.9: com a senha atual correta, a troca acontece e a nova senha entra. */
  test("altera a senha e usa a nova no acesso seguinte", async ({ page }) => {
    await entrar(page, ALUNO, SENHA);
    await page.goto("/conta/senha");

    await page.getByLabel("Senha atual", { exact: true }).fill(SENHA);
    await page.getByLabel("Nova senha", { exact: true }).fill(SENHA_NOVA);
    await page.getByLabel("Confirmar nova senha").fill(SENHA_NOVA);
    await page.getByRole("button", { name: "Alterar senha" }).click();

    await expect(page.getByRole("heading", { name: "Alterar senha" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Senha alterada");

    // Volta à senha original para os demais testes: o formulário só reaparece
    // numa nova visita à página.
    await page.goto("/conta/senha");
    await page.getByLabel("Senha atual", { exact: true }).fill(SENHA_NOVA);
    await page.getByLabel("Nova senha", { exact: true }).fill(SENHA);
    await page.getByLabel("Confirmar nova senha").fill(SENHA);
    await page.getByRole("button", { name: "Alterar senha" }).click();

    await expect(page.getByRole("status")).toContainText("Senha alterada");

    await page.getByRole("button", { name: /João Pedro Lima/ }).click();
    await page.getByRole("button", { name: "Sair" }).click();
    await entrar(page, ALUNO, SENHA);
    await expect(page).toHaveURL(/\/documentos$/);
  });

  test("recusa confirmação divergente da nova senha", async ({ page }) => {
    await entrar(page, ALUNO, SENHA);
    await page.goto("/conta/senha");

    await page.getByLabel("Senha atual", { exact: true }).fill(SENHA);
    await page.getByLabel("Nova senha", { exact: true }).fill(SENHA_NOVA);
    await page.getByLabel("Confirmar nova senha").fill("outra-senha-789");
    await page.getByRole("button", { name: "Alterar senha" }).click();

    await expect(page.locator("#confirmacao-mensagem")).toHaveText(
      "A confirmação não bate com a senha.",
    );
    await expect(page.getByRole("status")).toHaveCount(0);
  });
});
