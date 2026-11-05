import { defineConfig, devices } from "@playwright/test";

const porta = process.env.PLAYWRIGHT_PORT ?? "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${porta}`;
const e2eBancoIndisponivel = Boolean(process.env.SELIC_E2E_BANCO_INDISPONIVEL);

export default defineConfig({
  testDir: "./e2e",
  // O cenário de banco inacessível exige um servidor com DATABASE_URL próprio;
  // fora do script dedicado ele não pode rodar junto da suíte de simulação.
  testIgnore: e2eBancoIndisponivel ? undefined : ["**/banco-indisponivel.spec.ts"],
  // O servidor de desenvolvimento compila cada rota na primeira visita.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: process.env.PLAYWRIGHT_SERVER_COMMAND ?? `npm run dev -- --port ${porta}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI && !process.env.PLAYWRIGHT_PORT,
        timeout: 120_000,
      },
});
