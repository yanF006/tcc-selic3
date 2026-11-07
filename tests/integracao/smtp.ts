import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

export async function iniciarSmtpTeste() {
  const diretorio = await mkdtemp(join(tmpdir(), "selic-email-auth-"));
  const processo = spawn(
    process.execPath,
    [fileURLToPath(new URL("../../scripts/smtp-teste.mjs", import.meta.url))],
    {
      env: {
        ...process.env,
        SMTP_TEST_HOST: "127.0.0.1",
        SMTP_TEST_PORT: "0",
        SMTP_TEST_DIR: diretorio,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const linhas = createInterface({ input: processo.stdout });
  try {
    const porta = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Coletor SMTP não iniciou.")), 10_000);
      linhas.on("line", (linha) => {
        const evento = JSON.parse(linha);
        if (evento.pronto) {
          clearTimeout(timeout);
          resolve(evento.porta);
        }
      });
      processo.once("error", (erro) => {
        clearTimeout(timeout);
        reject(erro);
      });
      processo.once("exit", () => {
        clearTimeout(timeout);
        reject(new Error("Coletor SMTP encerrou."));
      });
    });
    return {
      porta,
      diretorio,
      async parar() {
        const encerrado = new Promise<void>((resolve) => processo.once("exit", () => resolve()));
        processo.kill("SIGTERM");
        await encerrado;
        linhas.close();
        await rm(diretorio, { recursive: true, force: true });
      },
    };
  } catch (erro) {
    processo.kill("SIGTERM");
    linhas.close();
    await rm(diretorio, { recursive: true, force: true });
    throw erro;
  }
}
