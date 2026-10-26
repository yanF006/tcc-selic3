import { expect, test, type Page } from "@playwright/test";

test.use({ actionTimeout: 15_000 });

async function entrar(page: Page, email: string) {
  await page.goto("about:blank");
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("selic123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((url) => url.pathname !== "/login");
}

async function criarSolicitacao(page: Page, orientador = "Carla Menezes") {
  await page.goto("/estagio");
  await page.getByRole("button", { name: "Solicitar estágio", exact: true }).click();
  await page.getByLabel("Convênio", { exact: true }).click();
  await page.getByRole("option", { name: /Convênio de Estágio — Tecnoweb/ }).click();
  await page.getByLabel("Orientador", { exact: true }).click();
  await page.getByRole("option", { name: orientador, exact: true }).click();
  await page.getByLabel("Supervisor", { exact: true }).click();
  await page.getByRole("option", { name: "Ricardo Alves", exact: true }).click();
  await page.getByLabel("Data de Início", { exact: true }).fill("2028-01-03");
  await page.getByLabel("Data de Fim", { exact: true }).fill("2028-01-28");
  await page.getByLabel("Duração prevista em horas").fill("120");
  const local = page.getByRole("group", { name: "Endereço do local de estágio", exact: true });
  await local.getByRole("button", { name: "Alterar endereço" }).click();
  await local.getByLabel("Logradouro", { exact: true }).fill("Rua da Empresa");
  await local.getByLabel("Número", { exact: true }).fill("10");
  await page.getByLabel("Telefone do(a) supervisor(a)", { exact: true }).fill("2133331000");
  await page.getByLabel("Dados dos documentos iniciais").selectOption("tpl-termo-compromisso");
  const concedente = page.getByRole("group", { name: "Endereço da concedente", exact: true });
  await concedente.getByRole("button", { name: "Alterar endereço" }).click();
  await concedente.getByLabel("Logradouro", { exact: true }).fill("Rua da Empresa");
  await concedente.getByLabel("Número", { exact: true }).fill("10");
  await page.getByLabel("CNPJ da instituição", { exact: true }).fill("11222333000181");
  await page.getByLabel("Representada por", { exact: true }).fill("Marina Duarte");
  await page.getByLabel("Nome do diretor", { exact: true }).fill("Diretor do campus");
  await page.getByLabel("Seguradora", { exact: true }).fill("Seguradora");
  await page.getByLabel("Número da apólice", { exact: true }).fill("AP-120");
  await page.getByLabel("Carga horária semanal", { exact: true }).fill("30");
  await page.getByLabel("Horário do estágio", { exact: true }).fill("09:00 às 15:00");
  await page.getByLabel("Dados dos documentos iniciais").selectOption("tpl-plano-atividades");
  await page.getByRole("radio", { name: "Estágio", exact: true }).check();
  await page
    .getByLabel("Atividades", { exact: true })
    .fill("Apoio ao ensino e desenvolvimento de sistemas.");
  await page.getByRole("button", { name: "Salvar Estágio", exact: true }).click();
  await expect(page).toHaveURL(/\/estagio\?estagio=/);
  return new URL(page.url()).searchParams.get("estagio")!;
}

test("solicitação, indeferimento excepcional, assinaturas, liberação e histórico", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await entrar(page, "maria.souza@aluno.ifrj.edu.br");
  const estagioId = await criarSolicitacao(page);
  const alunoUrl = `/estagio?estagio=${estagioId}`;
  const coordenacaoUrl = `/coordenacao/estagios?estagio=${estagioId}`;
  await expect(page.getByTestId("fluxo-estagio")).toContainText("Confira os três documentos");
  await expect(page.getByRole("button", { name: "Editar estágio", exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Selecionar documentos", exact: true }),
  ).toHaveCount(0);
  await page.goto(`/documentos/tpl-termo-compromisso?estagio=${estagioId}`);
  await expect(page.getByLabel("Carga horária total", { exact: true })).toHaveValue("120");
  await expect(page.getByText(/Este documento não está sujeito a parecer/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Submeter a parecer", exact: true })).toHaveCount(
    0,
  );
  await page.goto(`/documentos/tpl-relatorio-semestral?estagio=${estagioId}`);
  await expect(page.getByText("Documento indisponível nesta etapa", { exact: true })).toBeVisible();
  await page.goto(alunoUrl);
  await page.getByRole("button", { name: "Solicitar encaminhamento" }).click();
  await expect(page.getByTestId("fluxo-estagio")).toContainText("Aguarde o parecer");

  await entrar(page, "carla.menezes@ifrj.edu.br");
  await page.goto("/coordenacao/documentos");
  await expect(page.getByText("Aluno: João Pedro Lima", { exact: true })).toHaveCount(0);
  const itemFila = page
    .locator('[data-testid^="documento-"]')
    .filter({ hasText: "Formulário de Liberação" });
  await expect(itemFila).toContainText("Maria de Souza Oliveira");
  await itemFila.getByRole("button", { name: "Emitir parecer", exact: true }).click();
  expect(
    await itemFila
      .getByLabel("Decisão do parecer")
      .evaluate((elemento) => (elemento as HTMLSelectElement).checkValidity()),
  ).toBe(false);
  await itemFila.getByLabel("Decisão do parecer").selectOption("indeferido");
  await itemFila.getByLabel("Observações do parecer").fill("Confira os dados do local.");
  await itemFila.getByRole("button", { name: "Emitir parecer", exact: true }).click();
  await expect(itemFila).toHaveCount(0);
  await page.goto(coordenacaoUrl);
  await expect(page.getByTestId("fluxo-estagio")).toContainText("Parecer desfavorável");

  await entrar(page, "maria.souza@aluno.ifrj.edu.br");
  await page.goto(alunoUrl);
  await page.getByRole("button", { name: "Corrigir indeferimento" }).click();
  await expect(page.getByRole("button", { name: "Solicitar encaminhamento" })).toBeVisible();
  await page.getByRole("button", { name: "Editar estágio", exact: true }).click();
  await page.getByLabel("Dados dos documentos iniciais").selectOption("tpl-formulario-liberacao");
  const localCorrigido = page.getByRole("group", {
    name: "Endereço do local de estágio",
    exact: true,
  });
  await localCorrigido.getByRole("button", { name: "Alterar endereço" }).click();
  await localCorrigido.getByLabel("Logradouro", { exact: true }).fill("Rua da Empresa Corrigida");
  await page.getByLabel("Dados dos documentos iniciais").selectOption("tpl-plano-atividades");
  await page
    .getByLabel("Atividades", { exact: true })
    .fill("Atividades conferidas: apoio pedagógico e desenvolvimento de sistemas.");
  await page.getByRole("button", { name: "Salvar Estágio", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/estagio\\?estagio=${estagioId}`));
  await page.getByRole("button", { name: "Solicitar encaminhamento" }).click();
  await expect(page.getByTestId("fluxo-estagio")).toContainText("Aguarde o parecer");

  await entrar(page, "carla.menezes@ifrj.edu.br");
  await page.goto(coordenacaoUrl);
  await page.getByLabel("Parecer do Formulário de Liberação").selectOption("aprovado");
  await page.getByLabel("Observações do parecer").fill("Documentação aprovada.");
  await page.getByRole("button", { name: "Emitir parecer", exact: true }).click();
  await expect(page.getByTestId("fluxo-estagio")).toContainText("Enviado para");
  await expect(page.getByTestId("fluxo-estagio")).toContainText("Aguarde as assinaturas externas");

  await entrar(page, "ana.correia@ifrj.edu.br");
  await page.goto(coordenacaoUrl);
  const painel = page.getByTestId("fluxo-estagio");
  await painel.getByRole("checkbox").first().check();
  await painel.getByRole("button", { name: "Confirmar assinaturas e liberar estágio" }).click();
  await expect(painel).toContainText("Confirme as assinaturas dos três documentos");
  for (const checkbox of await painel.getByRole("checkbox").all()) await checkbox.check();
  const termo = painel.getByRole("region", { name: "Termo de Compromisso", exact: true });
  await termo.getByRole("textbox").fill("Assinaturas conferidas na via física.");
  await painel.getByRole("button", { name: "Confirmar assinaturas e liberar estágio" }).click();
  await expect(painel).toContainText("Estágio liberado e aluno notificado");
  await termo.getByRole("textbox").fill("Observação posterior à liberação.");
  await termo.getByRole("button", { name: "Acrescentar observação" }).click();
  await expect(termo).toContainText("Observação posterior à liberação.");
  await expect(painel).toContainText("Carla Menezes");
  await expect(painel).toContainText("Ana Beatriz Correia");

  await entrar(page, "maria.souza@aluno.ifrj.edu.br");
  await page.goto(alunoUrl);
  await page.getByRole("button", { name: /^Notificações:/ }).click();
  await expect(page.getByRole("menu").getByText("Estágio liberado", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Selecionar documentos", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar estágio", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Selecionar documentos", exact: true }).click();
  await page.getByLabel(/Ficha de Acompanhamento/).check();
  await page.getByRole("button", { name: "Salvar seleção", exact: true }).click();
  await expect(page.locator('[data-template-id="tpl-ficha-acompanhamento"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-template-id="tpl-ficha-acompanhamento"]')).toBeVisible();
  await expect(
    page
      .locator('[data-template-id="tpl-termo-compromisso"]')
      .getByRole("button", { name: "Remover" }),
  ).toHaveCount(0);
  await page.getByLabel("Data", { exact: true }).fill("2028-01-04");
  await page.getByLabel("Entrada", { exact: true }).fill("09:00");
  await page.getByLabel("Saída", { exact: true }).fill("15:00");
  await page.getByRole("button", { name: "Lançar horas", exact: true }).click();
  await expect(page.getByTestId("total-horas")).toHaveText("6,00 h");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Excluir estágio", exact: true }).click();
  await expect(page.getByTestId("fluxo-estagio")).toContainText(
    "Registro encerrado e preservado para histórico",
  );
  await expect(
    page.getByRole("button", { name: "Selecionar documentos", exact: true }),
  ).toHaveCount(0);
});

test("aluno cancela solicitação pendente e o registro continua no histórico", async ({ page }) => {
  await entrar(page, "luiza.santos@aluno.ifrj.edu.br");
  await page.goto("/estagio?estagio=est-solicitacao-luiza");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancelar solicitação", exact: true }).click();
  await expect(page.getByTestId("fluxo-estagio")).toContainText(
    "Registro encerrado e preservado para histórico",
  );
  await page.reload();
  await expect(page.getByText("Cancelado", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Solicitar encaminhamento", exact: true }),
  ).toHaveCount(0);
});

test("comissão consulta as horas e emite parecer sem observações pela fila", async ({ page }) => {
  await entrar(page, "ana.correia@ifrj.edu.br");
  await page.getByRole("link", { name: /^Pareceres pendentes:/ }).click();
  const requerimento = page.getByTestId("documento-doc-requerimento-em-analise");
  await expect(requerimento).toContainText("Total de horas solicitado: 120 h");
  await requerimento.getByLabel("Decisão do parecer").selectOption("aprovado");
  await requerimento.getByRole("button", { name: "Emitir parecer", exact: true }).click();
  await expect(requerimento).toHaveCount(0);
});

test("coordenação conclui, acrescenta observação em documento sem parecer e reabre", async ({
  page,
}) => {
  await entrar(page, "ana.correia@ifrj.edu.br");
  await page.goto("/coordenacao/estagios?estagio=est-maria-tecnoweb");
  const painel = page.getByTestId("fluxo-estagio");
  await painel.getByRole("button", { name: "Concluir estágio", exact: true }).click();
  await expect(painel.getByRole("button", { name: "Reabrir estágio", exact: true })).toBeVisible();
  const termo = painel.getByRole("region", { name: "Termo de Compromisso", exact: true });
  await termo.getByRole("textbox").fill("Observação histórica após a conclusão.");
  await termo.getByRole("button", { name: "Acrescentar observação", exact: true }).click();
  await expect(termo).toContainText("Observação histórica após a conclusão.");
  await painel.getByRole("button", { name: "Reabrir estágio", exact: true }).click();
  await expect(painel.getByRole("button", { name: "Concluir estágio", exact: true })).toBeVisible();
});

test("documentos da coordenação pesquisam aluno, orientador, supervisor e instituição", async ({
  page,
}) => {
  await entrar(page, "carla.menezes@ifrj.edu.br");
  await page.goto("/coordenacao/documentos?visao=todos");
  await expect(page.getByText("Aluno: João Pedro Lima", { exact: true })).toHaveCount(0);
  for (const busca of ["Maria de Souza Oliveira", "Carla Menezes", "Ricardo Alves", "Hospital"]) {
    await page.getByLabel("Buscar documentos", { exact: true }).fill(busca);
    await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
    await expect(page.locator('[data-testid^="documento-"]').first()).toBeVisible();
  }
  await page
    .getByLabel("Buscar documentos", { exact: true })
    .fill("Instituição inexistente no catálogo");
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await expect(
    page.getByText("Nenhum documento corresponde aos filtros aplicados.", { exact: true }),
  ).toBeVisible();
  await entrar(page, "ana.correia@ifrj.edu.br");
  await page.goto("/coordenacao/documentos?visao=todos");
  await expect(page.getByText("Aluno: João Pedro Lima", { exact: true }).first()).toBeVisible();
});

test("e-mail de assinante indisponível gera histórico de falha e notificação ao aluno", async ({
  page,
}) => {
  await entrar(page, "maria.souza@aluno.ifrj.edu.br");
  const estagioId = await criarSolicitacao(page, "Orientador sem e-mail");
  await page.getByRole("button", { name: "Solicitar encaminhamento", exact: true }).click();
  await entrar(page, "carla.menezes@ifrj.edu.br");
  await page.goto(`/coordenacao/estagios?estagio=${estagioId}`);
  await page.getByLabel("Parecer do Formulário de Liberação").selectOption("aprovado");
  await page.getByRole("button", { name: "Emitir parecer", exact: true }).click();
  await expect(page.getByTestId("fluxo-estagio")).toContainText("Falha no envio");
  await entrar(page, "maria.souza@aluno.ifrj.edu.br");
  await page.goto(`/estagio?estagio=${estagioId}`);
  await page.getByRole("button", { name: /^Notificações:/ }).click();
  await expect(
    page.getByRole("menu").getByText("E-mail do assinante indisponível", { exact: true }).first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancelar solicitação", exact: true }).click();
  await expect(page.getByTestId("fluxo-estagio")).toContainText("Registro encerrado");
});
