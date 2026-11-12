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
import { cancelarSolicitacao, criarEstagio, estagioPorId, excluirEstagio, exclusaoPendenteDoEstagio, solicitarExclusaoEstagio } from "@/lib/services/estagios";
import { solicitarEncaminhamento } from "@/lib/services/fluxo-estagio";
import { documentosDaCoordenacaoPersistente } from "@/lib/services/fluxo-consultas-persistentes";
import * as store from "@/lib/services/store";
import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";
import { criarExecutorDdl } from "./ddl";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base = process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");
const prefixo = `exclusao-${crypto.randomUUID().slice(0, 8)}`;
const prisma = new PrismaClient({ adapter: new PrismaMariaDb({ host: configuracao.host, port: configuracao.porta, user: configuracao.usuario,
  password: configuracao.senha, database: configuracao.banco, connectionLimit: 4, ssl: { ca, rejectUnauthorized: true } }) });
const ddl = criarExecutorDdl(configuracao);
const gatilho = `probe_exclusao_${prefixo.replaceAll("-", "_")}`;
const id = (sufixo: string) => `${prefixo}-${sufixo}`;
const entrada = (sufixo: string, papel: Usuario["papel"], cursoId?: string): Usuario => ({
  id: id(sufixo), nome: `Nome ${sufixo}`, email: `${id(sufixo)}@teste.local`, papel, situacao: "ativo", campus: "Pinheiral", criadoEm: "2026-11-12", cursoId,
});
const aluno = entrada("aluno", "aluno");
const coordenador = entrada("coord-curso", "coordenador_curso", id("curso"));
const coordenadorOutro = entrada("coord-outro", "coordenador_curso", id("outro-curso"));

async function consultarEmOutroProcesso(estagioId: string, sufixo: string) {
  const script = fileURLToPath(new URL("../support/consultar-estagio-processo.ts", import.meta.url));
  const contexto = new URL("../support/contexto-servidor.mjs", import.meta.url).href;
  const administrador = entrada(sufixo, "administrador");
  await prisma.usuario.create({ data: { id: administrador.id, nome: administrador.nome, email: administrador.email, situacao: "ativo", papel: "administrador" } });
  try {
    const { stdout } = await promisify(execFile)(process.execPath, ["--import", "tsx", "--import", contexto, script, administrador.id, estagioId],
      { env: { ...process.env, DATABASE_URL: configuracao.url, SELIC_DB_CA_CERT: ca, SELIC_PERSISTENCIA: "persistente" }, timeout: 30_000 });
    return JSON.parse(stdout).detalhe as { id: string; canceladoEm?: string; excluidoEm?: string };
  } finally {
    await prisma.usuario.delete({ where: { id: administrador.id } });
  }
}

function solicitacao(ano: number) {
  return { ...dadosSolicitacaoTeste(), convenioId: id("convenio"), supervisorId: id("supervisor"), orientadorId: id("orientador"), dataInicio: `${ano}-01-03`, dataFim: `${ano}-01-31` };
}

beforeAll(async () => {
  vi.stubEnv("SELIC_PERSISTENCIA", "persistente");
  vi.stubEnv("DATABASE_URL", configuracao.url);
  vi.stubEnv("SELIC_DB_CA_CERT", ca);
  vi.spyOn(store, "obterEstado").mockImplementation(() => { throw new Error("Fixtures proibidas neste fluxo."); });

  for (const sufixo of ["curso", "outro-curso"]) await prisma.curso.create({ data: { id: id(sufixo), nome: id(sufixo), codigo: id(sufixo) } });
  await prisma.periodo.create({ data: { id: id("periodo"), rotulo: "2026.2", ano: 2026, semestre: 2 } });
  await prisma.turma.create({ data: { id: id("turma"), nome: id("turma"), cursoId: id("curso") } });
  await prisma.turmaPeriodo.create({ data: { turmaId: id("turma"), periodoId: id("periodo") } });
  await prisma.usuario.create({ data: { id: aluno.id, nome: aluno.nome, email: aluno.email, situacao: "ativo", papel: "aluno" } });
  await prisma.usuario.create({ data: { id: coordenador.id, nome: coordenador.nome, email: coordenador.email, situacao: "ativo", papel: "coordenador_curso", cursoId: id("curso") } });
  await prisma.usuario.create({ data: { id: coordenadorOutro.id, nome: coordenadorOutro.nome, email: coordenadorOutro.email, situacao: "ativo", papel: "coordenador_curso", cursoId: id("outro-curso") } });
  await prisma.dadosPessoaisAluno.create({ data: {
    id: id("dp-aluno"), usuarioId: aluno.id, cpf: "52998224725", rg: "12345678", dataNascimento: new Date("2000-01-01"), telefone: "2433334444", celular: "24999994444",
    endereco: { cep: "27197000", logradouro: "Rua do cadastro", numero: "1", bairro: "Centro", cidade: "Pinheiral", estado: "RJ" }, cursoId: id("curso"), turmaId: id("turma"), periodoId: id("periodo"),
  } });
  await prisma.instituicaoConcedente.create({ data: { id: id("instituicao"), nome: prefixo, cnpj: prefixo } });
  await prisma.convenio.create({ data: { id: id("convenio"), instituicaoId: id("instituicao"), nome: prefixo, inicioVigencia: new Date("2026-01-01"), fimVigencia: new Date("2031-01-01") } });
  for (const papel of ["supervisor", "orientador"]) await prisma.pessoa.create({ data: { id: id(papel), nome: papel, email: `${id(papel)}@teste.local`, telefone: "2433334444", papel } });
});

afterAll(async () => {
  await ddl(`DROP TRIGGER IF EXISTS ${gatilho}`);
  vi.restoreAllMocks();
  const alunos = { in: [aluno.id] };
  await prisma.solicitacaoExclusaoEstagio.deleteMany({ where: { estagio: { alunoId: alunos } } });
  await prisma.observacaoDocumento.deleteMany({ where: { documento: { alunoId: alunos } } });
  await prisma.submissaoDocumento.deleteMany({ where: { documento: { alunoId: alunos } } });
  await prisma.envioExterno.deleteMany({ where: { documento: { alunoId: alunos } } });
  await prisma.pedidoEnvioDocumento.deleteMany({ where: { documento: { alunoId: alunos } } });
  await prisma.documentoPreenchido.deleteMany({ where: { alunoId: alunos } });
  await prisma.estagioTemplate.deleteMany({ where: { estagio: { alunoId: alunos } } });
  await prisma.estagio.deleteMany({ where: { alunoId: alunos } });
  await prisma.convenio.deleteMany({ where: { id: id("convenio") } });
  await prisma.instituicaoConcedente.deleteMany({ where: { id: id("instituicao") } });
  await prisma.pessoa.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.dadosPessoaisAluno.deleteMany({ where: { usuarioId: aluno.id } });
  await prisma.usuario.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.turmaPeriodo.deleteMany({ where: { turmaId: id("turma") } });
  await prisma.turma.deleteMany({ where: { id: id("turma") } });
  await prisma.periodo.deleteMany({ where: { id: id("periodo") } });
  await prisma.curso.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.$disconnect();
  descartarCliente();
  vi.unstubAllEnvs();
});

describe("cancelamento e exclusão de estágio persistidos", () => {
  it("cancelamento em preparação persiste, impede continuidade e é recusado para terceiros", async () => {
    const estagio = await criarEstagio(aluno, solicitacao(2028));
    await expect(cancelarSolicitacao(estagio.id, coordenador)).rejects.toMatchObject({ codigo: "acesso_negado" });
    const cancelado = await cancelarSolicitacao(estagio.id, aluno);
    expect(cancelado).toMatchObject({ id: estagio.id, situacao: "em_preparacao" });
    expect(cancelado.canceladoEm).toBeTruthy();
    expect(cancelado.excluidoEm).toBeTruthy();
    expect(await prisma.estagio.findUniqueOrThrow({ where: { id: estagio.id } })).toMatchObject({ canceladoEm: expect.any(Date), nomeAlunoHistorico: aluno.nome });
    await expect(solicitarEncaminhamento(estagio.id, aluno)).rejects.toThrow();
    expect(await consultarEmOutroProcesso(estagio.id, "admin-cancel")).toMatchObject({ id: estagio.id, canceladoEm: expect.any(String), excluidoEm: expect.any(String) });
    expect(await prisma.submissaoDocumento.count({ where: { estagioId: estagio.id } })).toBe(0);
  });

  it("coordenador de outro curso é recusado e o do curso exclui com responsável e data registrados", async () => {
    const estagio = await criarEstagio(aluno, solicitacao(2029));
    await expect(excluirEstagio(estagio.id, coordenadorOutro)).rejects.toMatchObject({ codigo: "acesso_negado" });
    expect(await estagioPorId(estagio.id)).toMatchObject({ excluidoEm: undefined });

    const excluido = await excluirEstagio(estagio.id, coordenador);
    expect(excluido.excluidoEm).toBeTruthy();
    const registro = await prisma.solicitacaoExclusaoEstagio.findFirstOrThrow({ where: { estagioId: estagio.id } });
    expect(registro).toMatchObject({ solicitanteId: coordenador.id, situacao: "autorizado", decididoPorId: coordenador.id });
    expect(registro.decididoEm).toBeTruthy();
  });

  it("documentos inativados permanecem na consulta histórica do curso e somem para outro curso", async () => {
    const estagio = await criarEstagio(aluno, solicitacao(2035));
    await excluirEstagio(estagio.id, coordenador);
    const doCurso = await documentosDaCoordenacaoPersistente(coordenador, { tamanho: 1000 });
    expect(doCurso.itens.filter((documento) => documento.estagioId === estagio.id).length).toBeGreaterThan(0);
    expect(doCurso.itens.filter((documento) => documento.estagioId === estagio.id).every((documento) => documento.situacao === "inativo")).toBe(true);
    const deOutroCurso = await documentosDaCoordenacaoPersistente(coordenadorOutro, { tamanho: 1000 });
    expect(deOutroCurso.itens.some((documento) => documento.estagioId === estagio.id)).toBe(false);
  });

  it("exclusão inativa documentos, remove dados pessoais do contexto e mantém o perfil do aluno", async () => {
    const estagio = await criarEstagio(aluno, solicitacao(2030));
    await excluirEstagio(estagio.id, aluno);
    const documentos = await prisma.documentoPreenchido.findMany({ where: { estagioId: estagio.id } });
    expect(documentos.length).toBeGreaterThan(0);
    for (const documento of documentos) {
      expect(documento).toMatchObject({ situacao: "inativo", inativadoEm: expect.any(Date) });
      expect(documento.valores).not.toHaveProperty("cpf");
    }
    expect(await prisma.usuario.findUniqueOrThrow({ where: { id: aluno.id } })).toMatchObject({ situacao: "ativo" });
    expect(await prisma.dadosPessoaisAluno.findUnique({ where: { usuarioId: aluno.id } })).not.toBeNull();
  });

  it("exclusões concorrentes do mesmo estágio não duplicam efeitos", async () => {
    const estagio = await criarEstagio(aluno, solicitacao(2031));
    const resultados = await Promise.allSettled([excluirEstagio(estagio.id, coordenador), excluirEstagio(estagio.id, coordenador), excluirEstagio(estagio.id, aluno)]);
    expect(resultados.filter((r) => r.status === "fulfilled").length).toBeGreaterThan(0);
    expect(await prisma.solicitacaoExclusaoEstagio.count({ where: { estagioId: estagio.id, situacao: "autorizado" } })).toBe(1);
    expect(await prisma.estagio.findUniqueOrThrow({ where: { id: estagio.id } })).toMatchObject({ excluidoEm: expect.any(Date) });
  });

  it("falha durante a exclusão desfaz estágio e documentos", async () => {
    const estagio = await criarEstagio(aluno, solicitacao(2032));
    const antes = await prisma.documentoPreenchido.findMany({ where: { estagioId: estagio.id }, select: { id: true, situacao: true, valores: true } });
    const estagioAntes = await prisma.estagio.findUniqueOrThrow({ where: { id: estagio.id } });
    await ddl(`CREATE TRIGGER ${gatilho} BEFORE INSERT ON solicitacoes_exclusao_estagio FOR EACH ROW BEGIN IF NEW.estagioId = '${estagio.id}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'probe_exclusao'; END IF; END`);
    try {
      await expect(excluirEstagio(estagio.id, coordenador)).rejects.toThrow(/probe_exclusao/);
    } finally { await ddl(`DROP TRIGGER IF EXISTS ${gatilho}`); }
    expect(await prisma.estagio.findUniqueOrThrow({ where: { id: estagio.id } })).toMatchObject({ excluidoEm: null, nomeAlunoHistorico: estagioAntes.nomeAlunoHistorico });
    const depois = await prisma.documentoPreenchido.findMany({ where: { estagioId: estagio.id }, select: { id: true, situacao: true, valores: true } });
    expect(depois.map((d) => d.situacao)).toEqual(antes.map((d) => d.situacao));
    expect(depois.map((d) => d.valores)).toEqual(antes.map((d) => d.valores));
  });

  it("pedido de exclusão pelo aluno é único por estágio e é visível como pendente", async () => {
    const estagio = await criarEstagio(aluno, solicitacao(2033));
    const primeiro = await solicitarExclusaoEstagio(estagio.id, aluno.id, "Mudança de empresa");
    const segundo = await solicitarExclusaoEstagio(estagio.id, aluno.id, "Repetido");
    expect(segundo.id).toBe(primeiro.id);
    expect(await exclusaoPendenteDoEstagio(estagio.id)).toBe(true);
    expect(await prisma.solicitacaoExclusaoEstagio.count({ where: { estagioId: estagio.id } })).toBe(1);
  });

  it("exclusão feita em outro processo Node é observada pela consulta por ID", async () => {
    const estagio = await criarEstagio(aluno, solicitacao(2034));
    await excluirEstagio(estagio.id, coordenador);
    expect(await consultarEmOutroProcesso(estagio.id, "admin-exclusao")).toMatchObject({ id: estagio.id, excluidoEm: expect.any(String) });
  });
});
