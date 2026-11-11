import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { descartarCliente } from "@/lib/db/prisma";
import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";
import { criarExecutorDdl } from "./ddl";

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

const prefixo = `cad-${crypto.randomUUID().slice(0, 8)}`;
const cursoId = `${prefixo}-curso`;
const cursoFalhaId = `${prefixo}-curso-falha`;
const turmaId = `${prefixo}-turma`;
const turmaFalhaId = `${prefixo}-turma-falha`;
const periodoId = `${prefixo}-periodo`;
const anoPeriodo = 2200 + Math.floor(Math.random() * 500);
const matriculasCriadas: string[] = [];
const emailsCriados: string[] = [];

const dadosPessoaisBase = {
  nomeCompleto: "Aluno de Integração",
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

function emailNovo(rotulo: string) {
  const email = `${prefixo}-${rotulo}@teste.local`;
  emailsCriados.push(email);
  return email;
}

function dadosCompletos(rotulo: string, matricula: string, curso = cursoId, turma = turmaId) {
  return {
    matricula,
    email: emailNovo(rotulo),
    senha: "SenhaForte123!",
    confirmacao: "SenhaForte123!",
    ...dadosPessoaisBase,
    cursoId: curso,
    turmaId: turma,
    periodoId,
  };
}

beforeAll(async () => {
  vi.stubEnv("SELIC_PERSISTENCIA", "persistente");
  vi.stubEnv("DATABASE_URL", configuracao.url);
  vi.stubEnv("SELIC_DB_CA_CERT", ca);
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("BETTER_AUTH_SECRET", "segredo-exclusivo-dos-testes-de-cadastro-selic");

  await prisma.curso.createMany({
    data: [
      { id: cursoId, nome: "Curso de Integração", codigo: `${prefixo}-C1` },
      { id: cursoFalhaId, nome: "Curso de Falha", codigo: `${prefixo}-C2` },
    ],
  });
  await prisma.turma.createMany({
    data: [
      { id: turmaId, nome: "Turma de Integração", cursoId },
      { id: turmaFalhaId, nome: "Turma de Falha", cursoId: cursoFalhaId },
    ],
  });
  await prisma.periodo.create({
    data: { id: periodoId, rotulo: `${anoPeriodo}.1`, ano: anoPeriodo, semestre: 1 },
  });
  await prisma.turmaPeriodo.createMany({
    data: [
      { turmaId, periodoId },
      { turmaId: turmaFalhaId, periodoId },
    ],
  });
});

afterAll(async () => {
  const usuarios = await prisma.usuario.findMany({
    where: { email: { in: emailsCriados } },
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
  if (matriculasCriadas.length > 0) {
    await prisma.matriculaImportada.deleteMany({
      where: { matricula: { in: matriculasCriadas } },
    });
  }
  await executarDdl("DROP TRIGGER IF EXISTS probe_falha_cadastro");
  await prisma.turmaPeriodo.deleteMany({ where: { turmaId: { in: [turmaId, turmaFalhaId] } } });
  await prisma.turma.deleteMany({ where: { id: { in: [turmaId, turmaFalhaId] } } });
  await prisma.periodo.deleteMany({ where: { id: periodoId } });
  await prisma.curso.deleteMany({ where: { id: { in: [cursoId, cursoFalhaId] } } });
  await prisma.$disconnect();
  descartarCliente();
  vi.unstubAllEnvs();
});

const executarDdl = criarExecutorDdl(configuracao);

describe("cadastro público persistente", () => {
  it("consulta a primeira etapa sem criar registros e matrícula registrada livre gera conta ativa", async () => {
    const { validarEtapaUm, concluirCadastro } = await import("@/lib/services/cadastro");
    const matricula = "20261234001";
    matriculasCriadas.push(matricula);
    await prisma.matriculaImportada.create({
      data: {
        id: `${prefixo}-mat-1`,
        matricula,
        nome: "Aluno Registrado",
        curso: "Curso de Integração",
        origem: "importacao",
      },
    });
    const dados = dadosCompletos("ativo", matricula);

    const consulta = await validarEtapaUm(dados);

    expect(consulta).toMatchObject({ ok: true, matriculaNaoRegistrada: false });
    expect(await prisma.usuario.count({ where: { email: dados.email } })).toBe(0);

    const conclusao = await concluirCadastro(dados);

    expect(conclusao).toMatchObject({ ok: true, situacao: "ativo" });

    const usuario = await prisma.usuario.findUnique({
      where: { email: dados.email },
      include: { authAccounts: true, dadosPessoaisAluno: true, solicitacaoAcesso: true },
    });

    expect(usuario?.situacao).toBe("ativo");
    expect(usuario?.papel).toBe("aluno");
    expect(usuario?.matricula).toBe(matricula);
    expect(usuario?.authAccounts).toHaveLength(1);
    expect(usuario?.authAccounts[0]?.providerId).toBe("credential");
    expect(usuario?.authAccounts[0]?.password).not.toBe(dados.senha);
    expect(usuario?.dadosPessoaisAluno?.turmaId).toBe(turmaId);
    expect(usuario?.solicitacaoAcesso).toBeNull();
  });

  it("matrícula livre não registrada gera conta pendente e uma solicitação", async () => {
    const { validarEtapaUm, concluirCadastro } = await import("@/lib/services/cadastro");
    const dados = dadosCompletos("pendente", "20261234002");

    const consulta = await validarEtapaUm(dados);
    expect(consulta).toMatchObject({ ok: true, matriculaNaoRegistrada: true });

    const conclusao = await concluirCadastro(dados);
    expect(conclusao).toMatchObject({ ok: true, situacao: "pendente" });

    const usuario = await prisma.usuario.findUnique({
      where: { email: dados.email },
      include: { solicitacaoAcesso: true, authAccounts: true },
    });

    expect(usuario?.situacao).toBe("pendente");
    expect(usuario?.solicitacaoAcesso?.situacao).toBe("pendente");
    expect(usuario?.solicitacaoAcesso?.cursoId).toBe(cursoId);
    expect(usuario?.authAccounts).toHaveLength(1);
  });

  it("falha na solicitação desfaz conta, credencial e dados pessoais", async () => {
    const { concluirCadastro } = await import("@/lib/services/cadastro");
    const dados = dadosCompletos("falha", "20261234003", cursoFalhaId, turmaFalhaId);

    await executarDdl(`
      CREATE TRIGGER probe_falha_cadastro BEFORE INSERT ON solicitacoes_acesso
      FOR EACH ROW
      BEGIN
        IF NEW.cursoId = '${cursoFalhaId}' THEN
          SET NEW.cursoId = '${cursoFalhaId}-inexistente';
        END IF;
      END
    `);

    const conclusao = await concluirCadastro(dados);

    expect(conclusao.ok).toBe(false);
    expect(await prisma.usuario.count({ where: { email: dados.email } })).toBe(0);
    expect(await prisma.authAccount.count({ where: { user: { email: dados.email } } })).toBe(0);

    await executarDdl("DROP TRIGGER IF EXISTS probe_falha_cadastro");
  });

  it("duas conclusões concorrentes da mesma matrícula resultam em uma conta e uma solicitação", async () => {
    const { concluirCadastro } = await import("@/lib/services/cadastro");
    const matricula = "20261234004";
    const dados = dadosCompletos("concorrente", matricula);

    const [primeira, segunda] = await Promise.all([
      concluirCadastro(dados),
      concluirCadastro(dados),
    ]);

    expect([primeira.ok, segunda.ok].filter(Boolean)).toHaveLength(1);
    expect(await prisma.usuario.count({ where: { email: dados.email } })).toBe(1);
    expect(await prisma.usuario.count({ where: { matricula } })).toBe(1);
    expect(
      await prisma.solicitacaoAcesso.count({ where: { usuario: { email: dados.email } } }),
    ).toBe(1);
  });
});
