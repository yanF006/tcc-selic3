import "server-only";

import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { bancoConfigurado, carregarCliente } from "@/lib/db/prisma";
import { esquemaPapel } from "@/lib/domain/schemas";
import type { DadosPessoais } from "@/lib/domain/types";
import {
  agendarConfirmacaoDeEmail,
  agendarLinkRecuperacao,
  type EntregaAutenticacao,
} from "./email";
import { carregarConfiguracaoAutenticacao, type ConfiguracaoAutenticacao } from "./configuracao";

function opcoesComuns(configuracao: ConfiguracaoAutenticacao) {
  return {
    appName: "SELic",
    baseURL: configuracao.origem,
    basePath: "/api/auth",
    secret: configuracao.segredo,
    trustedOrigins: [configuracao.origem],
    user: {
      modelName: "usuario",
      fields: {
        name: "nome",
        emailVerified: "emailVerificado",
        image: "imagem",
        createdAt: "criadoEm",
        updatedAt: "atualizadoEm",
      },
    },
    session: {
      modelName: "authSession",
      expiresIn: 60 * 60 * 8,
      cookieCache: { enabled: false },
    },
    account: { modelName: "authAccount" },
    verification: { modelName: "authVerification" },
    advanced: {
      // O provedor relaxa a origem por padrão em NODE_ENV=test; os mesmos
      // controles precisam valer também na integração.
      disableOriginCheck: false,
      disableCSRFCheck: false,
      cookiePrefix: "selic-auth",
      useSecureCookies: configuracao.origem.startsWith("https://"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
      database: { generateId: "uuid" },
    },
  } satisfies BetterAuthOptions;
}

/**
 * Mantém o e-mail do JSON de dados pessoais alinhado à identidade do provedor.
 * A confirmação do titular altera `usuarios.email`; o perfil é apenas um espelho
 * de leitura, nunca uma segunda fonte editável de e-mail.
 */
async function sincronizarEmailDoPerfil(
  cliente: PrismaClient,
  usuario: { id: string; email: string },
) {
  const registro = await cliente.usuario.findUnique({
    where: { id: usuario.id },
    select: { dadosPessoais: true },
  });
  const dados = registro?.dadosPessoais as DadosPessoais | null | undefined;

  if (!dados || typeof dados !== "object" || dados.email === usuario.email) return;

  await cliente.usuario.update({
    where: { id: usuario.id },
    data: {
      dadosPessoais: { ...dados, email: usuario.email } as unknown as Prisma.InputJsonValue,
    },
  });
}

/** Instância normal: os campos de domínio não são entradas genéricas do provedor. */
export function criarAutenticacao(
  cliente: PrismaClient,
  configuracao: ConfiguracaoAutenticacao,
  entrega: EntregaAutenticacao = {},
) {
  // O adapter usa este proxy somente para suas transações. Serializable evita
  // que dois resgates concorrentes consumam a mesma verificação no MySQL.
  const clienteAuth = new Proxy(cliente, {
    get(alvo, propriedade, receptor) {
      if (propriedade === "$transaction") {
        return <T>(operacao: (tx: Prisma.TransactionClient) => Promise<T>) =>
          alvo.$transaction(operacao, {
            isolationLevel: "Serializable",
            maxWait: 12_000,
            timeout: 20_000,
          });
      }
      return Reflect.get(alvo, propriedade, receptor);
    },
  });
  const comuns = opcoesComuns(configuracao);
  return betterAuth({
    ...comuns,
    user: {
      ...comuns.user,
      changeEmail: {
        enabled: true,
        // Titular com e-mail já verificado confirma a troca a partir do
        // endereço antigo; o novo endereço só passa a valer após o clique.
        sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
          agendarConfirmacaoDeEmail(user.email, url, newEmail, entrega);
        },
      },
    },
    emailVerification: {
      // Contas ainda não verificadas confirmam o novo endereço diretamente
      // nele, mantendo o mesmo fluxo padrão do provedor.
      sendVerificationEmail: async ({ user, url }) => {
        agendarConfirmacaoDeEmail(user.email, url, user.email, entrega);
      },
    },
    database: prismaAdapter(clienteAuth, { provider: "mysql", transaction: true }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      autoSignIn: false,
      minPasswordLength: 8,
      maxPasswordLength: 72,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        agendarLinkRecuperacao(user.email, url, entrega);
      },
    },
    disabledPaths: [
      "/sign-up/email",
      "/update-user",
      "/delete-user",
      "/delete-user/callback",
    ],
    databaseHooks: {
      user: {
        update: {
          after: async (usuario) => {
            await sincronizarEmailDoPerfil(cliente, usuario);
          },
        },
      },
      session: {
        create: {
          // No login por senha, o provedor chama este hook somente depois de
          // verificar a credencial. A situação não é exposta por consulta de e-mail.
          before: async (sessao) => {
            const usuario = await cliente.usuario.findUnique({
              where: { id: sessao.userId },
              select: { situacao: true, papel: true },
            });
            if (usuario?.situacao === "pendente") {
              throw new APIError("FORBIDDEN", {
                code: "CONTA_PENDENTE",
                message: "Cadastro pendente de autorização.",
              });
            }
            if (usuario?.situacao !== "ativo" || !esquemaPapel.safeParse(usuario.papel).success) {
              throw new APIError("UNAUTHORIZED", {
                code: "INVALID_EMAIL_OR_PASSWORD",
                message: "E-mail ou senha inválidos.",
              });
            }
            return { data: sessao };
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

/**
 * Somente o caso de uso de cadastro recebe esta instância, dentro da transação
 * do domínio. Nenhum handler HTTP a expõe; sem cookies, hooks ou efeitos externos.
 */
export function criarAutenticacaoCadastro(
  transacao: Prisma.TransactionClient,
  configuracao: ConfiguracaoAutenticacao,
) {
  return betterAuth({
    ...opcoesComuns(configuracao),
    database: prismaAdapter(transacao, { provider: "mysql", transaction: false }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      minPasswordLength: 8,
      maxPasswordLength: 72,
    },
  });
}

/** Mantém o pool compartilhado e permite recuperar seu cliente após descarte. */
export async function obterAutenticacao() {
  if (!bancoConfigurado()) throw new Error("Autenticação persistente exige banco configurado.");
  const configuracao = carregarConfiguracaoAutenticacao();
  const { prisma } = await carregarCliente();
  return criarAutenticacao(prisma, configuracao);
}
