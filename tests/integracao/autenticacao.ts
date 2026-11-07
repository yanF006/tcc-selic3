import { prismaAdapter } from "@better-auth/prisma-adapter";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { betterAuth } from "better-auth";

import { PrismaClient } from "../../src/generated/prisma/client";
import { carregarUrlTeste, validarUrlTeste } from "./configuracao";

const configuracao = validarUrlTeste(carregarUrlTeste());

/**
 * Instância criada apenas para o spike de autenticação no banco isolado.
 * A versão de produção será montada sobre o cliente único da aplicação.
 */
export const prismaDeTeste = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: configuracao.host,
    port: configuracao.porta,
    user: configuracao.usuario,
    password: configuracao.senha,
    database: configuracao.banco,
    connectionLimit: 1,
    ssl: { rejectUnauthorized: false },
  }),
});

export const auth = betterAuth({
  baseURL: "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET ?? "segredo-exclusivo-dos-testes-de-integracao",
  database: prismaAdapter(prismaDeTeste, {
    provider: "mysql",
    transaction: true,
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
});
