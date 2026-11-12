import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Cliente das ferramentas operacionais (carga inicial e seed de demonstração).
 * Usa a mesma DATABASE_URL da aplicação, com TLS validado. Retorna também o nome
 * do banco para as travas de destino de cada ferramenta.
 */
export function criarClienteOperacional(): { prisma: PrismaClient; banco: string } {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!url.hostname) throw new Error("DATABASE_URL ausente ou inválida.");
  const banco = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: banco || undefined,
    connectionLimit: 2,
    connectTimeout: 60_000,
    acquireTimeout: 60_000,
    initializationTimeout: 60_000,
    ssl: {
      rejectUnauthorized: true,
      ...(process.env.SELIC_DB_CA_CERT?.trim()
        ? { ca: process.env.SELIC_DB_CA_CERT.trim().replace(/\\n/g, "\n") }
        : {}),
    },
  });

  return { prisma: new PrismaClient({ adapter }), banco };
}
