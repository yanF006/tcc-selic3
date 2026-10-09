import { expect, test, type Page } from "@playwright/test";

/**
 * Catálogo dos documentos do Kit de Estágio (8.3) e download dos documentos
 * fixos (8.4). O catálogo é comum a todos os cargos, então o teste entra como
 * aluno e como Coordenador de Estágio para conferir que a distinção entre
 * documento preenchível e documento apenas para download é a mesma nos dois.
 */

const SENHA = "selic123";
const CATALOGO = "Catálogo dos documentos do Kit de Estágio";

async function entrar(page: Page, email: string) {
  await page.goto("/login");

  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);

  await Promise.all([
    page.waitForURL((url) => url.pathname !== "/login", { timeout: 60_000 }),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);
}

/** Cartão do catálogo com o nome informado. */
function cartao(page: Page, nome: string) {
  return page
    .getByRole("list", { name: CATALOGO })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: nome }) });
}

test.describe("catálogo de documentos", () => {
  test("lista os doze documentos separando preenchível de download", async ({ page }) => {
    await entrar(page, "maria.souza@aluno.ifrj.edu.br");
    await page.goto("/documentos");

    await expect(page.getByRole("heading", { name: "Documentos", level: 1 })).toBeVisible();
    await expect(page.getByRole("list", { name: CATALOGO }).getByRole("listitem")).toHaveCount(12);

    // Os dois documentos fixos do Kit são apenas para download.
    for (const nome of ["Lei de Estágio", "Regulamento de Estágio dos Cursos de Licenciatura"]) {
      await expect(cartao(page, nome).getByText("Apenas download")).toBeVisible();
      await expect(cartao(page, nome).getByRole("link", { name: "Baixar documento" })).toBeVisible();
      await expect(
        cartao(page, nome).getByRole("link", { name: "Preencher documento" }),
      ).toHaveCount(0);
    }

    // Os demais são preenchíveis.
    for (const nome of ["Formulário de Liberação", "Plano de Atividades de Estágio"]) {
      await expect(cartao(page, nome).getByText("Preenchível", { exact: true })).toBeVisible();
      await expect(cartao(page, nome).getByRole("link", { name: "Preencher documento" })).toBeVisible();
    }

    await expect(page.getByText("Apenas download")).toHaveCount(2);
    await expect(page.getByText("Preenchível", { exact: true })).toHaveCount(10);
  });

  test("a coordenação abre o mesmo catálogo e vê quem preenche cada documento", async ({ page }) => {
    await entrar(page, "ana.correia@ifrj.edu.br");
    await page.goto("/documentos");

    await expect(page.getByRole("heading", { name: "Documentos", level: 1 })).toBeVisible();
    await expect(page.getByRole("list", { name: CATALOGO }).getByRole("listitem")).toHaveCount(12);

    // O Convênio é preenchido pela COIEE; a Ficha de Frequência também não é do aluno.
    await expect(
      cartao(page, "Convênio de Estágio").getByText("Preenchimento: Coordenador de Estágio"),
    ).toBeVisible();

    // Documento de aluno não oferece formulário a quem não o preenche.
    await expect(
      cartao(page, "Formulário de Liberação").getByText(
        "O preenchimento deste documento cabe a outro perfil.",
      ),
    ).toBeVisible();
  });
});

test.describe("download dos documentos fixos", () => {
  test("baixa a Lei de Estágio sem abrir formulário", async ({ page }) => {
    await entrar(page, "maria.souza@aluno.ifrj.edu.br");
    await page.goto("/documentos");

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 60_000 }),
      cartao(page, "Lei de Estágio").getByRole("link", { name: "Baixar documento" }).click(),
    ]);

    expect(download.suggestedFilename()).toContain("Lei de Est");

    // O catálogo não trocou a página por formulário nenhum.
    await expect(page.getByRole("heading", { name: "Documentos", level: 1 })).toBeVisible();
    await expect(page.locator("form")).toHaveCount(0);
  });

  test("recusa baixar documento preenchível pelo catálogo", async ({ request, context, page }) => {
    await entrar(page, "maria.souza@aluno.ifrj.edu.br");

    const cookies = await context.cookies();

    const resposta = await request.get("/documentos/tpl-formulario-liberacao/baixar", {
      headers: { cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ") },
    });

    expect(resposta.status()).toBe(409);
  });
});
