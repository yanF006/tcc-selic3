import { expect, test } from "@playwright/test";

/**
 * Administração de usuários (11.1, 11.2, 11.3) e mutações em memória (3.4):
 * cadastrar aluno registrando a matrícula ausente, cadastrar aluno com matrícula
 * já registrada sem duplicar, recusar matrícula fora do formato, cadastrar
 * coordenador de curso vinculado ao curso, recusar cadastro sem papel, editar,
 * inativar sem excluir, abrir o perfil completo e filtrar por curso.
 */

const SENHA = "selic123";

/**
 * O estado do simulador vive em memória no processo do servidor, então cada
 * execução usa identificadores novos para não colidir com cadastros de rodadas
 * anteriores. O sufixo é só de dígitos porque a matrícula tem onze.
 */
const SUFIXO = Date.now().toString().slice(-7);

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

/** Registra uma matrícula válida na tela de Matrículas. */
async function registrarMatricula(
  page: import("@playwright/test").Page,
  matricula: string,
  nome: string,
) {
  await page.goto("/admin/matriculas");
  await page.getByLabel("Matrícula", { exact: true }).fill(matricula);
  await page.getByLabel("Nome do aluno").fill(nome);
  await page.getByLabel("Curso", { exact: true }).click();
  await page.getByRole("option", { name: /Informática/ }).click();
  await page.getByRole("button", { name: "Registrar matrícula" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Matrícula registrada" })).toBeVisible();
  await page.goto("/admin/usuarios");
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
  test("cadastra aluno com matrícula registrada", async ({ page }) => {
    await entrarComoAdministrador(page);

    const nome = `Aluno Matriculado ${SUFIXO}`;
    const matricula = `2026${SUFIXO}`;

    await registrarMatricula(page, matricula, nome);

    const dialogo = await abrirFormulario(page);

    await dialogo.getByLabel("Nome", { exact: true }).fill(nome);
    await dialogo
      .getByLabel("E-mail", { exact: true })
      .fill(`aluno.matriculado${SUFIXO}@aluno.ifrj.edu.br`);
    await dialogo.getByLabel("Papel", { exact: true }).click();
    await page.getByRole("option", { name: "Aluno", exact: true }).click();
    await dialogo.getByLabel("Matrícula", { exact: true }).fill(matricula);
    await dialogo.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Cadastro recusado" })).toHaveCount(0);

    await buscar(page, nome);

    const linha = page.getByRole("row").filter({ hasText: nome });

    // Matrícula registrada significa acesso liberado, sem fila de autorização.
    await expect(linha.getByText("Ativo")).toBeVisible();
  });

  test("cadastra aluno registrando a matrícula ausente", async ({ page }) => {
    await entrarComoAdministrador(page);

    const nome = `Aluno Sem Matrícula ${SUFIXO}`;
    const matricula = `2027${SUFIXO}`;

    const dialogo = await abrirFormulario(page);

    await dialogo.getByLabel("Nome", { exact: true }).fill(nome);
    await dialogo
      .getByLabel("E-mail", { exact: true })
      .fill(`sem.matricula${SUFIXO}@aluno.ifrj.edu.br`);
    await dialogo.getByLabel("Papel", { exact: true }).click();
    await page.getByRole("option", { name: "Aluno", exact: true }).click();
    await dialogo.getByLabel("Matrícula", { exact: true }).fill(matricula);
    await dialogo.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Cadastro recusado" })).toHaveCount(0);

    await buscar(page, nome);

    const linha = page.getByRole("row").filter({ hasText: nome });

    // Matrícula agora registrada significa acesso liberado, sem fila de autorização.
    await expect(linha.getByText("Ativo")).toBeVisible();

    // A matrícula entra no registro com a origem do cadastro de administrador.
    await page.goto("/admin/matriculas");
    await page.getByLabel("Buscar por nome, matrícula ou curso").fill(matricula);
    await page.getByRole("button", { name: "Filtrar" }).click();

    await expect(page.getByTestId("total-matriculas")).toContainText("1");
    await expect(page.getByRole("row").filter({ hasText: matricula })).toHaveCount(1);
    await expect(
      page.getByRole("row").filter({ hasText: matricula }).getByText("Lançamento do administrador"),
    ).toBeVisible();
  });

  test("cadastra aluno com matrícula já registrada sem duplicar o registro", async ({ page }) => {
    await entrarComoAdministrador(page);

    const nome = `Aluno Já Registrado ${SUFIXO}`;
    const matricula = `2028${SUFIXO}`;

    await registrarMatricula(page, matricula, nome);

    const dialogo = await abrirFormulario(page);

    await dialogo.getByLabel("Nome", { exact: true }).fill(nome);
    await dialogo
      .getByLabel("E-mail", { exact: true })
      .fill(`ja.registrado${SUFIXO}@aluno.ifrj.edu.br`);
    await dialogo.getByLabel("Papel", { exact: true }).click();
    await page.getByRole("option", { name: "Aluno", exact: true }).click();
    await dialogo.getByLabel("Matrícula", { exact: true }).fill(matricula);
    await dialogo.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Cadastro recusado" })).toHaveCount(0);

    // O registro pré-existente continua único depois do cadastro.
    await page.goto("/admin/matriculas");
    await page.getByLabel("Buscar por nome, matrícula ou curso").fill(matricula);
    await page.getByRole("button", { name: "Filtrar" }).click();

    await expect(page.getByTestId("total-matriculas")).toContainText("1");
    await expect(page.getByRole("row").filter({ hasText: matricula })).toHaveCount(1);
  });

  test("recusa aluno com matrícula fora do formato", async ({ page }) => {
    await entrarComoAdministrador(page);

    const dialogo = await abrirFormulario(page);

    await dialogo.getByLabel("Nome", { exact: true }).fill(`Aluno Formato ${SUFIXO}`);
    await dialogo.getByLabel("E-mail", { exact: true }).fill(`formato${SUFIXO}@aluno.ifrj.edu.br`);
    await dialogo.getByLabel("Papel", { exact: true }).click();
    await page.getByRole("option", { name: "Aluno", exact: true }).click();
    await dialogo.getByLabel("Matrícula", { exact: true }).fill("123");
    await dialogo.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "11 dígitos" })).toBeVisible();
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

  test("exclui dados do aluno preservando os estágios registrados", async ({ page }) => {
    await entrarComoAdministrador(page);
    await page.goto("/coordenacao/estagios?estagio=est-sem-endereco");
    const horasAntesDaExclusao = await page.getByTestId("total-horas").innerText();
    await page.goto("/documentos/tpl-relatorio-semestral?estagio=est-sem-endereco");
    await expect(page.locator("#nomeCompleto")).toHaveText("Luiza Santos");
    await page.goto("/admin/usuarios");

    await buscar(page, "luiza");

    await page.getByRole("button", { name: "Ações de Luiza Santos" }).click();
    await page.getByRole("menuitem", { name: "Excluir cadastro" }).click();

    await expect(
      page.getByRole("status").filter({ hasText: "Cadastro de Luiza Santos excluído." }),
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: "Luiza Santos", exact: true })).toHaveCount(0);
    await page.goto("/coordenacao/estagios?estagio=est-sem-endereco");
    await expect(page.getByText("Detalhes do Estágio", { exact: true })).toBeVisible();
    await expect(page.getByTestId("total-horas")).toHaveText(horasAntesDaExclusao);
    await page.goto("/documentos/tpl-relatorio-semestral?estagio=est-sem-endereco");
    await expect(page.getByText("Documento apenas para consulta", { exact: true })).toBeVisible();
    await expect(page.locator("#nomeCompleto")).toHaveText("Luiza Santos");
    await expect(page.getByRole("button", { name: "Salvar rascunho" })).toBeDisabled();
  });
});

test.describe("filtros e perfil", () => {
  test("filtra a lista por papel, situação, curso e busca", async ({ page }) => {
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

  test("filtra por curso e abre o perfil completo", async ({ page }) => {
    await entrarComoAdministrador(page);

    // Curso sem ninguém vinculado esvazia a lista.
    await page.getByLabel("Curso", { exact: true }).click();
    await page.getByRole("option", { name: /Eletricidade/ }).click();

    await page.getByLabel("Buscar por nome, e-mail ou matrícula").fill("Joao");
    await page.getByRole("button", { name: "Filtrar" }).click();

    const linha = page.getByRole("row").filter({ hasText: "joao.lima@aluno.ifrj.edu.br" });

    await expect(linha).toHaveCount(1);
    await expect(linha.getByText("Eletricidade")).toBeVisible();

    // Perfil completo: papel, matrícula e dados pessoais do aluno.
    await page.getByRole("button", { name: "Ações de João Pedro Lima" }).click();
    await page.getByRole("menuitem", { name: "Ver perfil completo" }).click();

    const perfil = page.getByRole("dialog");

    await expect(perfil.getByRole("heading", { name: /João Pedro Lima/ })).toBeVisible();
    await expect(perfil.getByText("20231000788")).toBeVisible();
    await expect(perfil.getByText("Aluno", { exact: true })).toBeVisible();
    await expect(perfil.getByRole("heading", { name: "Acesso" })).toBeVisible();
    await expect(perfil.getByRole("heading", { name: "Dados pessoais" })).toBeVisible();
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
