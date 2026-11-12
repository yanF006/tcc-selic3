import { readFileSync } from "node:fs";
import { createServer, connect, type Server, type Socket } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BancoIndisponivelError } from "@/lib/db/erros";
import { descartarCliente } from "@/lib/db/prisma";
import { listarUsuarios } from "@/lib/services/administracao";
import * as store from "@/lib/services/store";
import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";

/**
 * Falha e recuperação no mesmo PID (14.2). Um proxy TCP local fica entre a
 * aplicação e o MySQL de teste: derrubá-lo simula a queda da rede ou do banco, e
 * subi-lo de novo na mesma porta simula o retorno. A URL não muda e o processo
 * não reinicia. Em nenhum momento o simulador pode responder.
 */

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base = process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");

function criarProxy(porta: number, destino: number) {
  let servidor: Server | null = null;
  const sockets = new Set<Socket>();

  return {
    async subir(): Promise<void> {
      servidor = createServer((cliente) => {
        const alvo = connect(destino, "127.0.0.1");
        sockets.add(cliente);
        sockets.add(alvo);
        cliente.pipe(alvo);
        alvo.pipe(cliente);
        const encerrar = () => {
          cliente.destroy();
          alvo.destroy();
          sockets.delete(cliente);
          sockets.delete(alvo);
        };
        cliente.on("error", encerrar);
        alvo.on("error", encerrar);
        cliente.on("close", encerrar);
        alvo.on("close", encerrar);
      });
      await new Promise<void>((resolver, rejeitar) => {
        servidor!.once("error", rejeitar);
        servidor!.listen(porta, "127.0.0.1", () => resolver());
      });
    },
    async derrubar(): Promise<void> {
      for (const socket of sockets) socket.destroy();
      sockets.clear();
      const atual = servidor;
      servidor = null;
      if (atual) await new Promise<void>((resolver) => atual.close(() => resolver()));
    },
  };
}

async function portaLivre(): Promise<number> {
  return new Promise((resolver, rejeitar) => {
    const teste = createServer();
    teste.once("error", rejeitar);
    teste.listen(0, "127.0.0.1", () => {
      const porta = (teste.address() as { port: number }).port;
      teste.close(() => resolver(porta));
    });
  });
}

const proxyPorta = await portaLivre();
const proxy = criarProxy(proxyPorta, configuracao.porta);
const urlPelaProxy = (() => {
  const url = new URL(configuracao.url);
  url.port = String(proxyPorta);
  return url.toString();
})();

beforeAll(async () => {
  vi.stubEnv("SELIC_PERSISTENCIA", "persistente");
  vi.stubEnv("SELIC_DB_CA_CERT", ca);
  vi.stubEnv("SELIC_DB_CONNECT_TIMEOUT_MS", "2000");
  vi.stubEnv("SELIC_DB_ACQUIRE_TIMEOUT_MS", "2000");
  vi.stubEnv("DATABASE_URL", urlPelaProxy);
  vi.spyOn(store, "obterEstado").mockImplementation(() => {
    throw new Error("Simulador consultado durante a falha do banco.");
  });
  descartarCliente();
  await proxy.subir();
});

afterAll(async () => {
  vi.restoreAllMocks();
  await proxy.derrubar();
  descartarCliente();
  vi.unstubAllEnvs();
});

describe("recuperação no mesmo processo (14.2)", () => {
  it("indisponibiliza sem fallback quando a conexão cai e volta a ler sem reiniciar", async () => {
    // Conexão saudável pela proxy; o pool se estabiliza antes da queda.
    expect((await listarUsuarios({ tamanho: 5 })).itens.length).toBeGreaterThanOrEqual(0);
    await new Promise((resolver) => setTimeout(resolver, 300));

    // Queda: a leitura devolve indisponibilidade, não dados simulados.
    await proxy.derrubar();
    await expect(listarUsuarios({ tamanho: 5 })).rejects.toBeInstanceOf(BancoIndisponivelError);
    await new Promise((resolver) => setTimeout(resolver, 300));

    // Retorno na mesma porta, no mesmo processo.
    await proxy.subir();
    const pagina = await listarUsuarios({ tamanho: 5 });
    expect(pagina.total).toBeGreaterThanOrEqual(0);
    expect(pagina.itens.length).toBeLessThanOrEqual(5);
  });
});
