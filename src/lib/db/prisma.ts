import type * as ClienteGerado from "@/generated/prisma/client";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Cliente Prisma único do processo (Prisma 7, MySQL/Aiven).
 *
 * O Prisma 7 exige um driver adapter em vez do engine Rust. Aqui usamos
 * `@prisma/adapter-mariadb`, que fala MySQL/MariaDB, com TLS habilitado — o
 * Aiven exige conexão criptografada.
 *
 * Tudo é carregado de forma preguiçosa: o módulo do cliente gerado e o driver
 * só são importados na primeira chamada a `carregarCliente()`. Isso mantém os
 * testes unitários (que rodam sem banco) leves e evita abrir conexão no
 * carregamento do módulo.
 */

export type ModuloPrisma = typeof ClienteGerado;

export interface ClientePrisma {
  prisma: PrismaClient;
  /** Namespace `Prisma` do cliente gerado (valores especiais como `DbNull`). */
  Prisma: ModuloPrisma["Prisma"];
}

let cache: ClientePrisma | null = null;

/**
 * true quando há banco configurado e não estamos sob testes automatizados.
 *
 * Os testes unitários rodam em memória (fixtures); sem esta guarda, um `.env`
 * local apontaria os testes para o Aiven. Em produção e desenvolvimento a
 * variável presente liga a persistência.
 */
export function bancoConfigurado(): boolean {
  if (process.env.NODE_ENV === "test") return false;

  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Limites padrão do pool, em milissegundos. Ficam na faixa de 8–12 s para que
 * uma indisponibilidade apareça durante o carregamento, sem transformar um
 * cold start lento em espera indefinida. `initializationTimeout` é menor que
 * `acquireTimeout` para a causa real (conexão/TLS) aparecer primeiro.
 */
export const TIMEOUT_CONEXAO_PADRAO_MS = 10_000;
export const TIMEOUT_AQUISICAO_PADRAO_MS = 12_000;
export const TIMEOUT_INICIALIZACAO_PADRAO_MS = 8_000;

type Ambiente = Record<string, string | undefined>;

function inteiroDoAmbiente(
  ambiente: Ambiente,
  chave: string,
  padrao: number,
  minimo = 1_000,
): number {
  const bruto = ambiente[chave];
  const numero = bruto ? Number(bruto) : NaN;

  return Number.isFinite(numero) && numero > 0 ? Math.max(minimo, Math.trunc(numero)) : padrao;
}

/**
 * Opções do pool do driver `mariadb`, derivadas de `DATABASE_URL`.
 *
 * As variáveis abaixo permitem ajustar o diagnóstico sem recompilar o app:
 * `SELIC_DB_CONNECT_TIMEOUT_MS`, `SELIC_DB_ACQUIRE_TIMEOUT_MS` e
 * `SELIC_DB_INITIALIZATION_TIMEOUT_MS`.
 */
export function opcoesDeConexao(
  urlString = process.env.DATABASE_URL,
  ambiente: Ambiente = process.env,
) {
  if (!urlString?.trim()) throw new Error("DATABASE_URL não configurada.");

  const url = new URL(urlString);
  const acquireTimeout = inteiroDoAmbiente(
    ambiente,
    "SELIC_DB_ACQUIRE_TIMEOUT_MS",
    TIMEOUT_AQUISICAO_PADRAO_MS,
  );
  const initializationTimeout = Math.min(
    inteiroDoAmbiente(
      ambiente,
      "SELIC_DB_INITIALIZATION_TIMEOUT_MS",
      TIMEOUT_INICIALIZACAO_PADRAO_MS,
    ),
    acquireTimeout - 1,
  );

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, "")) || undefined,
    connectionLimit: 5,
    connectTimeout: inteiroDoAmbiente(
      ambiente,
      "SELIC_DB_CONNECT_TIMEOUT_MS",
      TIMEOUT_CONEXAO_PADRAO_MS,
    ),
    acquireTimeout,
    initializationTimeout,
    // O certificado gerenciado do Aiven não está na cadeia local; aceitar a
    // conexão TLS sem validar a cadeia mantém o transporte criptografado.
    ssl: { rejectUnauthorized: false },
  };
}

/** Carrega (uma vez) o cliente Prisma com o driver adapter do MySQL. */
export async function carregarCliente(): Promise<ClientePrisma> {
  if (cache) return cache;

  const [modulo, { PrismaMariaDb }] = await Promise.all([
    import("@/generated/prisma/client"),
    import("@prisma/adapter-mariadb"),
  ]);

  const adapter = new PrismaMariaDb(opcoesDeConexao());
  const prisma = new modulo.PrismaClient({ adapter });

  cache = { prisma, Prisma: modulo.Prisma };

  return cache;
}

/**
 * Esquece o cliente em cache depois de uma falha de conexão. A próxima leitura
 * cria um adapter/pool novo, em vez de insistir em um pool que pode ter ficado
 * sem conexões utilizáveis. A desconexão é best-effort para não atrasar o erro.
 */
export function descartarCliente(): void {
  const atual = cache;

  cache = null;

  if (atual) {
    void atual.prisma.$disconnect().catch(() => undefined);
  }
}
