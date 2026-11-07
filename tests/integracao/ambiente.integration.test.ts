import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";

import { carregarUrlTeste, validarUrlTeste } from "./configuracao";

const configuracao = validarUrlTeste(carregarUrlTeste());

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: configuracao.host,
    port: configuracao.porta,
    user: configuracao.usuario,
    password: configuracao.senha,
    database: configuracao.banco,
    connectionLimit: 1,
    // O MySQL 8 usa caching_sha2_password; o TLS local (certificado
    // autoassinado) permite a troca de chave sem liberar RSA em texto claro.
    ssl: { rejectUnauthorized: false },
  }),
});

afterAll(async () => {
  await prisma.$executeRawUnsafe("DROP TABLE IF EXISTS probe_integracao").catch(() => undefined);
  await prisma.$disconnect();
});

describe("ambiente de integração", () => {
  it("executa escrita, leitura e limpeza no schema isolado", async () => {
    await prisma.$executeRawUnsafe("DROP TABLE IF EXISTS probe_integracao");
    await prisma.$executeRawUnsafe(
      "CREATE TABLE probe_integracao (id INT PRIMARY KEY, valor VARCHAR(50) NOT NULL)",
    );

    await prisma.$executeRawUnsafe("INSERT INTO probe_integracao (id, valor) VALUES (1, 'ok')");

    const linhas = await prisma.$queryRawUnsafe<Array<{ valor: string }>>(
      "SELECT valor FROM probe_integracao WHERE id = 1",
    );
    expect(linhas).toEqual([{ valor: "ok" }]);

    await prisma.$executeRawUnsafe("DELETE FROM probe_integracao");
    const [contagem] = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      "SELECT COUNT(*) AS total FROM probe_integracao",
    );
    expect(Number(contagem.total)).toBe(0);

    await prisma.$executeRawUnsafe("DROP TABLE probe_integracao");
    const restantes = await prisma.$queryRawUnsafe<Array<{ nome: string }>>(
      "SHOW TABLES LIKE 'probe_integracao'",
    );
    expect(restantes).toEqual([]);
  });

  it("recusa destinos que não são o banco isolado de testes", () => {
    expect(() => validarUrlTeste("mysql://usuario:senha@db.aivencloud.com:1234/selic", {})).toThrow(
      /loopback/,
    );

    expect(() => validarUrlTeste("mysql://usuario:senha@127.0.0.1:33306/selic", {})).toThrow(
      /selic_teste/,
    );

    const urlAplicacao = "mysql://usuario:senha@127.0.0.1:33306/selic_teste";
    expect(() => validarUrlTeste(urlAplicacao, { DATABASE_URL: urlAplicacao })).toThrow(
      /DATABASE_URL/,
    );

    expect(() => carregarUrlTeste({ SELIC_MYSQL_TESTE_BASE: "/diretorio/que/nao/existe" })).toThrow(
      /TEST_DATABASE_URL ausente/,
    );
  });

  it("captura mensagem no coletor SMTP de teste", async () => {
    const coletor = await iniciarColetorSmtp();

    try {
      await enviarMensagem(coletor.porta);
      const arquivo = await esperarArquivo(coletor.diretorio);
      const conteudo = await readFile(arquivo, "utf8");

      expect(conteudo).toContain("Subject: Teste SELic");
      expect(conteudo).toContain("Corpo de teste");
      expect(conteudo).toContain("destinatario@teste.local");
    } finally {
      coletor.processo.kill("SIGTERM");
      await rm(coletor.diretorio, { recursive: true, force: true });
    }
  });
});

interface ColetorSmtp {
  processo: ChildProcess;
  porta: number;
  diretorio: string;
}

async function iniciarColetorSmtp(): Promise<ColetorSmtp> {
  const diretorio = await mkdtemp(join(tmpdir(), "selic-smtp-"));
  const script = fileURLToPath(new URL("../../scripts/smtp-teste.mjs", import.meta.url));
  const processo = spawn(process.execPath, [script], {
    env: {
      ...process.env,
      SMTP_TEST_HOST: "127.0.0.1",
      SMTP_TEST_PORT: "0",
      SMTP_TEST_DIR: diretorio,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const linhas = criarFila(processo.stdout!);
  const anuncio = await Promise.race([
    linhas(),
    new Promise<never>((_, rejeitar) =>
      setTimeout(() => rejeitar(new Error("coletor SMTP não iniciou em 5 s")), 5_000),
    ),
  ]);
  const { porta } = JSON.parse(anuncio) as { porta: number };

  return { processo, porta, diretorio };
}

function criarFila(fluxo: NodeJS.ReadableStream) {
  const fila: string[] = [];
  const esperando: Array<(linha: string) => void> = [];

  createInterface({ input: fluxo }).on("line", (linha) => {
    const proximo = esperando.shift();
    if (proximo) proximo(linha);
    else fila.push(linha);
  });

  return () =>
    fila.length > 0
      ? Promise.resolve(fila.shift() as string)
      : new Promise<string>((resolver) => esperando.push(resolver));
}

async function conectar(porta: number) {
  const socket = net.createConnection({ host: "127.0.0.1", port: porta });
  const proximaLinha = criarFila(socket);

  await new Promise<void>((resolver, rejeitar) => {
    socket.once("connect", () => resolver());
    socket.once("error", rejeitar);
  });

  async function esperar(prefixo: string) {
    for (;;) {
      const linha = await proximaLinha();
      if (linha.startsWith(prefixo)) return linha;
    }
  }

  return { socket, proximaLinha, esperar };
}

async function enviarMensagem(porta: number) {
  const { socket, proximaLinha, esperar } = await conectar(porta);

  await esperar("220");
  socket.write("EHLO teste.local\r\n");
  for (;;) {
    const linha = await proximaLinha();
    if (linha.startsWith("250 ")) break;
  }

  socket.write("MAIL FROM:<remetente@teste.local>\r\n");
  await esperar("250");
  socket.write("RCPT TO:<destinatario@teste.local>\r\n");
  await esperar("250");
  socket.write("DATA\r\n");
  await esperar("354");
  socket.write("Subject: Teste SELic\r\n\r\nCorpo de teste\r\n.\r\n");
  await esperar("250");
  socket.write("QUIT\r\n");
  socket.end();
}

async function esperarArquivo(diretorio: string): Promise<string> {
  for (let tentativa = 0; tentativa < 50; tentativa += 1) {
    const arquivos = (await readdir(diretorio)).filter((nome) => nome.endsWith(".eml"));
    if (arquivos.length > 0) return join(diretorio, arquivos[0]);
    await new Promise((resolver) => setTimeout(resolver, 100));
  }

  throw new Error("o coletor SMTP não gravou a mensagem");
}
