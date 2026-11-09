import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, describe, expect, it } from "vitest";

import { carregarUrlTeste, validarUrlTeste } from "./configuracao";
import { criarAutenticacaoParaReset } from "./autenticacao-reset";
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
    connectionLimit: 3,
    ssl: { rejectUnauthorized: false },
  }),
});

const { auth, tokenAtual } = criarAutenticacaoParaReset(prisma);

const emailsCriados: string[] = [];
const verificacoesCriadas: string[] = [];

afterAll(async () => {
  if (emailsCriados.length > 0) {
    await prisma.user.deleteMany({ where: { email: { in: emailsCriados } } });
  }
  if (verificacoesCriadas.length > 0) {
    await prisma.verification.deleteMany({
      where: { identifier: { in: verificacoesCriadas } },
    });
  }
  await prisma.$disconnect();
});

function emailNovo(prefixo: string) {
  const email = `${prefixo}-${crypto.randomUUID()}@teste.local`;
  emailsCriados.push(email);
  return email;
}

async function criarContaComCredencial(email: string, senha: string) {
  let id = "";

  await prisma.$transaction(
    async (tx) => {
      const restrita = criarAutenticacaoRestrita(tx);
      const resultado = await restrita.api.signUpEmail({
        body: { name: "Conta de Reset", email, password: senha },
      });
      id = resultado.user.id;
    },
    { timeout: 20_000 },
  );

  return id;
}

async function solicitarToken(email: string) {
  await auth.api.requestPasswordReset({ body: { email } });
  const token = tokenAtual();
  verificacoesCriadas.push(`reset-password:${token}`);
  return token;
}

function criarAutenticacaoComFalhaDeEscrita() {
  let falhar = false;

  const cliente = prisma.$extends({
    query: {
      account: {
        updateMany({ args, query }) {
          if (falhar) throw new Error("falha simulada de escrita");
          return query(args);
        },
      },
    },
  });

  const { auth: authComFalha } = criarAutenticacaoParaReset(cliente as unknown as PrismaClient);

  return {
    auth: authComFalha,
    ativar: () => {
      falhar = true;
    },
    desativar: () => {
      falhar = false;
    },
  };
}

describe("reset de senha padrão com transações", () => {
  it("define a nova senha, consome o token e revoga as sessões", async () => {
    const email = emailNovo("reset-credential");
    const senhaAntiga = "SenhaAntiga123!";
    const senhaNova = "SenhaNova123!";

    const id = await criarContaComCredencial(email, senhaAntiga);
    const loginAntigo = await auth.api.signInEmail({
      body: { email, password: senhaAntiga },
    });
    expect(loginAntigo.user.id).toBe(id);

    const contaAntes = await prisma.account.findFirstOrThrow({
      where: { userId: id, providerId: "credential" },
    });
    expect(await prisma.session.count({ where: { userId: id } })).toBe(1);

    const token = await solicitarToken(email);
    const identificador = `reset-password:${token}`;
    expect(await prisma.verification.count({ where: { identifier: identificador } })).toBe(1);

    const resultado = await auth.api.resetPassword({
      body: { newPassword: senhaNova, token },
    });
    expect(resultado.status).toBe(true);

    const contaDepois = await prisma.account.findFirstOrThrow({
      where: { userId: id, providerId: "credential" },
    });
    expect(contaDepois.password).not.toBe(contaAntes.password);
    expect(await prisma.verification.count({ where: { identifier: identificador } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: id } })).toBe(0);

    await expect(
      auth.api.signInEmail({ body: { email, password: senhaAntiga } }),
    ).rejects.toBeTruthy();

    const loginNovo = await auth.api.signInEmail({
      body: { email, password: senhaNova },
    });
    expect(loginNovo.user.id).toBe(id);
    expect(loginNovo.token).toBeTruthy();

    await expect(
      auth.api.resetPassword({ body: { newPassword: "OutraSenha123!", token } }),
    ).rejects.toBeTruthy();
    expect(await prisma.verification.count({ where: { identifier: identificador } })).toBe(0);
  });

  it("estabelece a primeira senha quando não havia credencial", async () => {
    const email = emailNovo("reset-sem-credencial");
    const id = crypto.randomUUID();

    await prisma.user.create({
      data: { id, name: "Conta Sem Credencial", email, emailVerified: false },
    });
    expect(await prisma.account.count({ where: { userId: id } })).toBe(0);

    const token = await solicitarToken(email);
    const identificador = `reset-password:${token}`;

    const resultado = await auth.api.resetPassword({
      body: { newPassword: "PrimeiraSenha123!", token },
    });
    expect(resultado.status).toBe(true);

    const conta = await prisma.account.findFirstOrThrow({
      where: { userId: id, providerId: "credential" },
    });
    expect(conta.accountId).toBe(id);
    expect(conta.password).toBeTruthy();
    expect(await prisma.verification.count({ where: { identifier: identificador } })).toBe(0);

    const login = await auth.api.signInEmail({
      body: { email, password: "PrimeiraSenha123!" },
    });
    expect(login.user.id).toBe(id);
  });

  it("desfaz consumo, revogação e troca de senha quando a escrita falha", async () => {
    const email = emailNovo("reset-rollback");
    const senhaAntiga = "SenhaAntiga123!";
    const senhaNova = "SenhaNova123!";

    const id = await criarContaComCredencial(email, senhaAntiga);
    await auth.api.signInEmail({ body: { email, password: senhaAntiga } });

    const contaAntes = await prisma.account.findFirstOrThrow({
      where: { userId: id, providerId: "credential" },
    });
    const sessoesAntes = await prisma.session.count({ where: { userId: id } });
    const token = await solicitarToken(email);
    const identificador = `reset-password:${token}`;

    expect(sessoesAntes).toBe(1);

    const comFalha = criarAutenticacaoComFalhaDeEscrita();

    let falhou = false;
    comFalha.ativar();
    try {
      await comFalha.auth.api.resetPassword({
        body: { newPassword: senhaNova, token },
      });
    } catch {
      falhou = true;
    } finally {
      comFalha.desativar();
    }

    expect(falhou).toBe(true);
    expect(await prisma.verification.count({ where: { identifier: identificador } })).toBe(1);

    const contaAposFalha = await prisma.account.findFirstOrThrow({
      where: { userId: id, providerId: "credential" },
    });
    expect(contaAposFalha.password).toBe(contaAntes.password);
    expect(await prisma.session.count({ where: { userId: id } })).toBe(sessoesAntes);

    const novaTentativa = await auth.api.resetPassword({
      body: { newPassword: senhaNova, token },
    });
    expect(novaTentativa.status).toBe(true);
    expect(await prisma.verification.count({ where: { identifier: identificador } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: id } })).toBe(0);

    const login = await auth.api.signInEmail({
      body: { email, password: senhaNova },
    });
    expect(login.user.id).toBe(id);
  });

  it("recusa senha atual incorreta sem alterar a credencial nem revogar a sessão", async () => {
    const email = emailNovo("troca-senha-atual");
    const senhaAtual = "SenhaAtual123!";
    const senhaNova = "SenhaNova123!";
    const id = await criarContaComCredencial(email, senhaAtual);
    const login = await auth.api.signInEmail({ body: { email, password: senhaAtual } });
    expect(login.token).toBeTruthy();

    const cabecalhos = new Headers({
      cookie: `better-auth.session_token=${login.token}`,
    });
    const contaAntes = await prisma.account.findFirstOrThrow({
      where: { userId: id, providerId: "credential" },
    });

    await expect(
      auth.api.changePassword({
        headers: cabecalhos,
        body: {
          currentPassword: "SenhaErrada123!",
          newPassword: senhaNova,
          revokeOtherSessions: true,
        },
      }),
    ).rejects.toBeTruthy();

    const contaDepois = await prisma.account.findFirstOrThrow({
      where: { userId: id, providerId: "credential" },
    });
    expect(contaDepois.password).toBe(contaAntes.password);
    expect(await prisma.session.count({ where: { userId: id } })).toBe(1);

    const loginAntigo = await auth.api.signInEmail({
      body: { email, password: senhaAtual },
    });
    expect(loginAntigo.user.id).toBe(id);
    await expect(
      auth.api.signInEmail({ body: { email, password: senhaNova } }),
    ).rejects.toBeTruthy();
  });

  it("recusa token adulterado ou expirado sem alterar a senha", async () => {
    const email = emailNovo("reset-token-invalido");
    const senhaAntiga = "SenhaAntiga123!";
    const id = await criarContaComCredencial(email, senhaAntiga);

    const adulterado = await solicitarToken(email);
    const identificadorAdulterado = `reset-password:${adulterado}`;
    await expect(
      auth.api.resetPassword({
        body: { newPassword: "SenhaAdulterada123!", token: `${adulterado}x` },
      }),
    ).rejects.toBeTruthy();
    expect(
      await prisma.verification.count({ where: { identifier: identificadorAdulterado } }),
    ).toBe(1);

    const expirado = await solicitarToken(email);
    const identificadorExpirado = `reset-password:${expirado}`;
    await prisma.verification.updateMany({
      where: { identifier: identificadorExpirado },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(
      auth.api.resetPassword({
        body: { newPassword: "SenhaExpirada123!", token: expirado },
      }),
    ).rejects.toBeTruthy();

    const login = await auth.api.signInEmail({
      body: { email, password: senhaAntiga },
    });
    expect(login.user.id).toBe(id);
  });

  it("faz a nova senha valer em outra instância e recusa a anterior", async () => {
    const email = emailNovo("reset-outra-instancia");
    const senhaAntiga = "SenhaAntiga123!";
    const senhaNova = "SenhaNova123!";
    const id = await criarContaComCredencial(email, senhaAntiga);
    const token = await solicitarToken(email);

    const resultado = await auth.api.resetPassword({
      body: { newPassword: senhaNova, token },
    });
    expect(resultado.status).toBe(true);

    const { auth: outraInstancia } = criarAutenticacaoParaReset(prisma);
    await expect(
      outraInstancia.api.signInEmail({ body: { email, password: senhaAntiga } }),
    ).rejects.toBeTruthy();
    const login = await outraInstancia.api.signInEmail({
      body: { email, password: senhaNova },
    });
    expect(login.user.id).toBe(id);
  });

  it("permite no máximo um resgate concorrente do mesmo token", async () => {
    const email = emailNovo("reset-concorrente");
    await criarContaComCredencial(email, "SenhaAntiga123!");
    const token = await solicitarToken(email);
    const identificador = `reset-password:${token}`;

    const resultados = await Promise.allSettled([
      auth.api.resetPassword({ body: { newPassword: "ConcorrenteA123!", token } }),
      auth.api.resetPassword({ body: { newPassword: "ConcorrenteB123!", token } }),
    ]);

    const sucessos = resultados.filter((resultado) => resultado.status === "fulfilled");
    const falhas = resultados.filter((resultado) => resultado.status === "rejected");

    expect(sucessos).toHaveLength(1);
    expect(falhas).toHaveLength(1);
    expect(await prisma.verification.count({ where: { identifier: identificador } })).toBe(0);
  });
});
