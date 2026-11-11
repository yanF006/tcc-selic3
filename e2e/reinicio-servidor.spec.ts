import { expect, test } from "./suporte/cep";
import { construirServidorDedicado, iniciarServidorDedicado } from "./suporte/servidor";

/**
 * Continuidade do formulário de cadastro entre processos e reinício literal
 * do servidor (5.5): a primeira etapa é conferida por um processo do Next em
 * produção, o servidor é encerrado e religado SEM recarregar o navegador, e a
 * conclusão acontece no novo processo, sem token ou estado prévio de cadastro
 * no servidor. O modo é simulado, como nos demais E2E de cadastro.
 */

const PORTA = 3110;
const SUFIXO = Date.now().toString(36);
const SENHA = "selic123";

/** Servidor dedicado de produção em modo simulado, como os demais E2E de cadastro. */
function servidor() {
  return iniciarServidorDedicado({
    porta: PORTA,
    ambiente: { SELIC_PERSISTENCIA: "simulado", DATABASE_URL: "" },
  });
}

async function preencherEtapaUm(
  page: import("@playwright/test").Page,
  dados: { matricula: string; email: string; senha: string; confirmacao: string },
) {
  await page.goto(`http://127.0.0.1:${PORTA}/cadastro`);
  await expect(page.getByRole("heading", { name: "Criar cadastro" })).toBeVisible();

  await page.getByLabel("Matrícula", { exact: true }).fill(dados.matricula);
  await page.getByLabel("E-mail", { exact: true }).fill(dados.email);
  await page.getByLabel("Senha", { exact: true }).fill(dados.senha);
  await page.getByLabel("Confirmar senha").fill(dados.confirmacao);
  await page.getByRole("button", { name: "Continuar" }).click();
}

async function preencherEtapaDois(page: import("@playwright/test").Page) {
  await page.getByLabel("Nome completo").fill(`Maria Reinicio ${SUFIXO}`);
  await page.getByLabel("CPF").fill("123.456.789-09");
  await page.getByLabel("Data de nascimento").fill("14/03/2005");
  await page.getByLabel("Celular").fill("21998761234");
  await page.getByLabel("CEP").fill("23940000");
  await page.getByLabel("Endereço").fill("Rua das Acácias");
  await page.getByLabel("Número").fill("120");
  await page.getByLabel("Bairro").fill("Centro");
  await page.getByLabel("Cidade").fill("Pinheiral");
}

test.describe("reinício literal do servidor", () => {
  test("conclui o cadastro na segunda instância sem recarregar o navegador", async ({ page }) => {
    // O build de produção é compartilhado pelos dois processos do cenário e
    // a primeira execução parte do zero: o teste pode levar minutos.
    test.setTimeout(420_000);
    await construirServidorDedicado({ SELIC_PERSISTENCIA: "simulado", DATABASE_URL: "" });

    const primeiro = await servidor();

    try {
      await preencherEtapaUm(page, {
        matricula: "20230444562",
        email: `reinicio.${SUFIXO}@aluno.ifrj.edu.br`,
        senha: SENHA,
        confirmacao: SENHA,
      });

      await expect(page.getByText("Etapa 1 conferida")).toBeVisible();
      await expect(page.getByText(/não está registrada no sistema/)).toBeVisible();

      // O servidor é encerrado; a página permanece aberta no navegador.
      await primeiro.parar();

      const segundo = await servidor();

      try {
        // Nenhum recarregamento: o estado do formulário vive no navegador e
        // a conclusão é submetida ao novo processo do servidor.
        await preencherEtapaDois(page);

        await page.getByLabel("Curso", { exact: true }).click();
        await page.getByRole("option", { name: "Informática" }).click();
        await page.getByLabel("Turma", { exact: true }).click();
        await page.getByRole("option", { name: "INF 2026.1 — 1º período" }).first().click();
        await page.getByLabel("Período", { exact: true }).click();
        await page.getByRole("option", { name: "2026.1", exact: true }).first().click();

        await page.getByRole("button", { name: "Concluir cadastro" }).click();

        await expect(page.getByRole("heading", { name: "Cadastro enviado" })).toBeVisible();
        await expect(page.getByText("Aguarde a autorização")).toBeVisible();
      } finally {
        await segundo.parar();
      }
    } finally {
      await primeiro.parar();
    }
  });
});
