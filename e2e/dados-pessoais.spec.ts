import { expect, test } from "./suporte/cep";

/**
 * Dados pessoais do aluno (6.1 a 6.3): máscaras de entrada, validação de CPF com
 * dígito verificador ao sair do campo e validação de telefone e celular por DDD
 * e quantidade de dígitos.
 *
 * Os erros conferidos aqui são os dos campos, e não os do servidor: o cadastro
 * ainda nem foi concluído quando a mensagem aparece.
 */

const SUFIXO = Date.now().toString(36);
const SENHA = "selic123";

async function irParaSegundaEtapa(page: import("@playwright/test").Page) {
  await page.goto("/cadastro");
  await page.getByLabel("Matrícula", { exact: true }).fill("20241006904");
  await page.getByLabel("E-mail", { exact: true }).fill(`dados.${SUFIXO}@aluno.ifrj.edu.br`);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await page.getByLabel("Confirmar senha").fill(SENHA);
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("heading", { name: "Criar cadastro" })).toBeVisible();
  await expect(page.getByText("Segunda etapa: seus dados e o vínculo com o curso.")).toBeVisible();
}

function mensagem(page: import("@playwright/test").Page, id: string) {
  return page.locator(`#${id}`);
}

test.describe("máscaras e validação dos dados pessoais", () => {
  test.beforeEach(async ({ page }) => {
    await irParaSegundaEtapa(page);
  });

  test("formata os onze dígitos do celular e recusa letras", async ({ page }) => {
    const celular = page.getByLabel("Celular", { exact: true });

    await celular.pressSequentially("21987654321");

    await expect(celular).toHaveValue("(21) 98765-4321");

    await celular.pressSequentially("abc");

    await expect(celular).toHaveValue("(21) 98765-4321");
  });

  test("formata CPF, data, telefone e CEP enquanto digita", async ({ page }) => {
    await page.getByLabel("CPF", { exact: true }).pressSequentially("52998224725");
    await page.getByLabel("Data de nascimento").pressSequentially("12031998");
    await page.getByLabel("Telefone", { exact: true }).pressSequentially("2133334444");
    await page.getByLabel("CEP", { exact: true }).pressSequentially("23940000");

    await expect(page.getByLabel("CPF", { exact: true })).toHaveValue("529.982.247-25");
    await expect(page.getByLabel("Data de nascimento")).toHaveValue("12/03/1998");
    await expect(page.getByLabel("Telefone", { exact: true })).toHaveValue("(21) 3333-4444");
    await expect(page.getByLabel("CEP", { exact: true })).toHaveValue("23940-000");
  });

  test("recusa CPF inválido e CPF com dígitos repetidos ao sair do campo", async ({ page }) => {
    const cpf = page.getByLabel("CPF", { exact: true });

    await cpf.fill("529.982.247-26");
    await cpf.blur();

    await expect(mensagem(page, "cadastro-cpf-mensagem")).toHaveText("CPF inválido.");
    await expect(cpf).toHaveAttribute("aria-invalid", "true");

    await cpf.fill("111.111.111-11");
    await cpf.blur();

    await expect(mensagem(page, "cadastro-cpf-mensagem")).toHaveText("CPF inválido.");

    await cpf.fill("123.456.789-0");
    await cpf.blur();

    await expect(mensagem(page, "cadastro-cpf-mensagem")).toHaveText("O CPF deve ter 11 dígitos.");

    // O campo válido não deixa erro para trás.
    await cpf.fill("529.982.247-25");
    await cpf.blur();

    await expect(mensagem(page, "cadastro-cpf-mensagem")).toHaveCount(0);
    await expect(cpf).not.toHaveAttribute("aria-invalid", "true");
  });

  test("recusa celular sem nove dígitos e telefone sem DDD", async ({ page }) => {
    const celular = page.getByLabel("Celular", { exact: true });

    await celular.fill("(21) 9876-5432");
    await celular.blur();

    await expect(mensagem(page, "cadastro-celular-mensagem")).toHaveText(
      "Informe DDD e número com 9 dígitos, começando por 9.",
    );

    const telefone = page.getByLabel("Telefone", { exact: true });

    await telefone.fill("3333-4444");
    await telefone.blur();

    await expect(mensagem(page, "cadastro-telefone-mensagem")).toHaveText(
      "Informe DDD e número com 8 dígitos.",
    );
  });

  test("recusa CEP incompleto e data inexistente ao sair do campo", async ({ page }) => {
    const cep = page.getByLabel("CEP", { exact: true });

    await cep.fill("2394-000");
    await cep.blur();

    await expect(mensagem(page, "cadastro-cep-mensagem")).toHaveText("O CEP deve ter 8 dígitos.");

    const nascimento = page.getByLabel("Data de nascimento");

    await nascimento.fill("31/02/2005");
    await nascimento.blur();

    await expect(mensagem(page, "cadastro-nascimento-mensagem")).toHaveText("Data inválida.");
  });

  test("preenche o endereço pelo CEP e mantém a correção do aluno", async ({ page }) => {
    await page.getByLabel("CEP", { exact: true }).fill("23935000");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page.getByLabel("Endereço")).toHaveValue("Avenida Brasil");
    await expect(page.getByLabel("Bairro")).toHaveValue("Centro");
    await expect(page.getByLabel("Cidade")).toHaveValue("Volta Redonda");
    await expect(page.getByLabel("UF")).toHaveValue("RJ");

    // O campo continua editável e a alteração do aluno não é desfeita (6.4).
    await page.getByLabel("Endereço").fill("Avenida Brasil, fundos");

    await expect(page.getByLabel("Endereço")).toHaveValue("Avenida Brasil, fundos");
  });

  test("mantém o endereço em branco quando o CEP não existe", async ({ page }) => {
    await page.getByLabel("CEP", { exact: true }).fill("99999-999");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page.getByRole("status")).toHaveText(
      "CEP não encontrado. Confira o número ou preencha o endereço.",
    );

    await expect(page.getByLabel("Endereço")).toHaveValue("");
    await expect(page.getByLabel("Bairro")).toHaveValue("");
    await expect(page.getByLabel("Cidade")).toHaveValue("");
    // A UF continua com o valor padrão, sem virada do CEP não encontrado.
    await expect(page.getByLabel("UF")).toHaveValue("RJ");

    // O aluno preenche à mão e o envio segue valendo.
    await page.getByLabel("Endereço").fill("Rua Sem Casa");
    await page.getByLabel("Número").fill("7");
    await page.getByLabel("Bairro").fill("Jardim");
    await page.getByLabel("Cidade").fill("Pinheiral");
    await page.getByLabel("UF").fill("SP");
  });
});
