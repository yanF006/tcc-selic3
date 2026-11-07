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
  await prisma
    .$executeRawUnsafe("DROP TABLE IF EXISTS probe_dominio_usuario")
    .catch(() => undefined);
  await prisma.$disconnect();
});

describe("signup com e-mail já existente", () => {
  it("responde de forma sintética sem alterar a conta, a credencial ou criar domínio", async () => {
    const email = `duplicado-${crypto.randomUUID()}@teste.local`;
    emailsCriados.push(email);
    const senhaOriginal = "SenhaOriginal123!";
    let idOriginal = "";

    await prisma.$transaction(
      async (tx) => {
        const auth = criarAutenticacaoRestrita(tx);
        const resultado = await auth.api.signUpEmail({
          body: { name: "Conta Original", email, password: senhaOriginal },
        });
        idOriginal = resultado.user.id;
      },
      { timeout: 20_000 },
    );

    const antes = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { accounts: true },
    });
    const credencialAntes = antes.accounts[0]?.password;

    expect(antes.name).toBe("Conta Original");
    expect(antes.accounts).toHaveLength(1);

    let idSintetico = "";
    let token: string | null | undefined;

    await prisma.$transaction(
      async (tx) => {
        const auth = criarAutenticacaoRestrita(tx);
        const resultado = await auth.api.signUpEmail({
          body: { name: "Tentativa Duplicada", email, password: "OutraSenha123!" },
        });

        idSintetico = resultado.user.id;
        token = resultado.token;
        expect(resultado.user.email).toBe(email);
      },
      { timeout: 20_000 },
    );

    expect(token).toBeNull();
    expect(idSintetico).not.toBe(idOriginal);
    expect(await prisma.user.findUnique({ where: { id: idSintetico } })).toBeNull();

    const depois = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { accounts: true, sessions: true },
    });

    expect(depois.id).toBe(idOriginal);
    expect(depois.name).toBe("Conta Original");
    expect(depois.updatedAt.getTime()).toBe(antes.updatedAt.getTime());
    expect(depois.accounts).toHaveLength(1);
    expect(depois.accounts[0]?.password).toBe(credencialAntes);
    expect(depois.sessions).toHaveLength(0);

    await prisma.$executeRawUnsafe("DROP TABLE IF EXISTS probe_dominio_usuario");
    await prisma.$executeRawUnsafe(
      "CREATE TABLE probe_dominio_usuario (id VARCHAR(191) PRIMARY KEY, usuario_id VARCHAR(191) NOT NULL, CONSTRAINT fk_probe_usuario FOREIGN KEY (usuario_id) REFERENCES `user`(id))",
    );

    let recusouVinculo = false;
    try {
      await prisma.$executeRawUnsafe(
        "INSERT INTO probe_dominio_usuario (id, usuario_id) VALUES (?, ?)",
        crypto.randomUUID(),
        idSintetico,
      );
    } catch {
      recusouVinculo = true;
    }

    expect(recusouVinculo).toBe(true);
    const [dominio] = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      "SELECT COUNT(*) AS total FROM probe_dominio_usuario",
    );
    expect(Number(dominio.total)).toBe(0);
  });
});
