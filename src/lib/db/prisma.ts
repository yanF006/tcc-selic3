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

/** Opções do pool do driver `mariadb`, derivadas de `DATABASE_URL`. */
function opcoesDeConexao() {
  const url = new URL(process.env.DATABASE_URL!);

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, "")) || undefined,
    connectionLimit: 5,
    // A rede até o Aiven pode levar vários segundos só no handshake; os padrões
    // do `mariadb` (connect/acquire de 10 s) faziam a primeira consulta estourar.
    connectTimeout: 60_000,
    acquireTimeout: 60_000,
    initializationTimeout: 60_000,
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
