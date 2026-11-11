#!/usr/bin/env node
// Prepara o ambiente de testes de integração do SELic e executa a suíte.
//
// Windows: sobe a instância MySQL portátil via scripts/banco-teste.ps1
// (TCP em loopback, sem serviço do sistema). Demais sistemas: usa
// scripts/banco-teste.sh (socket local). Os schemas de autenticação e da
// aplicação são preparados pelos mesmos scripts sh; no Windows eles rodam
// pelo sh.exe do Git for Windows, invocado diretamente (sem shell cmd).
// A suíte sempre lê a URL exclusiva de testes gravada em credentials.env
// e nunca a DATABASE_URL da aplicação.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

function executar(comando, argumentos, opcoes = {}) {
  const resultado = spawnSync(comando, argumentos, {
    cwd: raiz,
    stdio: "inherit",
    ...opcoes,
  });
  if (resultado.error) {
    throw resultado.error;
  }
  if (resultado.status !== 0) {
    process.exit(resultado.status ?? 1);
  }
}

/** Localiza o sh.exe do Git for Windows a partir do git.exe no PATH. */
function localizarSh() {
  if (process.platform !== "win32") {
    return { comando: "sh", argumentos: [] };
  }

  const onde = spawnSync("where", ["git"], { encoding: "utf8", shell: true });
  if (onde.status === 0) {
    const git = onde.stdout.trim().split(/\r?\n/)[0];
    if (git) {
      const raizGit = dirname(dirname(git));
      const candidato = join(raizGit, "bin", "sh.exe");
      if (existsSync(candidato)) {
        return { comando: candidato, argumentos: [] };
      }
    }
  }

  throw new Error(
    "sh.exe do Git for Windows não encontrado. Instale o Git for Windows (com git no PATH) para preparar os schemas de integração.",
  );
}

const sh = localizarSh();

if (process.platform === "win32") {
  executar("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    "scripts/banco-teste.ps1",
    "iniciar",
  ]);
} else {
  executar("sh", ["scripts/banco-teste.sh", "iniciar"]);
}

executar(sh.comando, [...sh.argumentos, "scripts/preparar-auth-teste.sh"]);
executar(sh.comando, [...sh.argumentos, "scripts/preparar-app-teste.sh"]);
executar("npx", ["vitest", "run", "--config", "vitest.integration.config.mts"], {
  shell: process.platform === "win32",
});
