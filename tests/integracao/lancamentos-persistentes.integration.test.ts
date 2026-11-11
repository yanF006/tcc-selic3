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
import { descartarCliente } from "@/lib/db/prisma";
import { criarEstagio, totalHorasDoEstagio } from "@/lib/services/estagios";
import { corrigirLancamento, horasDaSemana, horasEfetivasDoDia, lancamentosDoEstagioAtuais, lancarHoras } from "@/lib/services/lancamentos";
import { dadosSolicitacaoTeste } from "@/lib/fixtures/solicitacao-teste";
import * as store from "@/lib/services/store";
import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base = process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");
const prefixo = `horas-${crypto.randomUUID().slice(0, 8)}`;
const prisma = new PrismaClient({ adapter: new PrismaMariaDb({ host: configuracao.host, port: configuracao.porta, user: configuracao.usuario,
  password: configuracao.senha, database: configuracao.banco, connectionLimit: 2, ssl: { ca, rejectUnauthorized: true } }) });
const id = (sufixo: string) => `${prefixo}-${sufixo}`;
const aluno: Usuario = { id: id("aluno"), nome: "aluno", email: `${id("aluno")}@teste.local`, papel: "aluno", situacao: "ativo", campus: "Pinheiral", criadoEm: "2026-11-10" };

beforeAll(async () => {
  vi.stubEnv("SELIC_PERSISTENCIA", "persistente");
  vi.stubEnv("DATABASE_URL", configuracao.url);
  vi.stubEnv("SELIC_DB_CA_CERT", ca);
  vi.spyOn(store, "obterEstado").mockImplementation(() => { throw new Error("Fixtures proibidas neste fluxo."); });
  await prisma.curso.create({ data: { id: id("curso"), nome: id("curso"), codigo: id("curso") } });
  await prisma.periodo.create({ data: { id: id("periodo"), rotulo: "2099.1", ano: 2099, semestre: 1 } });
  await prisma.turma.create({ data: { id: id("turma"), nome: id("turma"), cursoId: id("curso") } });
  await prisma.turmaPeriodo.create({ data: { turmaId: id("turma"), periodoId: id("periodo") } });
  await prisma.usuario.create({ data: { id: aluno.id, nome: aluno.nome, email: aluno.email, situacao: "ativo", papel: "aluno" } });
  await prisma.dadosPessoaisAluno.create({ data: {
    id: id("dp"), usuarioId: aluno.id, cpf: "52998224725", rg: "12345678", dataNascimento: new Date("2000-01-01"), telefone: "2433334444", celular: "24999994444",
    endereco: { cep: "27197000", logradouro: "Rua do cadastro", numero: "1", bairro: "Centro", cidade: "Pinheiral", estado: "RJ" }, cursoId: id("curso"), turmaId: id("turma"), periodoId: id("periodo"),
  } });
  await prisma.instituicaoConcedente.create({ data: { id: id("instituicao"), nome: prefixo, cnpj: prefixo } });
  await prisma.convenio.create({ data: { id: id("convenio"), instituicaoId: id("instituicao"), nome: prefixo, inicioVigencia: new Date("2027-01-01"), fimVigencia: new Date("2032-01-01") } });
  for (const papel of ["supervisor", "orientador"]) await prisma.pessoa.create({ data: { id: id(papel), nome: papel, email: `${papel}@teste.local`, telefone: "2433334444", papel } });
});

afterAll(async () => {
  vi.restoreAllMocks();
  await prisma.lancamentoHoras.deleteMany({ where: { alunoId: aluno.id, corrigeId: { not: null } } });
  await prisma.lancamentoHoras.deleteMany({ where: { alunoId: aluno.id } });
  await prisma.estagioTemplate.deleteMany({ where: { estagio: { alunoId: aluno.id } } });
  await prisma.documentoPreenchido.deleteMany({ where: { alunoId: aluno.id } });
  await prisma.estagio.deleteMany({ where: { alunoId: aluno.id } });
  await prisma.convenio.deleteMany({ where: { id: id("convenio") } });
  await prisma.instituicaoConcedente.deleteMany({ where: { id: id("instituicao") } });
  await prisma.pessoa.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.dadosPessoaisAluno.deleteMany({ where: { usuarioId: aluno.id } });
  await prisma.usuario.deleteMany({ where: { id: aluno.id } });
  await prisma.turmaPeriodo.deleteMany({ where: { turmaId: id("turma") } });
  await prisma.turma.deleteMany({ where: { id: id("turma") } });
  await prisma.periodo.deleteMany({ where: { id: id("periodo") } });
  await prisma.curso.deleteMany({ where: { id: id("curso") } });
  await prisma.$disconnect();
  descartarCliente();
  vi.unstubAllEnvs();
});

async function estagioLiberado(ano: number, mes = 1) {
  const estagio = await criarEstagio(aluno, { ...dadosSolicitacaoTeste(), convenioId: id("convenio"), supervisorId: id("supervisor"), orientadorId: id("orientador"), dataInicio: `${ano}-0${mes}-03`, dataFim: `${ano}-0${mes}-28` });
  await prisma.estagio.update({ where: { id: estagio.id }, data: { situacao: "em_andamento", liberadoEm: new Date(), liberadoPorId: aluno.id } });
  return estagio;
}

const lancamento = (estagioId: string, data: string, entrada: string, saida: string, almocoDesligado = true) => ({ estagioId, data, entrada, saida, almocoDesligado });

describe("lançamentos de horas persistentes", () => {
  it("persiste lançamento válido e recusa estágio bloqueado, período, horas inválidas e limite diário", async () => {
    const estagio = await criarEstagio(aluno, { ...dadosSolicitacaoTeste(), convenioId: id("convenio"), supervisorId: id("supervisor"), orientadorId: id("orientador"), dataInicio: "2028-02-03", dataFim: "2028-02-29" });
    await expect(lancarHoras(lancamento(estagio.id, "2028-02-07", "08:00", "13:00"))).rejects.toMatchObject({ codigo: "estagio_encerrado" });
    await prisma.estagio.update({ where: { id: estagio.id }, data: { situacao: "em_andamento", liberadoEm: new Date(), liberadoPorId: aluno.id } });
    await expect(lancarHoras(lancamento(estagio.id, "2028-03-01", "08:00", "13:00"))).rejects.toMatchObject({ codigo: "data_fora_periodo" });
    await expect(lancarHoras(lancamento(estagio.id, "2028-02-07", "10:00", "10:00"))).rejects.toMatchObject({ codigo: "horas_invalidas" });
    await expect(lancarHoras(lancamento(estagio.id, "2028-02-07", "07:00", "15:00"))).rejects.toMatchObject({ codigo: "limite_diario" });
    const valido = await lancarHoras(lancamento(estagio.id, "2028-02-07", "08:00", "14:00"));
    expect(valido).toMatchObject({ estagioId: estagio.id, alunoId: aluno.id, horas: 5, tipo: "lancamento" });
    await expect(lancarHoras(lancamento(estagio.id, "2028-02-07", "14:00", "18:00"))).rejects.toMatchObject({ codigo: "limite_diario" });
    const salvo = await prisma.lancamentoHoras.findUniqueOrThrow({ where: { id: valido.id } });
    expect(salvo).toMatchObject({ estagioId: estagio.id, alunoId: aluno.id, entrada: "08:00", saida: "14:00", minutos: 300, tipo: "lancamento" });
    expect(await horasEfetivasDoDia(estagio.id, "2028-02-07")).toBe(5);
  });

  it("recusa semana acima de 30 horas e serializa lançamentos concorrentes no mesmo dia", async () => {
    const estagio = await estagioLiberado(2028, 1);
    for (const dia of ["03", "04", "05", "06", "07"]) await lancarHoras(lancamento(estagio.id, `2028-01-${dia}`, "08:00", "15:00"));
    expect(await horasDaSemana(estagio.id, "2028-01-03")).toBe(30);
    await expect(lancarHoras(lancamento(estagio.id, "2028-01-08", "08:00", "10:00"))).rejects.toMatchObject({ codigo: "limite_semanal" });

    const disputa = await estagioLiberado(2028, 3);
    const resultados = await Promise.allSettled([
      lancarHoras(lancamento(disputa.id, "2028-03-06", "08:00", "13:00")),
      lancarHoras(lancamento(disputa.id, "2028-03-06", "13:00", "18:00")),
    ]);
    expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.lancamentoHoras.count({ where: { estagioId: disputa.id } })).toBe(1);
    expect(await horasEfetivasDoDia(disputa.id, "2028-03-06")).toBeLessThanOrEqual(6);
  });
});

describe("correções imutáveis de horas", () => {
  it("preserva original e correções após descartar o cliente e calcula pela última correção", async () => {
    const estagio = await estagioLiberado(2028, 4);
    const original = await lancarHoras(lancamento(estagio.id, "2028-04-04", "08:00", "13:00"));
    const correcao = await corrigirLancamento(original.id, { entrada: "08:00", saida: "14:00", almocoDesligado: true });
    expect(correcao).toMatchObject({ tipo: "correcao", corrigeId: original.id, horas: 5 });
    expect(await totalHorasDoEstagio(estagio.id)).toBe(5);

    descartarCliente();
    const aposReinicio = await lancamentosDoEstagioAtuais(estagio.id);
    expect(aposReinicio.map((item) => item.tipo)).toEqual(["lancamento", "correcao"]);
    expect(aposReinicio.find((item) => item.id === original.id)).toMatchObject({ horas: 4 });
    expect(await horasEfetivasDoDia(estagio.id, "2028-04-04")).toBe(5);
    expect(await horasDaSemana(estagio.id, "2028-04-03")).toBe(5);
    expect(await prisma.lancamentoHoras.count({ where: { estagioId: estagio.id } })).toBe(2);
    const script = fileURLToPath(new URL("../support/consultar-horas-processo.ts", import.meta.url));
    const contexto = new URL("../support/contexto-servidor.mjs", import.meta.url).href;
    const { stdout } = await promisify(execFile)(process.execPath, ["--import", "tsx", "--import", contexto, script, estagio.id], { env: { ...process.env }, timeout: 20_000 });
    expect(JSON.parse(stdout)).toMatchObject({ total: 5, itens: [{ id: original.id, tipo: "lancamento", horas: 4 }, { id: correcao.id, tipo: "correcao", horas: 5, corrigeId: original.id }] });
    await expect(corrigirLancamento(correcao.id, { entrada: "08:00", saida: "12:00", almocoDesligado: false })).rejects.toMatchObject({ codigo: "lancamento_corrigido" });
  });

  it("mantém sequência e limite diário consistentes em correções concorrentes", async () => {
    const estagio = await estagioLiberado(2028, 5);
    const original = await lancarHoras(lancamento(estagio.id, "2028-05-08", "08:00", "13:00"));
    const disputas = await Promise.allSettled([
      corrigirLancamento(original.id, { entrada: "08:00", saida: "12:00", almocoDesligado: true }),
      corrigirLancamento(original.id, { entrada: "08:00", saida: "14:00", almocoDesligado: true }),
    ]);
    expect(disputas.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(2);
    const correcoes = await prisma.lancamentoHoras.findMany({ where: { corrigeId: original.id }, orderBy: { sequenciaCorrecao: "asc" } });
    expect(correcoes.map((item) => item.sequenciaCorrecao)).toEqual([1, 2]);
    const efetivas = await horasEfetivasDoDia(estagio.id, "2028-05-08");
    expect(efetivas).toBeLessThanOrEqual(6);
    expect(efetivas).toBe(correcoes.at(-1)!.minutos / 60);
    expect(await prisma.lancamentoHoras.count({ where: { estagioId: estagio.id } })).toBe(3);
    await prisma.estagio.update({ where: { id: estagio.id }, data: { canceladoEm: new Date() } });
    await expect(corrigirLancamento(original.id, { entrada: "08:00", saida: "12:00", almocoDesligado: false })).rejects.toMatchObject({ codigo: "estagio_encerrado" });
  });
});
