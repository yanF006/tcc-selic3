import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import type { Usuario } from "@/lib/domain/types";
import {
  ativarCadastro,
  consultarCadastros,
  removerCadastro,
  salvarCadastro,
} from "@/lib/services/cadastros";
import { listarPeriodos, listarTurmas, opcoesSelecao } from "@/lib/services/catalogo";

import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base = process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");
const prefixo = `acad-${crypto.randomUUID().slice(0, 8)}`;
const cursos: string[] = [];
const turmas: string[] = [];
const periodos: string[] = [];
const usuarios: string[] = [];

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

const autor: Usuario = {
  id: `${prefixo}-autor`,
  nome: "Coordenação de Estágio",
  email: `${prefixo}-autor@teste.local`,
  papel: "coordenador_estagio",
  situacao: "ativo",
  campus: "Pinheiral",
  criadoEm: new Date().toISOString(),
};

async function criarCurso(sufixo: string) {
  const curso = await salvarCadastro(autor, "curso", {
    nome: `Curso ${sufixo}`,
    codigo: `${prefixo}-${sufixo}`,
  });
  cursos.push(curso.id);
  return curso;
}

async function criarPeriodo(ano: number, semestre: 1 | 2) {
  const periodo = await salvarCadastro(autor, "periodo", { ano, semestre });
  periodos.push(periodo.id);
  return periodo;
}

beforeAll(() => {
  vi.stubEnv("SELIC_PERSISTENCIA", "persistente");
  vi.stubEnv("DATABASE_URL", configuracao.url);
  vi.stubEnv("SELIC_DB_CA_CERT", ca);
});

afterAll(async () => {
  await prisma.dadosPessoaisAluno.deleteMany({ where: { turmaId: { in: turmas } } });
  await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
  await prisma.turmaPeriodo.deleteMany({ where: { turmaId: { in: turmas } } });
  await prisma.turma.deleteMany({ where: { id: { in: turmas } } });
  await prisma.periodo.deleteMany({ where: { id: { in: periodos } } });
  await prisma.curso.deleteMany({ where: { id: { in: cursos } } });
  await prisma.$disconnect();
  vi.unstubAllEnvs();
});

describe("cadastros acadêmicos persistentes", () => {
  it("cria curso, período e turma e oferece a turma com os períodos em outra leitura", async () => {
    const curso = await criarCurso("A");
    const periodo = await criarPeriodo(2041, 1);
    const turma = await salvarCadastro(autor, "turma", {
      nome: "Turma A",
      cursoId: curso.id,
      periodoIds: [periodo.id],
    });
    turmas.push(turma.id);

    expect(turma).toMatchObject({
      cursoId: curso.id,
      periodoIds: [periodo.id],
      situacao: "ativo",
    });

    const lista = await listarTurmas(curso.id);
    const opcoes = await opcoesSelecao();

    expect(lista).toEqual([
      expect.objectContaining({ id: turma.id, nome: "Turma A", periodoIds: [periodo.id] }),
    ]);
    expect(opcoes.turmasPorCurso[curso.id]).toEqual([turma.id]);

    const script = fileURLToPath(new URL("../support/listar-turmas-processo.ts", import.meta.url));
    const contexto = new URL("../support/contexto-servidor.mjs", import.meta.url).href;
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "--import", contexto, script, curso.id],
      {
        env: {
          ...process.env,
          DATABASE_URL: configuracao.url,
          SELIC_DB_CA_CERT: ca,
          SELIC_PERSISTENCIA: "persistente",
        },
      },
    );

    expect(JSON.parse(stdout)).toEqual([
      {
        id: turma.id,
        nome: "Turma A",
        periodoIds: [periodo.id],
        periodos: [expect.objectContaining({ id: periodo.id, rotulo: "2041.1" })],
      },
    ]);
  });

  it("recusa turma com curso ou período inválido sem criar registro parcial", async () => {
    const curso = await criarCurso("B");
    const periodo = await criarPeriodo(2042, 1);
    const inativo = await criarPeriodo(2043, 1);
    await removerCadastro(autor, "periodo", inativo.id, true);

    const antes = await prisma.turma.count();

    await expect(
      salvarCadastro(autor, "turma", {
        nome: "Turma inválida",
        cursoId: "inexistente",
        periodoIds: [periodo.id],
      }),
    ).rejects.toMatchObject({ codigo: "curso_invalido" });
    await expect(
      salvarCadastro(autor, "turma", {
        nome: "Turma inválida",
        cursoId: curso.id,
        periodoIds: [inativo.id],
      }),
    ).rejects.toMatchObject({ codigo: "periodo_invalido" });
    await expect(
      salvarCadastro(autor, "turma", {
        nome: "Turma inválida",
        cursoId: curso.id,
        periodoIds: ["periodo-inexistente"],
      }),
    ).rejects.toMatchObject({ codigo: "periodo_invalido" });

    expect(await prisma.turma.count()).toBe(antes);
  });

  it("preserva vínculos na exclusão e retira registros inativados das seleções", async () => {
    const curso = await criarCurso("C");
    const periodo = await criarPeriodo(2044, 1);
    const turma = await salvarCadastro(autor, "turma", {
      nome: "Turma C",
      cursoId: curso.id,
      periodoIds: [periodo.id],
    });
    turmas.push(turma.id);

    const aluno = await prisma.usuario.create({
      data: {
        id: `${prefixo}-aluno`,
        nome: "Aluno Vinculado",
        email: `${prefixo}-aluno@teste.local`,
        papel: "aluno",
        situacao: "ativo",
        matricula: `${prefixo}-mat`.slice(0, 20),
      },
    });
    usuarios.push(aluno.id);
    await prisma.dadosPessoaisAluno.create({
      data: {
        id: `${prefixo}-dp`,
        usuarioId: aluno.id,
        cpf: "12345678901",
        rg: "1234567",
        dataNascimento: new Date("2000-01-01T00:00:00.000Z"),
        telefone: "24999990000",
        celular: "24999990001",
        endereco: { cep: "27100000", logradouro: "Rua A", numero: "1", bairro: "Centro", cidade: "Pinheiral", estado: "RJ" },
        cursoId: curso.id,
        turmaId: turma.id,
        periodoId: periodo.id,
      },
    });

    await expect(removerCadastro(autor, "turma", turma.id)).rejects.toMatchObject({
      codigo: "cadastro_com_vinculos",
    });
    await expect(removerCadastro(autor, "periodo", periodo.id)).rejects.toMatchObject({
      codigo: "cadastro_com_vinculos",
    });
    await expect(removerCadastro(autor, "curso", curso.id)).rejects.toMatchObject({
      codigo: "cadastro_com_vinculos",
    });

    await removerCadastro(autor, "turma", turma.id, true);
    await removerCadastro(autor, "periodo", periodo.id, true);
    await removerCadastro(autor, "curso", curso.id, true);

    expect(await listarTurmas(curso.id)).toEqual([]);
    expect(await listarTurmas(curso.id, true)).toEqual([
      expect.objectContaining({ id: turma.id, situacao: "inativo" }),
    ]);
    expect(await listarPeriodos()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: periodo.id })]),
    );
    expect(await listarPeriodos(true)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: periodo.id, situacao: "inativo" })]),
    );

    await ativarCadastro(autor, "curso", curso.id);
    await ativarCadastro(autor, "turma", turma.id);
    await ativarCadastro(autor, "periodo", periodo.id);

    expect(await listarTurmas(curso.id)).toEqual([
      expect.objectContaining({ id: turma.id, situacao: "ativo" }),
    ]);
    expect((await consultarCadastros(autor)).cursos).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: curso.id, situacao: "ativo" })]),
    );
  });
});
