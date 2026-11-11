import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base = process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: configuracao.host,
    port: configuracao.porta,
    user: configuracao.usuario,
    password: configuracao.senha,
    database: configuracao.banco,
    connectionLimit: 2,
    ssl: { rejectUnauthorized: false },
  }),
});

const prefixo = `proc-${crypto.randomUUID().slice(0, 8)}`;
const cursoId = `${prefixo}-curso`;
const turmaId = `${prefixo}-turma`;
const periodoId = `${prefixo}-periodo`;
const anoPeriodo = 2700 + Math.floor(Math.random() * 300);
const matriculaAtiva = "20261235001";
const emails: string[] = [];

const dadosPessoais = {
  nomeCompleto: "Aluno Entre Processos",
  cpf: "111.444.777-35",
  rg: "12.345.678-9",
  dataNascimento: "2005-03-14",
  telefone: "2130000000",
  celular: "21900000000",
  endereco: {
    cep: "23900000",
    logradouro: "Rua das Acácias",
    numero: "120",
    bairro: "Centro",
    cidade: "Pinheiral",
    estado: "RJ",
  },
};

function etapaUm(email: string) {
  return {
    matricula: matriculaAtiva,
    email,
    senha: "SenhaForte123!",
    confirmacao: "SenhaForte123!",
  };
}

function conclusao(email: string) {
  return {
    ...etapaUm(email),
    ...dadosPessoais,
    cursoId,
    turmaId,
    periodoId,
  };
}

async function noProcesso(
  etapa: "consulta" | "conclusao",
  dados: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const script = fileURLToPath(new URL("../support/cadastro-processo.ts", import.meta.url));
  const contexto = new URL("../support/contexto-servidor.mjs", import.meta.url).href;
  const { stdout } = await promisify(execFile)(
    process.execPath,
    ["--import", "tsx", "--import", contexto, script],
    {
      env: {
        ...process.env,
        SELIC_PERSISTENCIA: "persistente",
        DATABASE_URL: configuracao.url,
        SELIC_DB_CA_CERT: ca,
        BETTER_AUTH_URL: "http://localhost:3000",
        BETTER_AUTH_SECRET: "segredo-exclusivo-dos-processos-de-cadastro",
        SELIC_CADASTRO_ETAPA: etapa,
        SELIC_CADASTRO_DADOS: JSON.stringify(dados),
      },
      maxBuffer: 1024 * 1024,
      timeout: 90_000,
    },
  );
  return JSON.parse(stdout) as Record<string, unknown>;
}

beforeAll(async () => {
  await prisma.curso.create({
    data: { id: cursoId, nome: "Curso Entre Processos", codigo: `${prefixo}-C1` },
  });
  await prisma.turma.create({ data: { id: turmaId, nome: "Turma Entre Processos", cursoId } });
  await prisma.periodo.create({
    data: { id: periodoId, rotulo: `${anoPeriodo}.1`, ano: anoPeriodo, semestre: 1 },
  });
  await prisma.turmaPeriodo.create({ data: { turmaId, periodoId } });
  await prisma.matriculaImportada.create({
    data: {
      id: `${prefixo}-mat`,
      matricula: matriculaAtiva,
      nome: "Aluno Entre Processos",
      curso: "Curso Entre Processos",
      origem: "importacao",
    },
  });
});

afterAll(async () => {
  const usuarios = await prisma.usuario.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const ids = usuarios.map((usuario) => usuario.id);

  if (ids.length > 0) {
    await prisma.solicitacaoAcesso.deleteMany({ where: { usuarioId: { in: ids } } });
    await prisma.dadosPessoaisAluno.deleteMany({ where: { usuarioId: { in: ids } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: ids } } });
    await prisma.authAccount.deleteMany({ where: { userId: { in: ids } } });
    await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.matriculaImportada.deleteMany({ where: { matricula: matriculaAtiva } });
  await prisma.turmaPeriodo.deleteMany({ where: { turmaId } });
  await prisma.turma.deleteMany({ where: { id: turmaId } });
  await prisma.periodo.deleteMany({ where: { id: periodoId } });
  await prisma.curso.deleteMany({ where: { id: cursoId } });
  await prisma.$disconnect();
});

describe("cadastro entre processos", () => {
  it("consulta no processo A e conclui no processo B com os dados completos", async () => {
    const email = `${prefixo}-ativo@teste.local`;
    emails.push(email);

    const consulta = await noProcesso("consulta", etapaUm(email));
    expect(consulta).toMatchObject({ ok: true, matriculaNaoRegistrada: false });
    expect(await prisma.usuario.count({ where: { email } })).toBe(0);

    const resultado = await noProcesso("conclusao", conclusao(email));
    expect(resultado).toMatchObject({ ok: true, situacao: "ativo" });

    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { authAccounts: true, dadosPessoaisAluno: true },
    });

    expect(usuario?.situacao).toBe("ativo");
    expect(usuario?.matricula).toBe(matriculaAtiva);
    expect(usuario?.authAccounts).toHaveLength(1);
    expect(usuario?.dadosPessoaisAluno?.turmaId).toBe(turmaId);
  });

  it("consulta no processo A e mantém pendência criada no processo B", async () => {
    const email = `${prefixo}-pendente@teste.local`;
    emails.push(email);
    const dados = { ...conclusao(email), matricula: "20261235002" };

    const consulta = await noProcesso("consulta", dados);
    expect(consulta).toMatchObject({ ok: true, matriculaNaoRegistrada: true });

    const resultado = await noProcesso("conclusao", dados);
    expect(resultado).toMatchObject({ ok: true, situacao: "pendente" });

    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { solicitacaoAcesso: true },
    });

    expect(usuario?.situacao).toBe("pendente");
    expect(usuario?.solicitacaoAcesso?.situacao).toBe("pendente");
  });
});
