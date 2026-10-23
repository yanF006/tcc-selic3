import { test as base, expect } from "@playwright/test";

/** Toda consulta de endereço dos E2E é controlada no navegador. */
export const test = base.extend<{ consultaCep: void }>({
  consultaCep: [
    async ({ page }, use) => {
      await page.route("**/api/enderecos/cep?*", async (rota) => {
        const cep = new URL(rota.request().url()).searchParams.get("cep")!;
        const endereco =
          cep === "23940000"
            ? { logradouro: "Rua das Acácias", bairro: "Centro", cidade: "Pinheiral", estado: "RJ" }
            : cep === "23935000"
              ? {
                  logradouro: "Avenida Brasil",
                  bairro: "Centro",
                  cidade: "Volta Redonda",
                  estado: "RJ",
                }
              : cep === "20040030"
                ? {
                    logradouro: "Rua consultada",
                    bairro: "Bairro consultado",
                    cidade: "Rio de Janeiro",
                    estado: "RJ",
                  }
                : null;
        await rota.fulfill({
          json: endereco
            ? { status: "encontrado", endereco: { cep, ...endereco } }
            : { status: "nao_encontrado" },
        });
      });
      await use();
    },
    { auto: true },
  ],
});
export { expect };
