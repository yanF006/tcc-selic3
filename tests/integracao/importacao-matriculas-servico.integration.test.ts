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
import { importarMatriculas, listarImportacoesMatriculas, listarMatriculas, matriculaRegistrada, registrarMatricula } from "@/lib/services/administracao";
import { validarEtapaUm } from "@/lib/services/cadastro";
import * as store from "@/lib/services/store";
import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";
import { criarExecutorDdl } from "./ddl";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base = process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");
const prefixo = `imp-${crypto.randomUUID().slice(0, 8)}`;
const numero = Number(BigInt(`0x${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`) % BigInt(900000000));
const matricula = (indice: number) => `89${String(numero + indice).padStart(9, "0")}`;
const gatilho = `probe_${prefixo.replaceAll("-", "_")}`;
const prisma = new PrismaClient({ adapter: new PrismaMariaDb({
  host: configuracao.host, port: configuracao.porta, user: configuracao.usuario,
  password: configuracao.senha, database: configuracao.banco, connectionLimit: 2,
  ssl: { ca, rejectUnauthorized: true },
}) });

const executarDdl = criarExecutorDdl(configuracao);

beforeAll(() => {
  vi.stubEnv("SELIC_PERSISTENCIA", "persistente");
  vi.stubEnv("DATABASE_URL", configuracao.url);
  vi.stubEnv("SELIC_DB_CA_CERT", ca);
  vi.spyOn(store, "obterEstado").mockImplementation(() => { throw new Error("Leitura indevida de fixtures."); });
});
afterAll(async () => {
  await executarDdl(`DROP TRIGGER IF EXISTS ${gatilho}`);
  await prisma.usuario.deleteMany({ where: { id: `${prefixo}-conta` } });
  await prisma.matriculaImportada.deleteMany({ where: { nome: { startsWith: prefixo } } });
  await prisma.importacaoMatriculas.deleteMany({ where: { arquivo: { startsWith: prefixo } } });
  await prisma.$disconnect();
  descartarCliente();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("importação e lançamento persistentes de matrículas", () => {
  it("preserva o lote, os três resultados e os motivos em outro processo", async () => {
    const resultado = await importarMatriculas(`${prefixo}.csv`, [
      { matricula: matricula(0), nome: `${prefixo}-aceita`, curso: "Informática" },
      { matricula: matricula(0), nome: `${prefixo}-duplicada`, curso: "Outro" },
      { matricula: "123", nome: `${prefixo}-curta`, curso: "Informática" },
      { matricula: "", nome: "", curso: "" },
    ]);
    expect(resultado).toMatchObject({ validas: 1, ignoradas: 1, rejeitadas: 2 });
    const script = fileURLToPath(new URL("../support/consultar-importacao-processo.ts", import.meta.url));
    const contexto = new URL("../support/contexto-servidor.mjs", import.meta.url).href;
    const { stdout } = await promisify(execFile)(process.execPath,
      ["--import", "tsx", "--import", contexto, script, resultado.id], { env: { ...process.env }, timeout: 20_000 });
    expect(JSON.parse(stdout)).toMatchObject({
      id: resultado.id, arquivo: `${prefixo}.csv`, importadoEm: resultado.importadoEm,
      validas: 1, ignoradas: 1, rejeitadas: 2,
      itens: expect.arrayContaining([
        expect.objectContaining({ resultado: "valida", matricula: matricula(0) }),
        expect.objectContaining({ resultado: "ignorada", motivo: expect.stringContaining("já registrada") }),
        expect.objectContaining({ resultado: "rejeitada", motivo: expect.stringContaining("11 dígitos") }),
      ]),
    });
    const pagina = await listarMatriculas({ busca: prefixo, origem: "importacao", tamanho: 1, pagina: 99 });
    expect(pagina).toMatchObject({ total: 1, pagina: 1 });
    expect(pagina.itens[0]).toMatchObject({ nome: `${prefixo}-aceita`, curso: "Informática", origem: "importacao", importadaEm: resultado.importadoEm });
  });

  it("não sobrescreve matrículas sob importações e lançamentos concorrentes", async () => {
    const lotes = await Promise.all([
      importarMatriculas(`${prefixo}-A.csv`, [{ matricula: matricula(1), nome: `${prefixo}-A`, curso: "A" }]),
      importarMatriculas(`${prefixo}-B.csv`, [{ matricula: matricula(1), nome: `${prefixo}-B`, curso: "B" }]),
    ]);
    expect(lotes.reduce((total, lote) => total + lote.validas, 0)).toBe(1);
    expect(lotes.reduce((total, lote) => total + lote.ignoradas, 0)).toBe(1);
    const vencedora = lotes.find((lote) => lote.validas === 1)!;
    expect(await prisma.matriculaImportada.findUnique({ where: { matricula: matricula(1) } })).toMatchObject({ nome: vencedora.itens[0].nome });
    const manuais = await Promise.allSettled([
      registrarMatricula({ matricula: matricula(2), nome: `${prefixo}-manual-A`, curso: "A" }),
      registrarMatricula({ matricula: matricula(2), nome: `${prefixo}-manual-B`, curso: "B" }),
    ]);
    expect(manuais.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(manuais.find((item) => item.status === "rejected")).toMatchObject({ reason: { codigo: "matricula_ja_registrada" } });
    expect((await listarMatriculas({ busca: matricula(2) })).itens[0]).toMatchObject({ origem: "cadastro_administrador" });
  });

  it("distingue matrícula registrada livre de matrícula vinculada a conta", async () => {
    await registrarMatricula({ matricula: matricula(3), nome: `${prefixo}-livre`, curso: "Informática" });
    expect(await matriculaRegistrada(matricula(3))).toBe(true);
    const dados = { matricula: matricula(3), email: `${prefixo}-cadastro@teste.local`, senha: "TesteSelic123!", confirmacao: "TesteSelic123!" };
    expect(await validarEtapaUm(dados)).toMatchObject({ ok: true, matriculaNaoRegistrada: false });
    await prisma.usuario.create({ data: { id: `${prefixo}-conta`, nome: prefixo, email: `${prefixo}-ocupada@teste.local`, matricula: matricula(3) } });
    expect(await validarEtapaUm(dados)).toMatchObject({ ok: false, campo: "matricula" });
    expect(await matriculaRegistrada(matricula(3))).toBe(true);
  });

  it("desfaz matrícula, lote e itens quando falha a gravação de um resultado", async () => {
    await executarDdl(`CREATE TRIGGER ${gatilho} BEFORE INSERT ON itens_importacao_matricula FOR EACH ROW BEGIN IF NEW.nome = '${prefixo}-falha' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'probe_importacao'; END IF; END`);
    try {
      await expect(importarMatriculas(`${prefixo}-falha.csv`, [{ matricula: matricula(4), nome: `${prefixo}-falha`, curso: "Informática" }])).rejects.toThrow();
      expect(await prisma.matriculaImportada.count({ where: { matricula: matricula(4) } })).toBe(0);
      expect((await listarImportacoesMatriculas()).some((lote) => lote.arquivo === `${prefixo}-falha.csv`)).toBe(false);
      expect(await prisma.itemImportacaoMatricula.count({ where: { nome: `${prefixo}-falha` } })).toBe(0);
    } finally {
      await executarDdl(`DROP TRIGGER IF EXISTS ${gatilho}`);
    }
  });
});
