import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { descartarCliente } from "@/lib/db/prisma";
import { listarConvenios } from "@/lib/services/catalogo";
import { listarLancamentos } from "@/lib/services/lancamentos";
import * as store from "@/lib/services/store";
import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base = process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");
const prefixo = `pagin-${crypto.randomUUID().slice(0, 8)}`;
const prisma = new PrismaClient({ adapter: new PrismaMariaDb({ host: configuracao.host, port: configuracao.porta, user: configuracao.usuario,
  password: configuracao.senha, database: configuracao.banco, connectionLimit: 2, ssl: { ca, rejectUnauthorized: true } }) });
const id = (sufixo: string) => `${prefixo}-${sufixo}`;
const TOTAL_CONVENIOS = 7;
const TOTAL_LANCAMENTOS = 5;
const convenios = Array.from({ length: TOTAL_CONVENIOS }, (_, indice) => id(`conv-${indice}`));

beforeAll(async () => {
  vi.stubEnv("SELIC_PERSISTENCIA", "persistente");
  vi.stubEnv("DATABASE_URL", configuracao.url);
  vi.stubEnv("SELIC_DB_CA_CERT", ca);
  // Mesma vigência para todos: a ordenação depende só do desempate por id.
  vi.spyOn(store, "obterEstado").mockImplementation(() => { throw new Error("Simulador proibido neste fluxo."); });

  await prisma.instituicaoConcedente.create({ data: { id: id("instituicao"), nome: prefixo, cnpj: prefixo } });
  for (const convenioId of convenios) {
    await prisma.convenio.create({ data: { id: convenioId, instituicaoId: id("instituicao"), nome: `${prefixo} convênio`, inicioVigencia: new Date("2026-01-01"), fimVigencia: new Date("2031-01-01") } });
  }

  await prisma.pessoa.create({ data: { id: id("supervisor"), nome: `${prefixo} supervisor`, email: `${id("supervisor")}@teste.local`, telefone: "2433334444", papel: "supervisor" } });
  await prisma.pessoa.create({ data: { id: id("orientador"), nome: `${prefixo} orientador`, email: `${id("orientador")}@teste.local`, telefone: "2433334444", papel: "orientador" } });
  await prisma.usuario.create({ data: { id: id("aluno"), nome: `${prefixo} aluno`, email: `${id("aluno")}@teste.local`, situacao: "ativo", papel: "aluno" } });
  await prisma.estagio.create({ data: {
    id: id("estagio"), alunoId: id("aluno"), convenioId: convenios[0], supervisorId: id("supervisor"), orientadorId: id("orientador"),
    dataInicio: new Date("2028-01-03"), dataFim: new Date("2028-01-31"), situacao: "em_andamento",
  } });

  // Mesmo dia e mesmo instante de criação: só o id desempata a ordem.
  const criadoEm = new Date("2028-01-04T12:00:00.000Z");
  for (let indice = 0; indice < TOTAL_LANCAMENTOS; indice += 1) {
    await prisma.lancamentoHoras.create({ data: {
      id: id(`lan-${indice}`), estagioId: id("estagio"), alunoId: id("aluno"), data: new Date("2028-01-04"),
      entrada: "08:00", saida: "09:00", minutos: 60, tipo: "lancamento", criadoEm,
    } });
  }
});

afterAll(async () => {
  vi.restoreAllMocks();
  await prisma.lancamentoHoras.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.estagio.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.convenio.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.instituicaoConcedente.deleteMany({ where: { id: id("instituicao") } });
  await prisma.pessoa.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.usuario.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.$disconnect();
  descartarCliente();
  vi.unstubAllEnvs();
});

async function paginasDeConvenios(tamanho: number): Promise<{ total: number; paginas: string[][] }> {
  const primeira = await listarConvenios({ busca: prefixo, tamanho, pagina: 1 });
  const paginas: string[][] = [];
  for (let pagina = 1; pagina <= Math.max(1, Math.ceil(primeira.total / tamanho)); pagina += 1) {
    paginas.push((await listarConvenios({ busca: prefixo, tamanho, pagina })).itens.map((item) => item.id));
  }
  return { total: primeira.total, paginas };
}

describe("consultas paginadas persistentes (12.2)", () => {
  it("alcança todos os convênios fora da primeira página, sem repetição nem perda", async () => {
    const { total, paginas } = await paginasDeConvenios(3);
    const todos = paginas.flat();

    expect(total).toBe(TOTAL_CONVENIOS);
    expect(paginas).toHaveLength(3);
    expect(new Set(todos).size).toBe(TOTAL_CONVENIOS);
    expect(todos.sort()).toEqual([...convenios].sort());
  });

  it("repete a mesma paginação em outro processo Node e obtém a mesma ordem", async () => {
    const local = await paginasDeConvenios(3);
    const script = fileURLToPath(new URL("../support/listar-convenios-processo.ts", import.meta.url));
    const contexto = new URL("../support/contexto-servidor.mjs", import.meta.url).href;
    const ambiente = { ...process.env, DATABASE_URL: configuracao.url, SELIC_DB_CA_CERT: ca, SELIC_PERSISTENCIA: "persistente" };

    const primeiraExecucao = JSON.parse((await promisify(execFile)(process.execPath, ["--import", "tsx", "--import", contexto, script, prefixo, "3"], { env: ambiente, timeout: 30_000 })).stdout);
    const segundaExecucao = JSON.parse((await promisify(execFile)(process.execPath, ["--import", "tsx", "--import", contexto, script, prefixo, "3"], { env: ambiente, timeout: 30_000 })).stdout);

    expect(primeiraExecucao).toEqual(local);
    expect(segundaExecucao).toEqual(local);
  });

  it("alcança os lançamentos de horas fora da primeira página mesmo com ordenação empatada", async () => {
    const paginas: string[] = [];
    const primeira = await listarLancamentos(id("estagio"), { tamanho: 2, pagina: 1 });

    for (let pagina = 1; pagina <= Math.ceil(primeira.total / 2); pagina += 1) {
      paginas.push(...(await listarLancamentos(id("estagio"), { tamanho: 2, pagina })).itens.map((item) => item.id));
    }

    expect(primeira.total).toBe(TOTAL_LANCAMENTOS);
    expect(new Set(paginas).size).toBe(TOTAL_LANCAMENTOS);
    expect(paginas.sort()).toEqual(Array.from({ length: TOTAL_LANCAMENTOS }, (_, indice) => id(`lan-${indice}`)).sort());
  });
});
