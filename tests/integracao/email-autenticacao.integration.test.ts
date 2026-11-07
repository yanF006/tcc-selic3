import { readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { criarAutenticacao, criarAutenticacaoCadastro } from "@/lib/auth/autenticacao";
import type { TrabalhoPosResposta } from "@/lib/auth/email";
import { opcoesDeConexao } from "@/lib/db/prisma";
import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";
import { iniciarSmtpTeste } from "./smtp";

const banco = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base =
  process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(
    opcoesDeConexao(banco.url, {
      SELIC_DB_CA_CERT: readFileSync(join(base, "tls/ca.pem"), "utf8"),
    }),
  ),
});
const configuracao = {
  origem: "https://selic.teste.local",
  segredo: "segredo-exclusivo-dos-testes-de-email-selic",
};
const trabalhos: TrabalhoPosResposta[] = [];
const auth = criarAutenticacao(prisma, configuracao, {
  agendar: (trabalho) => trabalhos.push(trabalho),
});
const email = `email-auth-${crypto.randomUUID()}@teste.local`;
let usuarioId = "";
let smtp: Awaited<ReturnType<typeof iniciarSmtpTeste>>;

async function pedir(destinatario: string) {
  const resposta = await auth.handler(
    new Request(`${configuracao.origem}/api/auth/request-password-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: configuracao.origem },
      body: JSON.stringify({
        email: destinatario,
        redirectTo: `${configuracao.origem}/redefinir-senha`,
      }),
    }),
  );
  return { status: resposta.status, body: await resposta.json() };
}

async function concluirTrabalhos() {
  for (const trabalho of trabalhos.splice(0)) await trabalho();
}

beforeAll(async () => {
  smtp = await iniciarSmtpTeste();
  vi.stubEnv("SMTP_HOST", "127.0.0.1");
  vi.stubEnv("SMTP_PORT", String(smtp.porta));
  vi.stubEnv("SMTP_SECURE", "false");
  vi.stubEnv("SMTP_FROM", "SELic <senha@teste.local>");
  vi.stubEnv("SMTP_USER", "");
  vi.stubEnv("SMTP_PASSWORD", "");
  await prisma.$transaction(
    async (tx) => {
      const criado = await criarAutenticacaoCadastro(tx, configuracao).api.signUpEmail({
        body: { name: "Titular do Email", email, password: "SenhaAnterior123!" },
      });
      usuarioId = criado.user.id;
    },
    { timeout: 20_000 },
  );
});

afterAll(async () => {
  await prisma.authVerification.deleteMany({ where: { value: usuarioId } });
  await prisma.usuario.deleteMany({ where: { email } });
  await prisma.$disconnect();
  if (smtp) await smtp.parar();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("recuperação de senha com transporte SMTP", () => {
  it("responde genericamente e entrega o link padrão somente no trabalho pós-resposta", async () => {
    const semConta = await pedir(`inexistente-${crypto.randomUUID()}@teste.local`);
    expect(trabalhos).toHaveLength(0);
    const comConta = await pedir(email);
    expect(comConta).toEqual(semConta);
    expect(comConta.status).toBe(200);
    expect(JSON.stringify(comConta.body)).not.toContain("/reset-password/");
    expect(trabalhos).toHaveLength(1);
    expect(await readdir(smtp.diretorio)).toHaveLength(0);
    await concluirTrabalhos();
    const arquivos = await readdir(smtp.diretorio);
    expect(arquivos).toHaveLength(1);
    const mensagem = (await readFile(join(smtp.diretorio, arquivos[0]), "utf8"))
      .replace(/=\r?\n/g, "")
      .replace(/=3D/g, "=");
    expect(mensagem).toContain(email);
    const token = mensagem.match(
      /https:\/\/selic\.teste\.local\/api\/auth\/reset-password\/([a-zA-Z0-9]+)/,
    )?.[1];
    expect(token).toBeTruthy();
    expect(
      await prisma.authVerification.findFirst({
        where: { identifier: `reset-password:${token}`, value: usuarioId },
      }),
    ).not.toBeNull();
  });

  it("preserva confirmação genérica na falha SMTP, não registra tokens e permite novo pedido", async () => {
    const servidor = createServer();
    await new Promise<void>((resolve) => servidor.listen(0, "127.0.0.1", resolve));
    const endereco = servidor.address();
    if (!endereco || typeof endereco === "string") throw new Error("Porta ausente.");
    await new Promise<void>((resolve) => servidor.close(() => resolve()));
    vi.stubEnv("SMTP_PORT", String(endereco.port));
    vi.stubEnv("SMTP_USER", "usuario-smtp-teste");
    vi.stubEnv("SMTP_PASSWORD", "senha-smtp-nao-deve-aparecer");
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const antes = (await readdir(smtp.diretorio)).length;
    const falha = await pedir(email);
    const semConta = await pedir(`ausente-${crypto.randomUUID()}@teste.local`);
    expect(falha).toEqual(semConta);
    expect(falha.status).toBe(200);
    await concluirTrabalhos();
    expect(await readdir(smtp.diretorio)).toHaveLength(antes);
    const logs = JSON.stringify(aviso.mock.calls);
    expect(logs).toContain("Falha ao enviar");
    expect(logs).not.toContain("senha-smtp-nao-deve-aparecer");
    expect(logs).not.toContain("usuario-smtp-teste");
    expect(logs).not.toContain("https://");
    for (const verificacao of await prisma.authVerification.findMany({
      where: { value: usuarioId },
    })) {
      expect(logs).not.toContain(verificacao.identifier.replace("reset-password:", ""));
    }
    vi.stubEnv("SMTP_PORT", String(smtp.porta));
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASSWORD", "");
    const novoPedido = await pedir(email);
    expect(novoPedido).toEqual(falha);
    await concluirTrabalhos();
    expect(await readdir(smtp.diretorio)).toHaveLength(antes + 1);
    aviso.mockRestore();
  });
});
