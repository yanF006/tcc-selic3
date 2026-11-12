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
import { dadosSolicitacaoTeste } from "@/lib/fixtures/solicitacao-teste";
import { listarConvenios, convenioPorId } from "@/lib/services/catalogo";
import { consultarEstagios, criarEstagio, estagioPorId } from "@/lib/services/estagios";
import * as store from "@/lib/services/store";
import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base = process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");
const prefixo = `expirado-${crypto.randomUUID().slice(0, 8)}`;
const prisma = new PrismaClient({ adapter: new PrismaMariaDb({ host: configuracao.host, port: configuracao.porta, user: configuracao.usuario,
  password: configuracao.senha, database: configuracao.banco, connectionLimit: 2, ssl: { ca, rejectUnauthorized: true } }) });
const id = (sufixo: string) => `${prefixo}-${sufixo}`;
const aluno: Usuario = { id: id("aluno"), nome: "Aluno histórico", email: `${id("aluno")}@teste.local`, papel: "aluno", situacao: "ativo", campus: "Pinheiral", criadoEm: "2026-11-12" };
const administrador: Usuario = { id: id("admin"), nome: "Admin", email: `${id("admin")}@teste.local`, papel: "administrador", situacao: "ativo", campus: "Pinheiral", criadoEm: "2026-11-12" };

function solicitacao() {
  return { ...dadosSolicitacaoTeste(), convenioId: id("convenio"), supervisorId: id("supervisor"), orientadorId: id("orientador"), dataInicio: "2028-01-03", dataFim: "2028-01-31" };
}

beforeAll(async () => {
  vi.stubEnv("SELIC_PERSISTENCIA", "persistente");
  vi.stubEnv("DATABASE_URL", configuracao.url);
  vi.stubEnv("SELIC_DB_CA_CERT", ca);
  vi.spyOn(store, "obterEstado").mockImplementation(() => { throw new Error("Fixtures proibidas neste fluxo."); });

  await prisma.curso.create({ data: { id: id("curso"), nome: id("curso"), codigo: id("curso") } });
  await prisma.periodo.create({ data: { id: id("periodo"), rotulo: "2026.2", ano: 2026, semestre: 2 } });
  await prisma.turma.create({ data: { id: id("turma"), nome: id("turma"), cursoId: id("curso") } });
  await prisma.turmaPeriodo.create({ data: { turmaId: id("turma"), periodoId: id("periodo") } });
  await prisma.usuario.create({ data: { id: aluno.id, nome: aluno.nome, email: aluno.email, situacao: "ativo", papel: "aluno" } });
  await prisma.usuario.create({ data: { id: administrador.id, nome: administrador.nome, email: administrador.email, situacao: "ativo", papel: "administrador" } });
  await prisma.dadosPessoaisAluno.create({ data: {
    id: id("dp-aluno"), usuarioId: aluno.id, cpf: "52998224725", rg: "12345678", dataNascimento: new Date("2000-01-01"), telefone: "2433334444", celular: "24999994444",
    endereco: { cep: "27197000", logradouro: "Rua do cadastro", numero: "1", bairro: "Centro", cidade: "Pinheiral", estado: "RJ" }, cursoId: id("curso"), turmaId: id("turma"), periodoId: id("periodo"),
  } });
  await prisma.instituicaoConcedente.create({ data: { id: id("instituicao"), nome: prefixo, cnpj: prefixo } });
  await prisma.convenio.create({ data: { id: id("convenio"), instituicaoId: id("instituicao"), nome: prefixo, inicioVigencia: new Date("2026-01-01"), fimVigencia: new Date("2031-01-01") } });
  for (const papel of ["supervisor", "orientador"]) await prisma.pessoa.create({ data: { id: id(papel), nome: papel, email: `${id(papel)}@teste.local`, telefone: "2433334444", papel } });
});

afterAll(async () => {
  vi.restoreAllMocks();
  await prisma.observacaoDocumento.deleteMany({ where: { documento: { alunoId: aluno.id } } });
  await prisma.submissaoDocumento.deleteMany({ where: { documento: { alunoId: aluno.id } } });
  await prisma.documentoPreenchido.deleteMany({ where: { alunoId: aluno.id } });
  await prisma.estagioTemplate.deleteMany({ where: { estagio: { alunoId: aluno.id } } });
  await prisma.estagio.deleteMany({ where: { alunoId: aluno.id } });
  await prisma.convenio.deleteMany({ where: { id: id("convenio") } });
  await prisma.instituicaoConcedente.deleteMany({ where: { id: id("instituicao") } });
  await prisma.pessoa.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.dadosPessoaisAluno.deleteMany({ where: { usuarioId: aluno.id } });
  await prisma.usuario.deleteMany({ where: { id: { in: [aluno.id, administrador.id] } } });
  await prisma.turmaPeriodo.deleteMany({ where: { turmaId: id("turma") } });
  await prisma.turma.deleteMany({ where: { id: id("turma") } });
  await prisma.periodo.deleteMany({ where: { id: id("periodo") } });
  await prisma.curso.deleteMany({ where: { id: id("curso") } });
  await prisma.$disconnect();
  descartarCliente();
  vi.unstubAllEnvs();
});

describe("estágio histórico com convênio expirado", () => {
  it("mantém o estágio consultável após o convênio vencer e o retira das opções de seleção", async () => {
    const estagio = await criarEstagio(aluno, solicitacao());
    expect(estagio).toMatchObject({ convenioId: id("convenio") });

    await prisma.convenio.update({ where: { id: id("convenio") }, data: { inicioVigencia: new Date("2019-01-01"), fimVigencia: new Date("2020-01-01") } });

    const ativos = await listarConvenios({ busca: prefixo, situacao: "ativo", tamanho: 100 });
    expect(ativos.itens.map((item) => item.id)).not.toContain(id("convenio"));
    expect(await convenioPorId(id("convenio"))).toMatchObject({ id: id("convenio"), fimVigencia: "2020-01-01" });

    expect(await estagioPorId(estagio.id)).toMatchObject({ id: estagio.id, convenioId: id("convenio") });
    const historico = await consultarEstagios(aluno, { busca: estagio.id });
    expect(historico.itens.map((item) => item.id)).toContain(estagio.id);
  });

  it("consulta o estágio e o convênio expirado a partir de outro processo Node", async () => {
    const script = fileURLToPath(new URL("../support/consultar-estagio-processo.ts", import.meta.url));
    const contexto = new URL("../support/contexto-servidor.mjs", import.meta.url).href;
    const estagio = await prisma.estagio.findFirstOrThrow({ where: { alunoId: aluno.id } });
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "--import", contexto, script, administrador.id, estagio.id],
      { env: { ...process.env, DATABASE_URL: configuracao.url, SELIC_DB_CA_CERT: ca, SELIC_PERSISTENCIA: "persistente" }, timeout: 30_000 },
    );
    const resultado = JSON.parse(stdout);
    expect(resultado.lista.itens.map((item: { id: string }) => item.id)).toContain(estagio.id);
    expect(resultado.detalhe).toMatchObject({ id: estagio.id, convenioId: id("convenio") });
    expect(await convenioPorId(id("convenio"))).toMatchObject({ fimVigencia: "2020-01-01" });
  });
});
