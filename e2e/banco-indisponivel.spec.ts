import { expect, test } from "@playwright/test";

/**
 * Falha controlada do banco no runtime real (change
 * `corrigir-hidratacao-e-carregamento-banco`). O servidor deste arquivo é
 * iniciado por `npm run test:e2e:banco-indisponivel` com `DATABASE_URL`
 * apontando para um destino reservado e timeouts curtos.
 *
 * Um visitante sem sessão não tem identidade a validar, então o banco nem é
 * consultado: ele é levado ao login. A tela "dados indisponíveis" aparece para
 * quem tem sessão; esse caminho é coberto por teste unitário do guarda.
 */

test("mostra carregamento, leva ao login e nenhuma conta padrão ou dado de fixture", async ({
  page,
}) => {
  // Aquecimento: o servidor de desenvolvimento compila a rota na primeira visita
  // (cerca de 2,5 s), o que não faz parte do comportamento medido abaixo.
  await page.request.get("/admin/usuarios", { timeout: 30_000 }).catch(() => undefined);

  const navegacao = page.goto("/admin/usuarios", { waitUntil: "commit" });

  await expect(page.getByRole("status").filter({ hasText: "Carregando dados" })).toBeVisible({
    timeout: 2_000,
  });

  await navegacao;

  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });

  // Nenhuma conta padrão entra, e o login não mostra dados de demonstração.
  await expect(page.getByText("Felipe Andrade")).toHaveCount(0);
  await expect(page.getByText("Maria de Souza Oliveira")).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
});
