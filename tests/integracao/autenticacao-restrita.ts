import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";

import type { Prisma, PrismaClient } from "./generated/auth/client";

export const SEGREDO_TESTE = "segredo-exclusivo-dos-testes-de-integracao-selic";

export type ClienteDeAutenticacao = PrismaClient | Prisma.TransactionClient;

/**
 * Instância restrita ao signup: recebe o cliente (normal ou transacional) já
 * aberto pelo chamador, não abre transação própria e não registra hooks de
 * e-mail, sessão ou efeitos externos.
 */
export function criarAutenticacaoRestrita(cliente: ClienteDeAutenticacao) {
  return betterAuth({
    baseURL: "http://localhost:3000",
    secret: SEGREDO_TESTE,
    database: prismaAdapter(cliente as unknown as PrismaClient, {
      provider: "mysql",
      transaction: false,
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
}
