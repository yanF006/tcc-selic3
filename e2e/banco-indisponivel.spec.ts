import { expect, test } from "@playwright/test";

/**
 * Falha controlada do banco no runtime real (change
 * `corrigir-hidratacao-e-carregamento-banco`). O servidor deste arquivo é
 * iniciado por `npm run test:e2e:banco-indisponivel` com `DATABASE_URL`
 * apontando para um destino reservado e timeouts curtos.
 */

test("mostra carregamento, erro recuperável e nenhuma conta padrão", async ({
  context,
  page,
  baseURL,
}) => {
  await context.addCookies([
    { name: "selic-sessao", value: "usr-admin", url: baseURL ?? "http://127.0.0.1:3101" },
  ]);

  const navegacao = page.goto("/admin/usuarios", { waitUntil: "commit" });

  await expect(page.getByRole("status").filter({ hasText: "Carregando dados" })).toBeVisible({
    timeout: 2_000,
  });

  await navegacao;

  await expect(
    page.getByRole("heading", { name: "Dados temporariamente indisponíveis" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Os dados estão indisponíveis no momento.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();

  // A falha não pode ser mascarada pelas fixtures.
  await expect(page.getByText("Felipe Andrade")).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByText("Maria de Souza Oliveira")).toHaveCount(0);

  await page.getByRole("button", { name: "Tentar novamente" }).click();

  await expect(
    page.getByRole("heading", { name: "Dados temporariamente indisponíveis" }),
  ).toBeVisible({ timeout: 20_000 });
});
