import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";

import { SEGREDO_TESTE } from "./autenticacao-restrita";
import type { PrismaClient } from "./generated/auth/client";

/**
 * Em MySQL, duas transações concorrentes que leem e apagam a mesma linha de
 * verificação podem receber o registro antigo do `delete` do Prisma, mesmo com
 * zero linhas afetadas. O isolamento serializável faz a segunda transação
 * falhar por conflito de escrita, preservando o resgate único do token.
 */
function comIsolamentoSerializavel(cliente: PrismaClient): PrismaClient {
  return new Proxy(cliente, {
    get(alvo, propriedade, receptor) {
      if (propriedade === "$transaction") {
        return (fn: unknown, opcoes?: Record<string, unknown>) =>
          alvo.$transaction(
            fn as never,
            {
              ...opcoes,
              isolationLevel: "Serializable",
            } as never,
          );
      }
      return Reflect.get(alvo, propriedade, receptor);
    },
  });
}

/**
 * Instância de reset com transações reais no Prisma. O token padrão do Better
 * Auth é capturado no callback de e-mail, sem criar mecanismo próprio.
 */
export function criarAutenticacaoParaReset(cliente: PrismaClient) {
  let tokenAtual = "";

  const auth = betterAuth({
    baseURL: "http://localhost:3000",
    secret: SEGREDO_TESTE,
    database: prismaAdapter(comIsolamentoSerializavel(cliente), {
      provider: "mysql",
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ token }) => {
        tokenAtual = token;
      },
    },
    advanced: {
      database: {
        generateId: "uuid",
      },
    },
  });

  return {
    auth,
    tokenAtual: () => tokenAtual,
  };
}
