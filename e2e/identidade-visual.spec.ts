import { expect, test } from "@playwright/test";

/**
 * Identidade visual e navegação recolhida (2.6): a marca oficial aparece ao
 * lado do nome sem cobrir a navegação, o nome acompanha o tema, o navegador
 * recebe o ícone do sistema e, abaixo de 640 px, a navegação fica recolhida
 * atrás de um botão sem perder as ações principais.
 */

const SENHA = "selic123";

/** 375 px é a largura de celular comum; 639 px é o limite logo abaixo de 640. */
const CELULAR = { width: 375, height: 667 };
const ABAIXO_DE_640 = { width: 639, height: 800 };
const COMPUTADOR = { width: 1280, height: 800 };

async function entrar(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("maria.souza@aluno.ifrj.edu.br");
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);

  await Promise.all([
    page.waitForURL((url) => url.pathname !== "/login", { timeout: 60_000 }),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);
}

/** Cor aplicada ao nome do logotipo e token que a define no tema corrente. */
async function coresDoLogo(page: import("@playwright/test").Page) {
  return page
    .locator("[data-parte-logo='marca']")
    .first()
    .evaluate((elemento) => {
      const nome = elemento.querySelector("[data-parte-logo='nome']") as HTMLElement;
      const hex = getComputedStyle(elemento).getPropertyValue("--logo-texto").trim();
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

      return {
        token: `rgb(${r}, ${g}, ${b})`,
        aplicada: getComputedStyle(nome).color,
      };
    });
}

test.describe("logotipo", () => {
  test("carrega a marca oficial ao lado do nome", async ({ page }) => {
    await entrar(page);

    const marca = page.locator("[data-parte-logo='marca'] img");

    await expect(marca).toBeVisible();
    await expect(marca).toHaveAttribute("src", "/selic-logo.svg");

    // A imagem precisa ter carregado de verdade, e não estar com o tamanho zero.
    const imagem = await marca.evaluate((img) => {
      const elemento = img as HTMLImageElement;

      return { largura: elemento.naturalWidth, altura: elemento.naturalHeight };
    });

    expect(imagem.largura).toBeGreaterThan(0);
    expect(imagem.altura).toBeGreaterThan(0);
  });

  test("não cobre os itens da navegação", async ({ page }) => {
    await page.setViewportSize(COMPUTADOR);
    await entrar(page);

    const logo = page.locator("[data-parte-logo='marca']").first();
    const primeiroItem = page
      .getByRole("navigation", { name: "Navegação principal" })
      .getByRole("link", { name: "Documentos" });

    await expect(logo).toBeVisible();
    await expect(primeiroItem).toBeVisible();

    const [caixaDoLogo, caixaDoNome, caixaDoItem] = await Promise.all([
      logo.boundingBox(),
      logo.locator("[data-parte-logo='nome']").boundingBox(),
      primeiroItem.boundingBox(),
    ]);

    expect(caixaDoLogo).not.toBeNull();
    expect(caixaDoNome).not.toBeNull();
    expect(caixaDoItem).not.toBeNull();

    // O nome precisa caber dentro da caixa do logotipo e parar antes do primeiro
    // item: quando ele transborda, invade os itens da navegação.
    expect(caixaDoNome!.x + caixaDoNome!.width).toBeLessThanOrEqual(
      caixaDoLogo!.x + caixaDoLogo!.width + 1,
    );
    expect(caixaDoNome!.x + caixaDoNome!.width).toBeLessThanOrEqual(caixaDoItem!.x);
  });

  test("aplica a variante do tema em uso", async ({ page }) => {
    await entrar(page);

    const claro = await coresDoLogo(page);

    await page.getByRole("button", { name: "Alterar tema" }).click();
    await page.getByRole("menuitem", { name: "Escuro" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    const escuro = await coresDoLogo(page);

    // A variante acompanha o tema: a cor muda e é sempre a do token do tema.
    expect(escuro.token).not.toBe(claro.token);
    expect(claro.aplicada).toBe(claro.token);
    expect(escuro.aplicada).toBe(escuro.token);

    await page.getByRole("button", { name: "Alterar tema" }).click();
    await page.getByRole("menuitem", { name: "Claro" }).click();
  });

  test("fica visível sobre a navegação nos dois temas", async ({ page }) => {
    await entrar(page);

    const logo = page.locator("[data-parte-logo='marca']").first();

    await expect(logo).toBeVisible();
    await expect(logo.locator("img")).toBeVisible();

    await page.getByRole("button", { name: "Alterar tema" }).click();
    await page.getByRole("menuitem", { name: "Escuro" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await expect(logo).toBeVisible();
    await expect(logo.locator("img")).toBeVisible();

    await page.getByRole("button", { name: "Alterar tema" }).click();
    await page.getByRole("menuitem", { name: "Claro" }).click();
  });

  test("entrega o ícone do navegador", async ({ page, request }) => {
    await page.goto("/login");

    const icones = page.locator("link[rel='icon']");

    await expect(icones).not.toHaveCount(0);

    const enderecos = await icones.evaluateAll((nos) =>
      nos.map((no) => (no as HTMLLinkElement).href),
    );

    expect(enderecos.length).toBeGreaterThan(0);

    for (const endereco of enderecos) {
      const resposta = await request.get(endereco);

      expect(resposta.status(), endereco).toBe(200);
      expect(resposta.headers()["content-type"], endereco).toContain("image/");
    }
  });
});

test.describe("navegação recolhida", () => {
  test("recolhe em tela estreita e abre por botão", async ({ page }) => {
    await page.setViewportSize(ABAIXO_DE_640);
    await entrar(page);

    const painel = page.locator("#painel-navegacao");
    const botao = page.getByRole("button", { name: "Abrir o menu" });

    await expect(painel).toBeHidden();
    await expect(botao).toBeVisible();

    await botao.click();

    await expect(painel).toBeVisible();
    await expect(painel.getByRole("link", { name: "Documentos" })).toBeVisible();
    await expect(painel.getByRole("link", { name: "Estágio" })).toBeVisible();
    await expect(painel.getByRole("link", { name: "Perfil" })).toBeVisible();

    // Escolher um item fecha o painel e leva à tela.
    await painel.getByRole("link", { name: "Perfil" }).click();

    await expect(page).toHaveURL(/\/perfil$/);
    await expect(painel).toBeHidden();
  });

  test("mantém as ações principais no celular", async ({ page }) => {
    await page.setViewportSize(CELULAR);
    await entrar(page);

    await expect(page.getByRole("button", { name: "Alterar tema" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir o menu" })).toBeVisible();

    await page.getByRole("button", { name: "Abrir o menu" }).click();

    await expect(page.locator("#painel-navegacao")).toBeVisible();

    // Sem rolagem horizontal no celular.
    const rolagemHorizontal = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );

    expect(rolagemHorizontal).toBe(false);
  });

  test("abre a linha principal no computador", async ({ page }) => {
    await page.setViewportSize(COMPUTADOR);
    await entrar(page);

    const navegacao = page.getByRole("navigation", { name: "Navegação principal" });

    await expect(page.getByRole("button", { name: "Abrir o menu" })).toBeHidden();
    await expect(navegacao).toBeVisible();
    await expect(navegacao.getByRole("link", { name: "Documentos" })).toBeVisible();
    await expect(navegacao.getByRole("link", { name: "Estágio" })).toBeVisible();
    await expect(navegacao.getByRole("link", { name: "Perfil" })).toBeVisible();
  });
});
