import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import * as mariadb from "mariadb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import type { Usuario } from "@/lib/domain/types";
import { descartarCliente } from "@/lib/db/prisma";
import { criarEstagio, estagioPorId } from "@/lib/services/estagios";
import { criarRascunho, documentoPorId, documentosDaCoordenacao, documentosDoAluno, documentosParaParecer, registrarParecer, salvarRascunho, submeter } from "@/lib/services/documentos";
import { confirmarAssinaturas, dadosDoPainelFluxo, enviarParaAssinaturas, reabrirParaCorrecao, solicitarEncaminhamento } from "@/lib/services/fluxo-estagio";
import { acrescentarObservacao, observacoesDoDocumento } from "@/lib/services/observacoes";
import { dadosSolicitacaoTeste } from "@/lib/fixtures/solicitacao-teste";
import * as store from "@/lib/services/store";
import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base = process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");
const prefixo = `fluxo-${crypto.randomUUID().slice(0, 8)}`;
const prisma = new PrismaClient({ adapter: new PrismaMariaDb({ host: configuracao.host, port: configuracao.porta, user: configuracao.usuario,
  password: configuracao.senha, database: configuracao.banco, connectionLimit: 2, ssl: { ca, rejectUnauthorized: true } }) });
const id = (sufixo: string) => `${prefixo}-${sufixo}`;
const entrada = (sufixo: string, papel: Usuario["papel"] = "aluno"): Usuario => ({ id: id(sufixo), nome: sufixo, email: `${id(sufixo)}@teste.local`, papel, situacao: "ativo", campus: "Pinheiral", criadoEm: "2026-11-10" });
const aluno = entrada("aluno");
const outro = entrada("outro");
const coordenador = entrada("coordenador", "coordenador_curso");
const estagiario = entrada("comissao", "coordenador_estagio");
const gatilho = `probe_parecer_${prefixo.replaceAll("-", "_")}`;
async function ddl(sql: string) {
  const conexao = await mariadb.createConnection({ socketPath: join(base, "run/mysql.sock"), user: "root", database: configuracao.banco });
  try { await conexao.query(sql); } finally { await conexao.end(); }
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
  await prisma.usuario.create({ data: { id: outro.id, nome: outro.nome, email: outro.email, situacao: "ativo", papel: "aluno" } });
  await prisma.usuario.create({ data: { id: coordenador.id, nome: coordenador.nome, email: coordenador.email, situacao: "ativo", papel: "coordenador_curso", cursoId: id("curso") } });
  await prisma.usuario.create({ data: { id: estagiario.id, nome: estagiario.nome, email: estagiario.email, situacao: "ativo", papel: "coordenador_estagio", membroComissaoEstagio: true } });
  for (const sufixo of ["aluno", "outro"]) await prisma.dadosPessoaisAluno.create({ data: {
    id: id(`dp-${sufixo}`), usuarioId: id(sufixo), cpf: "52998224725", rg: "12345678", dataNascimento: new Date("2000-01-01"), telefone: "2433334444", celular: "24999994444",
    endereco: { cep: "27197000", logradouro: "Rua do cadastro", numero: "1", bairro: "Centro", cidade: "Pinheiral", estado: "RJ" }, cursoId: id("curso"), turmaId: id("turma"), periodoId: id("periodo"),
  } });
  await prisma.instituicaoConcedente.create({ data: { id: id("instituicao"), nome: prefixo, cnpj: prefixo } });
  await prisma.convenio.create({ data: { id: id("convenio"), instituicaoId: id("instituicao"), nome: prefixo, inicioVigencia: new Date("2026-01-01"), fimVigencia: new Date("2031-01-01") } });
  for (const papel of ["supervisor", "orientador"]) await prisma.pessoa.create({ data: { id: id(papel), nome: papel, email: `${papel}@teste.local`, telefone: "2433334444", papel } });
});

afterAll(async () => {
  await ddl(`DROP TRIGGER IF EXISTS ${gatilho}`);
  vi.restoreAllMocks();
  await prisma.parecer.deleteMany({ where: { documento: { alunoId: { in: [aluno.id, outro.id] } } } });
  await prisma.submissaoDocumento.deleteMany({ where: { documento: { alunoId: { in: [aluno.id, outro.id] } } } });
  await prisma.envioExterno.deleteMany({ where: { documento: { alunoId: { in: [aluno.id, outro.id] } } } });
  await prisma.pedidoEnvioDocumento.deleteMany({ where: { documento: { alunoId: { in: [aluno.id, outro.id] } } } });
  await prisma.observacaoDocumento.deleteMany({ where: { documento: { alunoId: { in: [aluno.id, outro.id] } } } });
  await prisma.documentoPreenchido.deleteMany({ where: { alunoId: { in: [aluno.id, outro.id] } } });
  await prisma.estagioTemplate.deleteMany({ where: { estagio: { alunoId: { in: [aluno.id, outro.id] } } } });
  await prisma.estagio.deleteMany({ where: { alunoId: { in: [aluno.id, outro.id] } } });
  await prisma.convenio.deleteMany({ where: { id: id("convenio") } });
  await prisma.instituicaoConcedente.deleteMany({ where: { id: id("instituicao") } });
  await prisma.pessoa.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.dadosPessoaisAluno.deleteMany({ where: { usuarioId: { startsWith: prefixo } } });
  await prisma.usuario.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.turmaPeriodo.deleteMany({ where: { turmaId: id("turma") } });
  await prisma.turma.deleteMany({ where: { id: id("turma") } });
  await prisma.periodo.deleteMany({ where: { id: id("periodo") } });
  await prisma.curso.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.$disconnect();
  descartarCliente();
  vi.unstubAllEnvs();
});

function solicitacao(ano = 2028) {
  return { ...dadosSolicitacaoTeste(), convenioId: id("convenio"), supervisorId: id("supervisor"), orientadorId: id("orientador"), dataInicio: `${ano}-01-03`, dataFim: `${ano}-01-31` };
}

async function criarEncaminhavel(ano = 2028) {
  const estagio = await criarEstagio(aluno, solicitacao(ano));
  await solicitarEncaminhamento(estagio.id, aluno);
  return estagio;
}

describe("encaminhamento e parecer persistentes", () => {
  it("persiste submissão vigente, autor e data do encaminhamento e recusa terceiros", async () => {
    const estagio = await criarEstagio(aluno, solicitacao(2028));
    await expect(solicitarEncaminhamento(estagio.id, outro)).rejects.toMatchObject({ codigo: "acesso_negado" });
    const encaminhado = await solicitarEncaminhamento(estagio.id, aluno);
    expect(encaminhado).toMatchObject({ encaminhadoPorId: aluno.id });
    expect(encaminhado.encaminhadoEm).toBeTruthy();
    const submissao = await prisma.submissaoDocumento.findFirstOrThrow({ where: { estagioId: estagio.id } });
    expect(submissao).toMatchObject({ autorId: aluno.id, versao: 1 });
    const formulario = await prisma.documentoPreenchido.findFirstOrThrow({ where: { estagioId: estagio.id, templateId: "tpl-formulario-liberacao" } });
    expect(formulario.situacao).toBe("submetido");
    expect(await prisma.submissaoDocumento.count({ where: { documentoId: formulario.id } })).toBe(1);
    await expect(solicitarEncaminhamento(estagio.id, aluno)).rejects.toMatchObject({ codigo: "ja_encaminhado" });
    await expect(criarRascunho(aluno, "tpl-relatorio-semestral", estagio.id)).rejects.toMatchObject({ codigo: "liberacao_pendente" });
    await expect(enviarParaAssinaturas(formulario.id, aluno)).rejects.toMatchObject({ codigo: "parecer_pendente" });
    await prisma.documentoPreenchido.update({ where: { id: formulario.id }, data: { situacao: "aprovado" } });
  });

  it("recusa encaminhamento com documento inicial incompleto", async () => {
    const estagio = await criarEstagio(aluno, solicitacao(2029));
    await prisma.documentoPreenchido.updateMany({ where: { estagioId: estagio.id, templateId: "tpl-plano-atividades" }, data: { valores: {} } });
    const antes = await estagioPorId(estagio.id);
    await expect(solicitarEncaminhamento(estagio.id, aluno)).rejects.toMatchObject({ codigo: "documentacao_pendente" });
    expect(await estagioPorId(estagio.id)).toMatchObject({ encaminhadoEm: antes?.encaminhadoEm, situacao: "em_preparacao" });
    expect(await prisma.submissaoDocumento.count({ where: { estagioId: estagio.id } })).toBe(0);
  });

  it("registra parecer por fila e curso, exige situação de análise e preserva histórico em nova submissão", async () => {
    const estagio = await criarEncaminhavel(2030);
    const formulario = await prisma.documentoPreenchido.findFirstOrThrow({ where: { estagioId: estagio.id, templateId: "tpl-formulario-liberacao" } });
    await prisma.usuario.update({ where: { id: coordenador.id }, data: { cursoId: id("outro-curso") } });
    try { await expect(registrarParecer(formulario.id, "aprovado", coordenador, "ok")).rejects.toMatchObject({ codigo: "acesso_negado" }); }
    finally { await prisma.usuario.update({ where: { id: coordenador.id }, data: { cursoId: id("curso") } }); }
    await expect(registrarParecer(formulario.id, "aprovado", estagiario, "ok")).rejects.toMatchObject({ codigo: "acesso_negado" });
    const aprovado = await registrarParecer(formulario.id, "aprovado", coordenador, "Deferido.");
    expect(aprovado).toMatchObject({ situacao: "aprovado" });
    expect(aprovado.valores).toMatchObject({ planoDeAcordo: "sim", consideracoes: "Deferido." });
    const parecer = await prisma.parecer.findFirstOrThrow({ where: { documentoId: formulario.id } });
    expect(parecer).toMatchObject({ decisao: "aprovado", autorId: coordenador.id, fila: "coordenador_curso", consideracoes: "Deferido." });
    expect(await prisma.observacaoDocumento.count({ where: { documentoId: formulario.id } })).toBe(1);
    await expect(registrarParecer(formulario.id, "indeferido", coordenador, "Não")).rejects.toMatchObject({ codigo: "situacao_invalida" });
    await prisma.documentoPreenchido.update({ where: { id: formulario.id }, data: { situacao: "indeferido" } });
    const reaberto = await reabrirParaCorrecao(estagio.id, aluno);
    expect(reaberto).toMatchObject({ situacao: "rascunho", correcaoAberta: true });
    await expect(reabrirParaCorrecao(estagio.id, aluno)).rejects.toMatchObject({ codigo: "correcao_indisponivel" });
    const resubmetido = await submeter(formulario.id, aluno);
    expect(resubmetido.situacao).toBe("submetido");
    expect(await prisma.submissaoDocumento.count({ where: { documentoId: formulario.id } })).toBe(2);
    expect((await prisma.submissaoDocumento.findFirstOrThrow({ where: { documentoId: formulario.id }, orderBy: { versao: "desc" } })).versao).toBe(2);
    const novoParecer = await registrarParecer(formulario.id, "indeferido", coordenador, "Ajuste o plano.");
    expect(novoParecer.situacao).toBe("indeferido");
    expect(await prisma.parecer.count({ where: { documentoId: formulario.id } })).toBe(2);
    expect((await documentoPorId(formulario.id))?.valores).toMatchObject({ planoDeAcordo: "nao", consideracoes: "Ajuste o plano." });
  });

  it("serializa pareceres concorrentes mantendo um único parecer por transição", async () => {
    const estagio = await criarEncaminhavel(2031);
    const formulario = await prisma.documentoPreenchido.findFirstOrThrow({ where: { estagioId: estagio.id, templateId: "tpl-formulario-liberacao" } });
    const disputas = await Promise.allSettled([
      registrarParecer(formulario.id, "aprovado", coordenador, "A"),
      registrarParecer(formulario.id, "indeferido", coordenador, "B"),
    ]);
    expect(disputas.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.parecer.count({ where: { documentoId: formulario.id } })).toBe(1);
  });

  it("desfaz situação, parecer e observação quando o parecer não pode ser gravado", async () => {
    const estagio = await criarEncaminhavel(2032);
    const formulario = await prisma.documentoPreenchido.findFirstOrThrow({ where: { estagioId: estagio.id, templateId: "tpl-formulario-liberacao" } });
    await ddl(`CREATE TRIGGER ${gatilho} BEFORE INSERT ON pareceres FOR EACH ROW BEGIN IF NEW.documentoId = '${formulario.id}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'probe_parecer'; END IF; END`);
    try {
      await expect(registrarParecer(formulario.id, "aprovado", coordenador, "Falha")).rejects.toThrow();
    } finally { await ddl(`DROP TRIGGER IF EXISTS ${gatilho}`); }
    expect(await documentoPorId(formulario.id)).toMatchObject({ situacao: "submetido" });
    expect(await prisma.parecer.count({ where: { documentoId: formulario.id } })).toBe(0);
    expect(await prisma.observacaoDocumento.count({ where: { documentoId: formulario.id } })).toBe(0);
  });
});

describe("observações e conferência de assinaturas persistentes", () => {
  async function encaminhadoAprovado(ano: number) {
    const estagio = await criarEncaminhavel(ano);
    const formulario = await prisma.documentoPreenchido.findFirstOrThrow({ where: { estagioId: estagio.id, templateId: "tpl-formulario-liberacao" } });
    await registrarParecer(formulario.id, "aprovado", coordenador, "Deferido.");
    return { estagio, formulario };
  }

  async function documentosIniciais(estagioId: string) {
    return prisma.documentoPreenchido.findMany({ where: { estagioId, templateId: { in: ["tpl-formulario-liberacao", "tpl-termo-compromisso", "tpl-plano-atividades"] }, situacao: { not: "inativo" } }, orderBy: { id: "asc" } });
  }

  it("preserva observações simultâneas de cargos autorizados e recusa autor sem vínculo", async () => {
    const { estagio, formulario } = await encaminhadoAprovado(2033);
    const [primeira, segunda] = await Promise.all([
      acrescentarObservacao(formulario.id, "Conferência COIEE", estagiario),
      acrescentarObservacao(formulario.id, "Complemento do curso", coordenador),
    ]);
    expect(new Set([primeira.id, segunda.id]).size).toBe(2);
    const observacoes = (await observacoesDoDocumento(formulario.id, aluno)).map((item) => item.conteudo);
    expect(observacoes).toEqual(expect.arrayContaining(["Conferência COIEE", "Complemento do curso", "Deferido."]));
    expect(observacoes).toHaveLength(3);
    await prisma.usuario.update({ where: { id: coordenador.id }, data: { cursoId: id("outro-curso") } });
    try { await expect(acrescentarObservacao(formulario.id, "Fora do curso", coordenador)).rejects.toMatchObject({ codigo: "acesso_negado" }); }
    finally { await prisma.usuario.update({ where: { id: coordenador.id }, data: { cursoId: id("curso") } }); }
    await expect(acrescentarObservacao(estagio.alunoId === aluno.id ? formulario.id : formulario.id, "   ", estagiario)).rejects.toMatchObject({ codigo: "observacao_vazia" });
    await expect(acrescentarObservacao(formulario.id, "Tentativa", aluno)).rejects.toMatchObject({ codigo: "acesso_negado" });
    expect(await prisma.observacaoDocumento.count({ where: { documentoId: formulario.id } })).toBe(3);
    await expect(salvarRascunho(formulario.id, { enderecoLocal: "Alterado" }, aluno)).rejects.toMatchObject({ codigo: "situacao_invalida" });
  });

  it("exige cargo, parecer atual e as três confirmações antes de liberar, sem efeitos parciais", async () => {
    const { estagio, formulario } = await encaminhadoAprovado(2034);
    const docs = await documentosIniciais(estagio.id);
    const completas = docs.map((doc) => ({ documentoId: doc.id, confirmado: true }));
    await expect(confirmarAssinaturas(estagio.id, coordenador, completas)).rejects.toMatchObject({ codigo: "acesso_negado" });
    await expect(confirmarAssinaturas(estagio.id, aluno, completas)).rejects.toMatchObject({ codigo: "acesso_negado" });
    await expect(confirmarAssinaturas(estagio.id, estagiario, completas.slice(0, 2))).rejects.toMatchObject({ codigo: "assinatura_pendente" });
    await expect(confirmarAssinaturas(estagio.id, estagiario, [...completas, { documentoId: "outro-doc", confirmado: true }])).rejects.toMatchObject({ codigo: "documento_invalido" });
    expect(await prisma.estagio.findUniqueOrThrow({ where: { id: estagio.id } })).toMatchObject({ situacao: "em_preparacao", liberadoEm: null });
    expect((await documentosIniciais(estagio.id)).every((doc) => doc.assinaturasConfirmadasEm === null)).toBe(true);
    await ddl(`CREATE TRIGGER ${gatilho} BEFORE UPDATE ON documentos_preenchidos FOR EACH ROW BEGIN IF NEW.id = '${docs[2]!.id}' AND NEW.assinaturasConfirmadasPorId IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'probe_conferencia'; END IF; END`);
    try { await expect(confirmarAssinaturas(estagio.id, estagiario, completas)).rejects.toThrow(); }
    finally { await ddl(`DROP TRIGGER IF EXISTS ${gatilho}`); }
    expect(await prisma.estagio.findUniqueOrThrow({ where: { id: estagio.id } })).toMatchObject({ situacao: "em_preparacao", liberadoEm: null });
    expect((await documentosIniciais(estagio.id)).every((doc) => doc.assinaturasConfirmadasEm === null)).toBe(true);
    await prisma.estagio.update({ where: { id: estagio.id }, data: { situacao: "em_andamento", liberadoEm: new Date() } });
    const outro = await encaminhadoAprovado(2035);
    await prisma.documentoPreenchido.update({ where: { id: outro.formulario.id }, data: { situacao: "submetido" } });
    await expect(confirmarAssinaturas(outro.estagio.id, estagiario, (await documentosIniciais(outro.estagio.id)).map((doc) => ({ documentoId: doc.id, confirmado: true })))).rejects.toMatchObject({ codigo: "parecer_pendente" });
    expect((await documentoPorId(formulario.id))?.situacao).toBe("aprovado");
  });

  it("libera uma única vez sob disputa, gravando responsável, data e observações", async () => {
    const { estagio } = await encaminhadoAprovado(2036);
    const docs = await documentosIniciais(estagio.id);
    const completas = docs.map((doc) => ({ documentoId: doc.id, confirmado: true, observacao: `Conferido ${doc.templateId}` }));
    const disputas = await Promise.allSettled([
      confirmarAssinaturas(estagio.id, estagiario, completas),
      confirmarAssinaturas(estagio.id, estagiario, completas),
    ]);
    expect(disputas.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    const liberado = await prisma.estagio.findUniqueOrThrow({ where: { id: estagio.id } });
    expect(liberado).toMatchObject({ situacao: "em_andamento", liberadoPorId: estagiario.id });
    expect(liberado.liberadoEm).toBeTruthy();
    const conferidos = await documentosIniciais(estagio.id);
    expect(conferidos.every((doc) => doc.assinaturasConfirmadasPorId === estagiario.id && doc.assinaturasConfirmadasEm !== null)).toBe(true);
    expect(await prisma.observacaoDocumento.count({ where: { documentoId: { in: conferidos.map((doc) => doc.id) }, conteudo: { startsWith: "Conferido" } } })).toBe(3);
    await expect(confirmarAssinaturas(estagio.id, estagiario, completas)).rejects.toMatchObject({ codigo: "solicitacao_invalida" });
  });
});

describe("filas e resultados persistentes por situação atual", () => {
  it("remove pendência da fila após parecer e expõe o resultado ao aluno em nova consulta", async () => {
    const estagio = await criarEncaminhavel(2037);
    const formulario = await prisma.documentoPreenchido.findFirstOrThrow({ where: { estagioId: estagio.id, templateId: "tpl-formulario-liberacao" } });
    const fila = await documentosParaParecer("coordenador_curso", coordenador, { tamanho: 100 });
    expect(fila.itens.map((doc) => doc.id)).toContain(formulario.id);
    expect((await documentosParaParecer("comissao_estagio", estagiario, { tamanho: 100 })).itens).toHaveLength(0);
    await prisma.usuario.update({ where: { id: coordenador.id }, data: { cursoId: id("outro-curso") } });
    expect((await documentosParaParecer("coordenador_curso", coordenador, { tamanho: 100 })).itens.map((doc) => doc.id)).not.toContain(formulario.id);
    await prisma.usuario.update({ where: { id: coordenador.id }, data: { cursoId: id("curso") } });
    await registrarParecer(formulario.id, "aprovado", coordenador, "Deferido.");
    expect((await documentosParaParecer("coordenador_curso", coordenador, { tamanho: 100 })).itens.map((doc) => doc.id)).not.toContain(formulario.id);
    expect((await documentosDoAluno(aluno.id)).find((doc) => doc.id === formulario.id)).toMatchObject({ situacao: "aprovado" });
    expect((await documentosDoAluno(outro.id)).some((doc) => doc.id === formulario.id)).toBe(false);
    const script = fileURLToPath(new URL("../support/consultar-fila-processo.ts", import.meta.url));
    const contexto = new URL("../support/contexto-servidor.mjs", import.meta.url).href;
    const { stdout } = await promisify(execFile)(process.execPath, ["--import", "tsx", "--import", contexto, script, coordenador.id, formulario.id], { env: { ...process.env }, timeout: 20_000 });
    expect(JSON.parse(stdout)).toMatchObject({ contem: false });
  });

  it("recorta documentos por curso/campus e busca sem vazar outro aluno", async () => {
    const estagio = await criarEncaminhavel(2038);
    const lista = await documentosDaCoordenacao(coordenador, { tamanho: 1000 });
    expect(lista.itens.every((doc) => doc.alunoId === aluno.id)).toBe(true);
    expect(lista.total).toBe(await prisma.documentoPreenchido.count({ where: { alunoId: aluno.id } }));
    const busca = await documentosDaCoordenacao(coordenador, { busca: "aluno", tamanho: 1000 });
    expect(busca.itens.length).toBeGreaterThan(0);
    expect((await documentosDaCoordenacao(coordenador, { busca: "inexistente-xyz", tamanho: 1000 })).total).toBe(0);
    await prisma.usuario.update({ where: { id: coordenador.id }, data: { cursoId: id("outro-curso") } });
    expect((await documentosDaCoordenacao(coordenador, { tamanho: 1000 })).total).toBe(0);
    await prisma.usuario.update({ where: { id: coordenador.id }, data: { cursoId: id("curso") } });
    await prisma.estagio.update({ where: { id: estagio.id }, data: { excluidoEm: new Date(), cursoIdHistorico: id("curso") } });
    try {
      expect((await documentosDaCoordenacao(coordenador, { tamanho: 1000 })).itens.some((doc) => doc.estagioId === estagio.id)).toBe(true);
      await prisma.usuario.update({ where: { id: coordenador.id }, data: { situacao: "inativo" } });
      expect((await documentosDaCoordenacao(coordenador, { tamanho: 1000 })).total).toBe(0);
    } finally {
      await prisma.usuario.update({ where: { id: coordenador.id }, data: { situacao: "ativo" } });
      await prisma.estagio.update({ where: { id: estagio.id }, data: { excluidoEm: null } });
    }
  });

  it("painel do fluxo lê pareceres e observações persistidos apenas do estágio autorizado", async () => {
    const { estagio, formulario } = await (async () => {
      const criado = await criarEncaminhavel(2039);
      const doc = await prisma.documentoPreenchido.findFirstOrThrow({ where: { estagioId: criado.id, templateId: "tpl-formulario-liberacao" } });
      await registrarParecer(doc.id, "aprovado", coordenador, "Deferido.");
      return { estagio: criado, formulario: doc };
    })();
    const painel = await dadosDoPainelFluxo(aluno, [estagio.id]);
    expect(painel.pareceres.some((parecer) => parecer.documentoId === formulario.id && parecer.decisao === "aprovado")).toBe(true);
    expect(painel.observacoes.some((obs) => obs.documentoId === formulario.id && obs.conteudo === "Deferido.")).toBe(true);
    expect(painel.nomesAutores[coordenador.id]).toBe(coordenador.nome);
    expect(painel.envios).toHaveLength(0);
    await expect(dadosDoPainelFluxo(outro, [estagio.id])).rejects.toMatchObject({ codigo: "acesso_negado" });
  });
});

describe("envio documental persistente", () => {
  it("recusa envio antecipado e registra tentativas sem transporte sem comprovar assinatura ou liberar", async () => {
    const estagio = await criarEncaminhavel(2040);
    const formulario = await prisma.documentoPreenchido.findFirstOrThrow({ where: { estagioId: estagio.id, templateId: "tpl-formulario-liberacao" } });
    await expect(enviarParaAssinaturas(formulario.id, aluno)).rejects.toMatchObject({ codigo: "parecer_pendente" });
    expect(await prisma.envioExterno.count({ where: { documentoId: formulario.id } })).toBe(0);
    expect(await prisma.pedidoEnvioDocumento.count({ where: { documentoId: formulario.id } })).toBe(0);
    await registrarParecer(formulario.id, "aprovado", coordenador, "Deferido.");

    const envios = await enviarParaAssinaturas(formulario.id, aluno);
    expect(envios.length).toBeGreaterThan(0);
    expect(envios.every((envio) => envio.status === "falha" && envio.erro?.includes("Integração de envio de anexos indisponível"))).toBe(true);
    expect(new Set(envios.map((envio) => envio.tentativa)).size).toBe(envios.length);
    const pedido = await prisma.pedidoEnvioDocumento.findFirstOrThrow({ where: { documentoId: formulario.id } });
    expect(pedido).toMatchObject({ pedidoPorId: aluno.id, situacao: "indisponivel" });
    expect(pedido.motivo).toContain("Integração de envio de anexos indisponível");
    const linhas = await prisma.envioExterno.findMany({ where: { documentoId: formulario.id }, orderBy: { tentativa: "asc" } });
    expect(linhas).toHaveLength(envios.length);
    expect(linhas.every((linha) => linha.autorId === aluno.id && linha.pedidoId === pedido.id && linha.status === "falha")).toBe(true);
    expect(linhas.some((linha) => linha.destinatarioEmail === aluno.email)).toBe(true);
    const documento = await prisma.documentoPreenchido.findUniqueOrThrow({ where: { id: formulario.id } });
    expect(documento.assinaturasConfirmadasEm).toBeNull();
    expect(documento.assinaturasConfirmadasPorId).toBeNull();
    const estagioAtual = await prisma.estagio.findUniqueOrThrow({ where: { id: estagio.id } });
    expect(estagioAtual).toMatchObject({ situacao: "em_preparacao", liberadoEm: null });
    const painel = await dadosDoPainelFluxo(aluno, [estagio.id]);
    expect(painel.envios.map((envio) => envio.id).sort()).toEqual(linhas.map((linha) => linha.id).sort());
  });

  it("reenvio preserva tentativas anteriores e pedidos registrados", async () => {
    const estagio = await criarEncaminhavel(2041);
    const formulario = await prisma.documentoPreenchido.findFirstOrThrow({ where: { estagioId: estagio.id, templateId: "tpl-formulario-liberacao" } });
    await registrarParecer(formulario.id, "aprovado", coordenador, "Deferido.");
    const primeira = await enviarParaAssinaturas(formulario.id, aluno);
    const segunda = await enviarParaAssinaturas(formulario.id, aluno);
    expect(primeira.length).toBeGreaterThan(0);
    expect(segunda.length).toBe(primeira.length);
    expect(Math.min(...segunda.map((envio) => envio.tentativa))).toBeGreaterThan(Math.max(...primeira.map((envio) => envio.tentativa)));
    expect(await prisma.envioExterno.count({ where: { documentoId: formulario.id } })).toBe(primeira.length + segunda.length);
    expect(await prisma.pedidoEnvioDocumento.count({ where: { documentoId: formulario.id } })).toBe(2);
    const anteriores = await prisma.envioExterno.findMany({ where: { id: { in: primeira.map((envio) => envio.id) } } });
    expect(anteriores).toHaveLength(primeira.length);
    expect(anteriores.every((linha) => linha.status === "falha")).toBe(true);
  });
});
