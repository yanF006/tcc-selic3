import { expect, test, type Page } from "@playwright/test";

const SENHA = "selic123";

async function entrar(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await Promise.all([
    page.waitForURL((url) => url.pathname !== "/login"),
    page.getByRole("button", { name: "Entrar", exact: true }).click(),
  ]);
}

async function semRolagemHorizontal(page: Page) {
  const dados = await page.evaluate(() => {
    const largura = window.innerWidth;
    const excesso = document.documentElement.scrollWidth - largura;
    const culpados = [...document.querySelectorAll("body *")]
      .map((elemento) => {
        const caixa = elemento.getBoundingClientRect();

        return caixa.right > largura + 1
          ? {
              tag: elemento.tagName,
              classe: String(elemento.className).slice(0, 90),
              direita: Math.round(caixa.right),
            }
          : null;
      })
      .filter(Boolean)
      .slice(0, 8);

    return { excesso, culpados };
  });
  expect(
    dados.excesso,
    `${page.url()} largura=${await page.evaluate(() => window.innerWidth)} ${JSON.stringify(dados.culpados)}`,
  ).toBeLessThanOrEqual(1);
}

async function focoVisivel(page: Page) {
  return page.evaluate(() => {
    const elemento = document.activeElement as HTMLElement | null;
    if (!elemento) return false;
    const estilo = getComputedStyle(elemento);
    const larguraContorno = Number.parseFloat(estilo.outlineWidth || "0");

    return estilo.boxShadow !== "none" || (estilo.outlineStyle !== "none" && larguraContorno > 0);
  });
}

async function identificadorAtivo(page: Page) {
  return page.evaluate(() => {
    const elemento = document.activeElement as HTMLElement | null;
    if (!elemento) return "";

    return (
      elemento.id ||
      elemento.getAttribute("aria-label") ||
      elemento.textContent?.trim().slice(0, 40) ||
      elemento.tagName
    );
  });
}

test("mantém as telas sem rolagem horizontal em 360, 768 e 1440 px (13.1)", async ({ page }) => {
  const paginasAluno = ["/documentos", "/estagio", "/perfil"];
  const paginasCoordenacao = [
    "/coordenacao/estagios",
    "/coordenacao/documentos",
    "/coordenacao/estatisticas",
    "/coordenacao/cadastros",
    "/coordenacao/templates",
  ];
  const paginasAdmin = ["/admin/usuarios", "/admin/matriculas", "/admin/convenios"];

  await entrar(page, "maria.souza@aluno.ifrj.edu.br");
  for (const largura of [360, 768, 1440]) {
    await page.setViewportSize({ width: largura, height: 900 });
    for (const rota of paginasAluno) {
      await page.goto(rota);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await semRolagemHorizontal(page);
    }
  }

  await entrar(page, "ana.correia@ifrj.edu.br");
  for (const largura of [360, 768, 1440]) {
    await page.setViewportSize({ width: largura, height: 900 });
    for (const rota of paginasCoordenacao) {
      await page.goto(rota);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await semRolagemHorizontal(page);
    }
  }

  await entrar(page, "felipe.andrade@ifrj.edu.br");
  for (const largura of [360, 768, 1440]) {
    await page.setViewportSize({ width: largura, height: 900 });
    for (const rota of paginasAdmin) {
      await page.goto(rota);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await semRolagemHorizontal(page);
    }
  }
});

test("deixa a navegação recolhida e as ações principais ao alcance no celular (13.2)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await entrar(page, "maria.souza@aluno.ifrj.edu.br");

  await page.goto("/estagio");
  await page.getByRole("button", { name: "Abrir o menu", exact: true }).click();
  const menu = page.locator("#painel-navegacao");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: "Documentos", exact: true })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Estágio", exact: true })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Perfil", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Solicitar estágio", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fechar o menu", exact: true }).click();
  await expect(page.getByRole("button", { name: "Abrir o menu", exact: true })).toBeVisible();

  await page.goto("/documentos");
  await expect(page.getByRole("heading", { name: "Documentos", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Preencher documento" }).first()).toBeVisible();

  await page.goto("/perfil");
  await expect(page.getByRole("button", { name: "Salvar alterações" })).toBeVisible();

  await entrar(page, "ana.correia@ifrj.edu.br");
  await page.goto("/coordenacao/estatisticas");
  await page.getByRole("button", { name: "Abrir o menu", exact: true }).click();
  await expect(
    page.locator("#painel-navegacao").getByRole("link", { name: "Estatísticas", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fechar o menu", exact: true }).click();
  await expect(page.getByRole("button", { name: "Aplicar filtros", exact: true })).toBeVisible();

  await entrar(page, "felipe.andrade@ifrj.edu.br");
  await page.goto("/admin/usuarios");
  await expect(page.getByRole("button", { name: "Novo usuário", exact: true })).toBeVisible();
});

test("percorre os formulários por teclado com foco visível e ordem previsível (13.3)", async ({
  page,
}) => {
  await page.goto("/login");

  const ordemLogin: string[] = [];
  for (let passo = 0; passo < 12; passo += 1) {
    await page.keyboard.press("Tab");
    ordemLogin.push(await identificadorAtivo(page));
    if (ordemLogin.at(-1) === "email") expect(await focoVisivel(page)).toBe(true);
  }
  const posicaoEmail = ordemLogin.indexOf("email");
  const posicaoSenha = ordemLogin.indexOf("senha");
  const posicaoEntrar = ordemLogin.findIndex((valor) => valor === "Entrar");
  expect(posicaoEmail).toBeGreaterThanOrEqual(0);
  expect(posicaoSenha).toBeGreaterThan(posicaoEmail);
  expect(posicaoEntrar).toBeGreaterThan(posicaoSenha);

  await entrar(page, "maria.souza@aluno.ifrj.edu.br");
  await page.goto("/estagio");
  await page.getByRole("button", { name: "Solicitar estágio", exact: true }).click();
  await page.locator("#convênio").focus();
  const ordemEstagio: string[] = ["convênio"];
  for (let passo = 0; passo < 30; passo += 1) {
    await page.keyboard.press("Tab");
    const atual = await identificadorAtivo(page);
    if (ordemEstagio.at(-1) === atual) continue;
    ordemEstagio.push(atual);
  }
  expect(ordemEstagio).toEqual(
    expect.arrayContaining(["convênio", "orientador", "supervisor", "dataInicio", "dataFim"]),
  );
  const indices = ["convênio", "orientador", "supervisor", "dataInicio", "dataFim"].map((id) =>
    ordemEstagio.indexOf(id),
  );
  expect(indices).toEqual([...indices].sort((a, b) => a - b));

  await entrar(page, "ana.correia@ifrj.edu.br");
  await page.goto("/coordenacao/documentos");
  const decisao = page.locator('[id^="decisao-"]').first();
  if ((await decisao.count()) > 0) {
    await decisao.focus();
    expect(await focoVisivel(page)).toBe(true);
    await page.keyboard.press("Tab");
    await expect(page.locator("textarea:focus")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Emitir parecer", exact: true }).first(),
    ).toBeFocused();
  }
});

test("fecha diálogos com Escape devolvendo o foco ao botão de origem (13.5)", async ({ page }) => {
  await entrar(page, "felipe.andrade@ifrj.edu.br");
  await page.goto("/admin/usuarios");

  const gatilho = page.getByRole("button", { name: "Novo usuário", exact: true });
  await gatilho.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Novo usuário" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(gatilho).toBeFocused();
});
