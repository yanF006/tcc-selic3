import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Ciclo de vida de um servidor Next dedicado a um cenário de E2E.
 *
 * Os E2E de reinício literal (5.5 e 7.2) encerram e religam o processo do
 * servidor sem recarregar o navegador. Isso exige o modo produção: o cliente
 * do modo dev recarrega a página ao detectar o reinício do servidor e não
 * processa a resposta de uma server action submetida a outro processo. O
 * servidor dedicado usa um build de produção em diretório exclusivo
 * (`SELIC_DIST_DIR`), servido por `next start` como um redeploy da mesma
 * versão, e pode ser parado e iniciado novamente na mesma porta.
 */

const cliNext = join(raiz(), "node_modules", "next", "dist", "bin", "next");
const DIST_DIR_SERVIDOR = ".next-e2e-producao";

/**
 * O Playwright transpila os arquivos TS para CJS, então não há `import.meta`;
 * a raiz é descoberta subindo a partir do diretório de execução até o
 * package.json do projeto.
 */
function raiz(): string {
  let atual = process.cwd();
  for (;;) {
    if (existsSync(join(atual, "package.json"))) return atual;
    const pai = dirname(atual);
    if (pai === atual) break;
    atual = pai;
  }
  throw new Error(`raiz do projeto selic não encontrada a partir de ${process.cwd()}`);
}

export interface ServidorDedicado {
  parar(): Promise<void>;
}

export interface OpcoesServidorDedicado {
  porta: number;
  ambiente?: Record<string, string>;
}

function dormir(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

class ErroServidor extends Error {}

/** Mantém as últimas linhas de saída para diagnosticar falhas de inicialização. */
function coletarSaida(processo: ChildProcess): string[] {
  const linhas: string[] = [];
  for (const fluxo of [processo.stdout, processo.stderr]) {
    if (!fluxo) continue;
    fluxo.setEncoding("utf8");
    fluxo.on("data", (pedaco: string) => {
      for (const linha of pedaco.split(/\r?\n/)) {
        if (!linha.trim()) continue;
        linhas.push(linha);
        if (linhas.length > 80) linhas.shift();
      }
    });
  }
  return linhas;
}

async function esperarHttp(porta: number, processo: ChildProcess, linhas: string[]): Promise<void> {
  const inicio = Date.now();
  for (;;) {
    if (processo.exitCode !== null) {
      throw new ErroServidor(
        `o servidor de produção encerrou (saída ${processo.exitCode}) antes de responder.\n${linhas.join("\n")}`,
      );
    }
    try {
      await fetch(`http://127.0.0.1:${porta}/`, {
        redirect: "manual",
        signal: AbortSignal.timeout(2_000),
      });
      return;
    } catch {
      // Ainda não respondeu; tenta de novo.
    }
    if (Date.now() - inicio > 120_000) {
      throw new ErroServidor(
        `o servidor de produção não respondeu na porta ${porta} em 120 s.\n${linhas.join("\n")}`,
      );
    }
    await dormir(250);
  }
}

async function esperarPortaFechada(porta: number, processo: ChildProcess): Promise<void> {
  const inicio = Date.now();
  for (;;) {
    try {
      await fetch(`http://127.0.0.1:${porta}/`, {
        redirect: "manual",
        signal: AbortSignal.timeout(2_000),
      });
    } catch {
      return;
    }
    if (processo.exitCode !== null) return;
    if (Date.now() - inicio > 30_000) {
      throw new ErroServidor(`a porta ${porta} continuou ocupada por 30 s após encerrar o servidor.`);
    }
    await dormir(250);
  }
}

/** Encerra o processo do servidor e toda a sua árvore de filhos. */
function encerrar(processo: ChildProcess): void {
  if (processo.exitCode !== null || processo.signalCode !== null) return;
  if (process.platform === "win32") {
    if (processo.pid) {
      spawnSync("taskkill", ["/pid", String(processo.pid), "/T", "/F"], { stdio: "ignore" });
    }
  } else {
    try {
      processo.kill("SIGTERM");
    } catch {
      // Já encerrou.
    }
  }
}

function ambienteServidor(ambiente?: Record<string, string>): NodeJS.ProcessEnv {
  return {
    ...process.env,
    // Diretório de build exclusivo dos servidores dedicados: não disputa o
    // `.next` usado pela suíte nem o de desenvolvimento.
    SELIC_DIST_DIR: DIST_DIR_SERVIDOR,
    // O padrão dos E2E é o modo simulado; cenários persistentes sobrepõem
    // estes valores com o próprio ambiente.
    SELIC_PERSISTENCIA: "simulado",
    DATABASE_URL: "",
    ...ambiente,
  };
}

/**
 * Builda a versão de produção usada pelos servidores dedicados, com o
 * ambiente do cenário (o build também pré-renderiza páginas). Chamar antes do
 * primeiro início do cenário; o build é incremental no diretório próprio.
 */
export async function construirServidorDedicado(ambiente?: Record<string, string>) {
  const resultado = spawnSync(process.execPath, [cliNext, "build"], {
    cwd: raiz(),
    env: ambienteServidor(ambiente),
    encoding: "utf8",
    timeout: 600_000,
  });
  if (resultado.error || resultado.status !== 0) {
    throw new ErroServidor(
      `o build de produção do servidor dedicado falhou (${resultado.status ?? "sem saída"}).\n` +
        `${resultado.stdout ?? ""}${resultado.stderr ?? ""}`,
    );
  }
}

export async function iniciarServidorDedicado({
  porta,
  ambiente,
}: OpcoesServidorDedicado): Promise<ServidorDedicado> {
  if (!existsSync(cliNext)) {
    throw new ErroServidor(`CLI do Next não encontrado em ${cliNext}.`);
  }
  if (!existsSync(join(raiz(), DIST_DIR_SERVIDOR, "BUILD_ID"))) {
    await construirServidorDedicado(ambiente);
  }

  const processo = spawn(process.execPath, [cliNext, "start", "--port", String(porta)], {
    cwd: raiz(),
    env: ambienteServidor(ambiente),
    stdio: ["ignore", "pipe", "pipe"],
  });

  const linhas = coletarSaida(processo);

  try {
    await esperarHttp(porta, processo, linhas);
  } catch (erro) {
    encerrar(processo);
    throw erro;
  }

  return {
    async parar() {
      encerrar(processo);
      const encerrado = new Promise<void>((resolver) => {
        if (processo.exitCode !== null) {
          resolver();
          return;
        }
        processo.once("exit", () => resolver());
        setTimeout(resolver, 10_000);
      });
      await encerrado;
      await esperarPortaFechada(porta, processo);
    },
  };
}
