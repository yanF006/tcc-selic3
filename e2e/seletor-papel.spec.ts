import { expect, test } from "@playwright/test";

/**
 * Seletor de papel (4.7): só aparece com `NEXT_PUBLIC_SELIC_SELADOR_PAPEL=true`.
 * Este arquivo roda em um servidor próprio; use `npm run test:e2e:seletor`.
 */

const COM_A_FLAG = process.env.NEXT_PUBLIC_SELIC_SELADOR_PAPEL === "true";

test.skip(!COM_A_FLAG, "Rode com npm run test:e2e:seletor para validar o seletor de papel.");

test("troca a sessão entre as quatro áreas", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await page.waitForLoadState("networkidle");

  await page.getByLabel("E-mail").fill("maria.souza@aluno.ifrj.edu.br");
  await page.getByLabel("Senha").fill("selic123");
  await page.getByRole("button", { name: "Entrar" }).click();

  // O servidor de desenvolvimento compila a rota sob demanda na primeira visita.
  await page.waitForURL(/\/documentos$/, { timeout: 60_000 });

  await trocarPara(page, "Aluno", "Coordenador de Estágio", /\/coordenacao\/estagios$/);
  await trocarPara(page, "Coordenador de Estágio", "Administrador", /\/admin\/usuarios$/);

  const navegacao = page.getByRole("navigation", { name: "Navegação principal" });

  await expect(navegacao.getByRole("link", { name: "Convênios" })).toBeVisible();
});

async function trocarPara(
  page: import("@playwright/test").Page,
  rotuloAtual: string,
  rotuloAlvo: string,
  destino: RegExp,
) {
  const seletor = page.getByRole("button", { name: new RegExp(rotuloAtual) });

  await expect(seletor).toBeVisible();
  await seletor.click();

  const item = page.getByRole("menuitem", { name: new RegExp(rotuloAlvo) });

  await expect(item).toBeVisible();
  await item.click();

  await expect(page).toHaveURL(destino);
}
