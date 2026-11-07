import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, describe, expect, it } from "vitest";

import { carregarUrlTeste, validarUrlTeste } from "./configuracao";
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

const criados: string[] = [];

afterAll(async () => {
  for (const id of criados) {
    await prisma.user.delete({ where: { id } }).catch(() => undefined);
  }
  await prisma.$disconnect();
});

describe("schema de autenticação no banco isolado", () => {
  it("conecta e grava usuário com credencial no schema gerado", async () => {
    const id = crypto.randomUUID();
    const email = `teste-${id}@teste.local`;
    criados.push(id);

    await prisma.user.create({
      data: { id, name: "Conta de teste", email, emailVerified: false },
    });
    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: "hash-de-teste",
      },
    });

    const encontrado = await prisma.user.findUnique({
      where: { id },
      include: { accounts: true },
    });

    expect(encontrado?.email).toBe(email);
    expect(encontrado?.accounts).toHaveLength(1);

    await prisma.user.delete({ where: { id } });
    criados.pop();

    expect(await prisma.account.findMany({ where: { userId: id } })).toEqual([]);
  });
});
