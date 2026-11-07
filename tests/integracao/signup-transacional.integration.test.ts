import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, describe, expect, it } from "vitest";

import { carregarUrlTeste, validarUrlTeste } from "./configuracao";
import { criarAutenticacaoRestrita } from "./autenticacao-restrita";
import { PrismaClient } from "./generated/auth/client";

const configuracao = validarUrlTeste(carregarUrlTeste());

const prisma = new PrismaClient({
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

const emailsCriados: string[] = [];

afterAll(async () => {
  if (emailsCriados.length > 0) {
    await prisma.user.deleteMany({ where: { email: { in: emailsCriados } } });
  }
  await prisma.$executeRawUnsafe("DROP TABLE IF EXISTS probe_dominio").catch(() => undefined);
  await prisma.$disconnect();
});

function emailNovo() {
  const email = `signup-${crypto.randomUUID()}@teste.local`;
  emailsCriados.push(email);
  return email;
}

function bloquearTransacaoInterna<T extends object>(cliente: T): T {
  return new Proxy(cliente, {
    get(alvo, propriedade, receptor) {
      if (propriedade === "$transaction") {
        throw new Error("a instância restrita tentou abrir uma transação interna");
      }
      return Reflect.get(alvo, propriedade, receptor);
    },
  });
}

describe("signup padrão na transação do domínio", () => {
  it("cria usuário e credencial com o TransactionClient, sem sessão", async () => {
    const email = emailNovo();
    const senha = "SenhaForte123!";
    let idCriado = "";

    await prisma.$transaction(
      async (tx) => {
        const auth = criarAutenticacaoRestrita(bloquearTransacaoInterna(tx));
        const resultado = await auth.api.signUpEmail({
          body: { name: "Aluno de Teste", email, password: senha },
        });

        idCriado = resultado.user.id;
        expect(resultado.user.email).toBe(email);
      },
      { timeout: 20_000 },
    );

    const usuario = await prisma.user.findUnique({
      where: { email },
      include: { accounts: true, sessions: true },
    });

    expect(usuario?.id).toBe(idCriado);
    expect(usuario?.accounts).toHaveLength(1);
    expect(usuario?.accounts[0]?.providerId).toBe("credential");
    expect(usuario?.accounts[0]?.password).toBeTruthy();
    expect(usuario?.accounts[0]?.password).not.toBe(senha);
    expect(usuario?.sessions).toHaveLength(0);
  });

  it("desfaz usuário e credencial quando uma gravação de domínio falha", async () => {
    const email = emailNovo();
    const senha = "SenhaForte123!";

    await prisma.$executeRawUnsafe(
      "CREATE TABLE IF NOT EXISTS probe_dominio (id VARCHAR(64) PRIMARY KEY, chave VARCHAR(64) NOT NULL UNIQUE)",
    );
    await prisma.$executeRawUnsafe("DELETE FROM probe_dominio");

    let falhou = false;

    try {
      await prisma.$transaction(
        async (tx) => {
          const auth = criarAutenticacaoRestrita(tx);
          await auth.api.signUpEmail({
            body: { name: "Aluno de Teste", email, password: senha },
          });

          await tx.$executeRawUnsafe(
            "INSERT INTO probe_dominio (id, chave) VALUES (?, ?)",
            crypto.randomUUID(),
            "mesma-chave",
          );
          await tx.$executeRawUnsafe(
            "INSERT INTO probe_dominio (id, chave) VALUES (?, ?)",
            crypto.randomUUID(),
            "mesma-chave",
          );
        },
        { timeout: 20_000 },
      );
    } catch {
      falhou = true;
    }

    expect(falhou).toBe(true);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    expect(await prisma.account.count({ where: { user: { email } } })).toBe(0);

    const [dominio] = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      "SELECT COUNT(*) AS total FROM probe_dominio",
    );
    expect(Number(dominio.total)).toBe(0);
  });
});
