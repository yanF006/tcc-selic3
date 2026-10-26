import type { Page, Route } from "@playwright/test";
import { expect, test } from "./suporte/cep";

async function entrar(page: Page, email = "joao.lima@aluno.ifrj.edu.br") {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("selic123");
  await Promise.all([
    page.waitForURL((url) => url.pathname !== "/login"),
    page.getByRole("button", { name: "Entrar", exact: true }).click(),
  ]);
}

test("cadastro: consulta automaticamente e persiste a correção manual", async ({
  page,
  context,
}) => {
  const sufixo = Date.now().toString().slice(-7);
  const matricula = `2026${sufixo}`;
  const email = `cep.${sufixo}@aluno.ifrj.edu.br`;
  await entrar(page, "felipe.andrade@ifrj.edu.br");
  await page.goto("/admin/matriculas");
  await page.getByLabel("Matrícula", { exact: true }).fill(matricula);
  await page.getByLabel("Nome do aluno").fill("Aluno da consulta CEP");
  await page.getByLabel("Curso", { exact: true }).click();
  await page.getByRole("option", { name: "Informática", exact: true }).click();
  await page.getByRole("button", { name: "Registrar matrícula" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Matrícula registrada" })).toBeVisible();
  await context.clearCookies();
  await page.goto("/cadastro");
  await page.getByLabel("Matrícula", { exact: true }).fill(matricula);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("selic123");
  await page.getByLabel("Confirmar senha").fill("selic123");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("CPF", { exact: true }).fill("52998224725");
  await page.getByLabel("Data de nascimento").fill("12031998");
  await page.getByLabel("Celular", { exact: true }).fill("21987654321");
  await page.getByLabel("CEP", { exact: true }).fill("20040030");
  await expect(page.getByLabel("Endereço", { exact: true })).toHaveValue("Rua consultada");
  await page.getByLabel("Endereço", { exact: true }).fill("Correção manual no cadastro");
  await page.getByLabel("Número", { exact: true }).fill("42");
  await page.getByLabel("Complemento", { exact: true }).fill("Casa C");
  await page.getByLabel("Curso", { exact: true }).click();
  await page.getByRole("option", { name: "Informática", exact: true }).click();
  await page.getByLabel("Turma", { exact: true }).click();
  await page.getByRole("option", { name: "INF 2026.1 — 1º período" }).first().click();
  await page.getByLabel("Período", { exact: true }).click();
  await page.getByRole("option", { name: "2026.1", exact: true }).first().click();
  await page.getByRole("button", { name: "Concluir cadastro" }).click();
  await expect(page.getByRole("heading", { name: "Cadastro enviado" })).toBeVisible();
  await entrar(page, email);
  await page.goto("/perfil");
  await expect(page.getByLabel("Endereço", { exact: true })).toHaveValue(
    "Correção manual no cadastro",
  );
  await expect(page.getByLabel("Complemento", { exact: true })).toHaveValue("Casa C");
});

test("perfil: consulta, corrige, salva e reabre sem consultar na carga inicial", async ({
  page,
}) => {
  let consultas = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/enderecos/cep?")) consultas++;
  });
  await entrar(page);
  await page.goto("/perfil");
  await expect(page.getByLabel("CEP", { exact: true })).toBeVisible();
  expect(consultas).toBe(0);
  await page.getByLabel("CEP", { exact: true }).fill("20040030");
  await expect(page.getByLabel("Endereço", { exact: true })).toHaveValue("Rua consultada");
  await page.getByLabel("Endereço", { exact: true }).fill("Rua corrigida no perfil");
  await page.getByLabel("Número", { exact: true }).fill("s/n");
  await page.getByLabel("Complemento", { exact: true }).fill("Casa B");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Dados atualizados.", { exact: true })).toBeVisible();
  const antes = consultas;
  await page.reload();
  await expect(page.getByLabel("Endereço", { exact: true })).toHaveValue("Rua corrigida no perfil");
  await expect(page.getByLabel("Número", { exact: true })).toHaveValue("s/n");
  await expect(page.getByLabel("Complemento", { exact: true })).toHaveValue("Casa B");
  expect(consultas).toBe(antes);
});

test("documento: prioriza cadastro, consulta apenas na edição e preserva correção salva", async ({
  page,
}) => {
  let consultas = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/enderecos/cep?")) consultas++;
  });
  await entrar(page, "maria.souza@aluno.ifrj.edu.br");
  await page.goto("/perfil");
  const original = await page.getByLabel("Endereço", { exact: true }).inputValue();
  await page.goto("/documentos/tpl-relatorio-semestral?estagio=est-maria-tecnoweb");
  let aluno = page.getByRole("group", { name: "Endereço do aluno", exact: true });
  const local = page.getByRole("group", { name: "Endereço da instituição", exact: true });
  await expect(aluno.getByLabel("Logradouro")).toHaveValue(original);
  expect(consultas).toBe(0);
  await aluno.getByRole("button", { name: "Alterar endereço" }).click();
  await aluno.getByLabel("Número").fill("55");
  expect(consultas).toBe(0);
  await aluno.getByLabel("CEP").fill("20040030");
  await expect(aluno.getByLabel("Logradouro")).toHaveValue("Rua consultada");
  await aluno.getByRole("button", { name: "Consultar CEP" }).click();
  await expect.poll(() => consultas).toBe(2);
  await expect(aluno.getByRole("status")).toContainText("Endereço preenchido");
  await aluno.getByLabel("Logradouro").fill("Correção exclusiva do documento");
  await aluno.getByLabel("Complemento").fill("Apartamento 3");
  await local.getByRole("button", { name: "Alterar endereço" }).click();
  await local.getByLabel("Logradouro").fill("Rua do local");
  await local.getByLabel("Número").fill("10");
  await expect(aluno.getByLabel("Logradouro")).toHaveValue("Correção exclusiva do documento");
  for (const rotulo of [
    "Descrição da empresa",
    "Objetivos do estágio",
    "Desenvolvimento das atividades",
    "Dificuldades encontradas",
    "Considerações finais",
  ])
    await page
      .getByLabel(rotulo, { exact: true })
      .fill("Relato das atividades e da experiência de estágio.");
  for (const opcao of await page.getByRole("radio", { name: "Bom", exact: true }).all())
    await opcao.check();
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText("Rascunho salvo.")).toBeVisible();
  await page.reload();
  aluno = page.getByRole("group", { name: "Endereço do aluno", exact: true });
  await expect(aluno.getByLabel("Logradouro")).toHaveValue("Correção exclusiva do documento");
  await expect(aluno.getByLabel("Complemento")).toHaveValue("Apartamento 3");
  await expect(
    page
      .getByRole("group", { name: "Endereço da instituição", exact: true })
      .getByLabel("Logradouro"),
  ).toHaveValue("Rua do local");
  expect(consultas).toBe(2);
  await page.goto("/perfil");
  await expect(page.getByLabel("Endereço", { exact: true })).toHaveValue(original);
});

for (const caso of ["nao_encontrado", "indisponivel", "inutilizavel", "parcial"] as const) {
  test(`perfil: ${caso} preserva campos e permite salvar manualmente`, async ({ page }) => {
    await page.route("**/api/enderecos/cep?*", async (rota) => {
      await rota.fulfill({
        status: caso === "indisponivel" ? 503 : 200,
        json:
          caso === "parcial"
            ? { status: "encontrado", endereco: { cep: "20040030", cidade: "Cidade parcial" } }
            : caso === "inutilizavel"
              ? { inesperado: true }
              : { status: caso },
      });
    });
    await entrar(page);
    await page.goto("/perfil");
    await page.getByLabel("Endereço", { exact: true }).fill("Preservar antes da consulta");
    await page.getByLabel("CEP", { exact: true }).fill("20040030");
    // Trocar apenas a máscara do mesmo CEP não consulta; o botão cobre esse caso.
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByRole("status")).toContainText(
      caso === "parcial"
        ? "Endereço preenchido"
        : caso === "nao_encontrado"
          ? "CEP não encontrado"
          : "Não foi possível consultar",
    );
    await expect(page.getByLabel("Endereço", { exact: true })).toHaveValue(
      "Preservar antes da consulta",
    );
    if (caso === "parcial")
      await expect(page.getByLabel("Cidade", { exact: true })).toHaveValue("Cidade parcial");
    await page.getByLabel("Endereço", { exact: true }).fill(`Endereço manual ${caso}`);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Dados atualizados.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Endereço", { exact: true })).toHaveValue(
      `Endereço manual ${caso}`,
    );
  });
}

test("CEP inválido não consulta e resposta antiga não sobrescreve novo CEP ou edição manual", async ({
  page,
}) => {
  const pendentes: Route[] = [];
  await page.route("**/api/enderecos/cep?*", (rota) => {
    pendentes.push(rota);
  });
  await entrar(page);
  await page.goto("/perfil");
  await page.getByLabel("CEP", { exact: true }).fill("123");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByRole("status")).toContainText("O CEP deve ter 8 dígitos");
  expect(pendentes).toHaveLength(0);
  await page.getByLabel("CEP", { exact: true }).fill("23940000");
  await expect.poll(() => pendentes.length).toBe(1);
  await page.getByLabel("CEP", { exact: true }).fill("23935000");
  await expect.poll(() => pendentes.length).toBe(2);
  await page.getByLabel("Endereço", { exact: true }).fill("Manual durante consulta");
  await pendentes[1].fulfill({
    json: {
      status: "encontrado",
      endereco: { cep: "23935000", logradouro: "Não aplicar", cidade: "Volta Redonda" },
    },
  });
  await pendentes[0].fulfill({
    json: {
      status: "encontrado",
      endereco: { cep: "23940000", logradouro: "Resposta antiga", cidade: "Pinheiral" },
    },
  });
  await expect(page.getByRole("status")).toContainText("Endereço preenchido");
  await expect(page.getByLabel("Endereço", { exact: true })).toHaveValue("Manual durante consulta");
  await expect(page.getByLabel("Cidade", { exact: true })).toHaveValue("Volta Redonda");
  await expect(page.getByLabel("CEP", { exact: true })).toHaveValue("23935-000");
});
