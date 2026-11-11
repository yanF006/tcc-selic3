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
import { criarRascunho, salvarRascunho, documentoPorId, descritorDoDocumento, podeConsultarDocumento, documentosDoAluno } from "@/lib/services/documentos";
import { criarEstagio, consultarEstagios, editarEstagio, concluirEstagio, reabrirEstagio, selecionarDocumentos, removerDocumentoEstagio, estagioPorId, podeConsultarEstagio, exigirAcessoEstagio, totalHorasDoEstagio } from "@/lib/services/estagios";
import { dadosSolicitacaoTeste } from "@/lib/fixtures/solicitacao-teste";
import * as manifesto from "@/lib/templates/manifesto";
import * as store from "@/lib/services/store";
import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base = process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");
const prefixo = `docs-${crypto.randomUUID().slice(0, 8)}`;
const prisma = new PrismaClient({ adapter: new PrismaMariaDb({ host: configuracao.host, port: configuracao.porta, user: configuracao.usuario,
  password: configuracao.senha, database: configuracao.banco, connectionLimit: 2, ssl: { ca, rejectUnauthorized: true } }) });
const id = (sufixo: string) => `${prefixo}-${sufixo}`;
const autor = (sufixo: string, papel: Usuario["papel"] = "aluno"): Usuario => ({ id: id(sufixo), nome: sufixo, email: `${id(sufixo)}@teste.local`, papel, situacao: "ativo", campus: "Pinheiral", criadoEm: "2026-11-10" });
const aluno = autor("aluno");
const outro = autor("outro");
const gatilho = `probe_${prefixo.replaceAll("-", "_")}`;
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
  for (const sufixo of ["aluno", "outro", "coordenador", "admin"]) await prisma.usuario.create({ data: {
    id: id(sufixo), nome: id(sufixo), email: `${id(sufixo)}@teste.local`, situacao: "ativo",
    papel: sufixo === "coordenador" ? "coordenador_curso" : sufixo === "admin" ? "administrador" : "aluno",
    cursoId: sufixo === "coordenador" ? id("outro-curso") : null,
  } });
  for (const sufixo of ["aluno", "outro"]) await prisma.dadosPessoaisAluno.create({ data: {
    id: id(`dp-${sufixo}`), usuarioId: id(sufixo), cpf: "52998224725", rg: "12345678", dataNascimento: new Date("2000-01-01"), telefone: "2433334444", celular: "24999994444",
    endereco: { cep: "27197000", logradouro: "Rua do cadastro", numero: "1", bairro: "Centro", cidade: "Pinheiral", estado: "RJ" }, cursoId: id("curso"), turmaId: id("turma"), periodoId: id("periodo"),
  } });
  await prisma.instituicaoConcedente.create({ data: { id: id("instituicao"), nome: prefixo, cnpj: prefixo } });
  await prisma.convenio.create({ data: { id: id("convenio"), instituicaoId: id("instituicao"), nome: prefixo, inicioVigencia: new Date("2026-01-01"), fimVigencia: new Date("2031-01-01") } });
  for (const papel of ["supervisor", "orientador"]) await prisma.pessoa.create({ data: { id: id(papel), nome: papel, email: `${papel}@teste.local`, telefone: "2433334444", papel } });
  for (const sufixo of ["aluno", "outro"]) await prisma.estagio.create({ data: {
    id: id(`est-${sufixo}`), alunoId: id(sufixo), convenioId: id("convenio"), supervisorId: id("supervisor"), orientadorId: id("orientador"),
    dataInicio: new Date("2026-01-01"), dataFim: new Date("2027-12-31"), situacao: "em_andamento", liberadoEm: new Date(),
    templates: { create: { templateId: "tpl-relatorio-semestral" } },
  } });
});
afterAll(async () => {
  await ddl(`DROP TRIGGER IF EXISTS ${gatilho}`);
  vi.restoreAllMocks();
  await prisma.lancamentoHoras.deleteMany({ where: { alunoId: { in: [aluno.id, outro.id] } } });
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

async function criarEm(ano: number) {
  return criarEstagio(aluno, { ...solicitacao(), dataInicio: `${ano}-01-03`, dataFim: `${ano}-01-31` });
}

describe("consulta e edição autorizadas de estágios persistentes", () => {
  it("recorta lista e total antes da paginação, inclusive por curso atual e histórico", async () => {
    const novo = await criarEm(2032);
    await prisma.dadosPessoaisAluno.update({ where: { usuarioId: outro.id }, data: { cursoId: id("outro-curso") } });
    await prisma.usuario.update({ where: { id: id("coordenador") }, data: { cursoId: id("curso") } });
    try {
      const doAluno = await consultarEstagios({ ...aluno, papel: "administrador" }, { tamanho: 1, pagina: 2 });
      expect(doAluno.total).toBe(await prisma.estagio.count({ where: { alunoId: aluno.id } }));
      expect(doAluno.itens.every((estagio) => estagio.alunoId === aluno.id)).toBe(true);
      const curso = await consultarEstagios(autor("coordenador", "administrador"), { tamanho: 100 });
      expect(curso.itens.every((estagio) => estagio.alunoId === aluno.id)).toBe(true);
      expect(curso.total).toBe(doAluno.total);
      expect((await consultarEstagios(aluno, { busca: novo.id })).itens.map((estagio) => estagio.id)).toEqual([novo.id]);
      await expect(exigirAcessoEstagio(outro, novo.id)).rejects.toMatchObject({ codigo: "acesso_negado" });
      await prisma.estagio.update({ where: { id: id("est-outro") }, data: { excluidoEm: new Date(), cursoIdHistorico: id("curso") } });
      expect((await consultarEstagios(autor("coordenador"), { tamanho: 100 })).itens.map((estagio) => estagio.id)).toContain(id("est-outro"));
      await prisma.usuario.update({ where: { id: id("coordenador") }, data: { situacao: "inativo" } });
      expect(await consultarEstagios(autor("coordenador"))).toMatchObject({ total: 0, itens: [] });
    } finally {
      await prisma.usuario.update({ where: { id: id("coordenador") }, data: { situacao: "ativo" } });
      await prisma.dadosPessoaisAluno.update({ where: { usuarioId: outro.id }, data: { cursoId: id("curso") } });
      await prisma.estagio.update({ where: { id: id("est-outro") }, data: { excluidoEm: null } });
    }
  });

  it("permite correção inicial apenas após indeferimento, preservando parecer e snapshot", async () => {
    const estagio = await criarEm(2033);
    await expect(editarEstagio(estagio.id, { dataFim: "2033-02-01" }, aluno.id)).rejects.toMatchObject({ codigo: "dados_iniciais_bloqueados" });
    await expect(editarEstagio(estagio.id, { situacao: "em_andamento" }, id("coordenador"))).rejects.toMatchObject({ codigo: "situacao_nao_permitida" });
    const formulario = await prisma.documentoPreenchido.findFirstOrThrow({ where: { estagioId: estagio.id, templateId: "tpl-formulario-liberacao" } });
    await prisma.documentoPreenchido.update({ where: { id: formulario.id }, data: { situacao: "indeferido", valores: { ...(formulario.valores as object), consideracoes: "Corrigir dados", planoDeAcordo: "nao" } } });
    const editado = await editarEstagio(estagio.id, { dataFim: "2033-02-01", cargaHorariaPrevista: 121, valoresDocumentos: { "tpl-formulario-liberacao": { consideracoes: "forjado", planoDeAcordo: "sim", logradouroAluno: "Rua corrigida", numeroAluno: "20" } } }, aluno.id);
    expect(editado).toMatchObject({ dataFim: "2033-02-01", editadoPorId: aluno.id, cargaHorariaPrevista: 121 });
    const script = fileURLToPath(new URL("../support/consultar-estagio-processo.ts", import.meta.url));
    const contexto = new URL("../support/contexto-servidor.mjs", import.meta.url).href;
    const { stdout } = await promisify(execFile)(process.execPath, ["--import", "tsx", "--import", contexto, script, aluno.id, estagio.id], { env: { ...process.env }, timeout: 20_000 });
    expect(JSON.parse(stdout)).toMatchObject({ lista: { total: 1, itens: [expect.objectContaining({ id: estagio.id, dataFim: "2033-02-01" })] }, detalhe: { id: estagio.id, cargaHorariaPrevista: 121, editadoPorId: aluno.id } });
    const salvo = await documentoPorId(formulario.id);
    expect(salvo).toMatchObject({ situacao: "rascunho", correcaoAberta: true, definicaoChecksum: formulario.definicaoChecksum });
    expect(salvo?.valores).toMatchObject({ consideracoes: "Corrigir dados", planoDeAcordo: "nao", logradouroAluno: "Rua corrigida" });
    const termo = await prisma.documentoPreenchido.findFirstOrThrow({ where: { estagioId: estagio.id, templateId: "tpl-termo-compromisso" } });
    expect((termo.valores as Record<string, unknown>).cargaHorariaTotal).toBe(121);
    await expect(editarEstagio(estagio.id, {}, outro.id)).rejects.toMatchObject({ codigo: "acesso_negado" });
  });

  it("grava seleção adicional e inativa preenchimento removido sem apagar seu conteúdo", async () => {
    const estagio = await criarEm(2034);
    await expect(selecionarDocumentos(estagio.id, ["tpl-relatorio-semestral"], aluno.id)).rejects.toMatchObject({ codigo: "liberacao_pendente" });
    await prisma.estagio.update({ where: { id: estagio.id }, data: { situacao: "em_andamento", liberadoEm: new Date(), liberadoPorId: id("coordenador") } });
    await expect(selecionarDocumentos(estagio.id, ["tpl-lei-estagio"], aluno.id)).rejects.toMatchObject({ codigo: "documento_invalido" });
    const selecionado = await selecionarDocumentos(estagio.id, ["tpl-relatorio-semestral", "tpl-relatorio-semestral"], aluno.id);
    expect(selecionado.documentosSelecionados).toHaveLength(4);
    const doc = await criarRascunho(aluno, "tpl-relatorio-semestral", estagio.id);
    await expect(removerDocumentoEstagio(estagio.id, "tpl-plano-atividades", aluno.id)).rejects.toMatchObject({ codigo: "documento_obrigatorio" });
    await expect(removerDocumentoEstagio(estagio.id, "tpl-relatorio-semestral", outro.id)).rejects.toMatchObject({ codigo: "acesso_negado" });
    const removido = await removerDocumentoEstagio(estagio.id, "tpl-relatorio-semestral", aluno.id);
    expect(removido.documentosSelecionados).not.toContain("tpl-relatorio-semestral");
    expect(await documentoPorId(doc.id)).toMatchObject({ situacao: "inativo", valores: doc.valores, definicaoChecksum: doc.definicaoChecksum });
  });

  it("aplica conclusão/reabertura somente à coordenação autorizada, respeitando liberação e datas", async () => {
    const futuro = await criarEm(2035);
    await expect(concluirEstagio(futuro.id, id("coordenador"))).rejects.toMatchObject({ codigo: "liberacao_pendente" });
    await prisma.estagio.update({ where: { id: futuro.id }, data: { situacao: "em_andamento", liberadoEm: new Date() } });
    await expect(concluirEstagio(futuro.id, id("coordenador"))).rejects.toThrow(/futura/);
    const passado = await criarEm(2024);
    await prisma.estagio.update({ where: { id: passado.id }, data: { situacao: "em_andamento", liberadoEm: new Date() } });
    await expect(concluirEstagio(passado.id, aluno.id)).rejects.toMatchObject({ codigo: "acesso_negado" });
    await prisma.usuario.update({ where: { id: id("coordenador") }, data: { cursoId: id("outro-curso") } });
    await expect(concluirEstagio(passado.id, id("coordenador"))).rejects.toMatchObject({ codigo: "acesso_negado" });
    await prisma.usuario.update({ where: { id: id("coordenador") }, data: { cursoId: id("curso") } });
    expect(await concluirEstagio(passado.id, id("coordenador"))).toMatchObject({ situacao: "concluido", editadoPorId: id("coordenador") });
    expect(await reabrirEstagio(passado.id, id("coordenador"))).toMatchObject({ situacao: "em_andamento" });
    await prisma.lancamentoHoras.create({ data: { id: id("horas"), alunoId: aluno.id, estagioId: passado.id, data: new Date("2024-01-10"), entrada: "08:00", saida: "10:00", minutos: 120 } });
    expect(await totalHorasDoEstagio(passado.id)).toBe(2);
    await expect(editarEstagio(passado.id, { dataFim: "2024-01-05" }, id("coordenador"))).rejects.toMatchObject({ codigo: "periodo_com_lancamentos" });
  });

  it("serializa edições de períodos concorrentes e desfaz edição se falha um documento", async () => {
    const primeiro = await criarEm(2036);
    const segundo = await criarEm(2037);
    const dados = { dataInicio: "2038-01-03", dataFim: "2038-01-31" };
    const disputas = await Promise.allSettled([editarEstagio(primeiro.id, dados, id("coordenador")), editarEstagio(segundo.id, dados, id("coordenador"))]);
    expect(disputas.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    expect(disputas.find((resultado) => resultado.status === "rejected")).toMatchObject({ reason: { codigo: "periodo_conflictante" } });
    const antes = await estagioPorId(primeiro.id);
    await ddl(`CREATE TRIGGER ${gatilho} BEFORE UPDATE ON documentos_preenchidos FOR EACH ROW BEGIN IF NEW.estagioId = '${primeiro.id}' AND NEW.templateId = 'tpl-plano-atividades' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'probe_edicao'; END IF; END`);
    try { await expect(editarEstagio(primeiro.id, { cargaHorariaPrevista: 150 }, id("coordenador"))).rejects.toThrow(); }
    finally { await ddl(`DROP TRIGGER IF EXISTS ${gatilho}`); }
    expect(await estagioPorId(primeiro.id)).toEqual(antes);
  });
});

function solicitacao() {
  return { ...dadosSolicitacaoTeste(), convenioId: id("convenio"), supervisorId: id("supervisor"), orientadorId: id("orientador"), dataInicio: "2028-01-03", dataFim: "2028-01-31" };
}

describe("criação persistente de estágio e documentos iniciais", () => {
  it("cria exatamente três definições e impede sobreposição concorrente", async () => {
    const resultados = await Promise.allSettled([criarEstagio(outro, solicitacao()), criarEstagio(outro, solicitacao())]);
    expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    expect(resultados.find((resultado) => resultado.status === "rejected")).toMatchObject({ reason: { codigo: "periodo_conflictante" } });
    const sucesso = resultados.find((resultado) => resultado.status === "fulfilled")!;
    if (sucesso.status !== "fulfilled") throw new Error("Sem estágio criado.");
    expect(sucesso.value).toMatchObject({ situacao: "em_preparacao", cargaHorariaPrevista: 120, alunoId: outro.id });
    const documentos = await prisma.documentoPreenchido.findMany({ where: { estagioId: sucesso.value.id } });
    expect(documentos).toHaveLength(3);
    expect(new Set(documentos.map((doc) => doc.templateId)).size).toBe(3);
    expect(documentos.every((doc) => doc.definicaoChecksum.length === 64)).toBe(true);
    expect(await prisma.estagioTemplate.count({ where: { estagioId: sucesso.value.id } })).toBe(3);
    expect((await estagioPorId(sucesso.value.id))?.documentosSelecionados).toHaveLength(3);
  });

  it("desfaz estágio, seleção e documentos quando o terceiro preenchimento falha", async () => {
    const antes = await prisma.estagio.count({ where: { alunoId: aluno.id } });
    await ddl(`CREATE TRIGGER ${gatilho} BEFORE INSERT ON documentos_preenchidos FOR EACH ROW BEGIN IF NEW.alunoId = '${aluno.id}' AND NEW.templateId = 'tpl-plano-atividades' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'probe_documento_inicial'; END IF; END`);
    try { await expect(criarEstagio(aluno, solicitacao())).rejects.toThrow(); }
    finally { await ddl(`DROP TRIGGER IF EXISTS ${gatilho}`); }
    expect(await prisma.estagio.count({ where: { alunoId: aluno.id } })).toBe(antes);
    expect(await prisma.documentoPreenchido.count({ where: { alunoId: aluno.id, estagio: { dataInicio: new Date("2028-01-03") } } })).toBe(0);
    expect(await prisma.estagioTemplate.count({ where: { estagio: { alunoId: aluno.id, dataInicio: new Date("2028-01-03") } } })).toBe(0);
  });

  it("revalida a conta e opções ativas e recusa dados iniciais inválidos", async () => {
    const dados = solicitacao();
    const antes = await prisma.estagio.count({ where: { alunoId: aluno.id } });
    await prisma.pessoa.update({ where: { id: id("supervisor") }, data: { situacao: "inativo" } });
    try { await expect(criarEstagio(aluno, dados)).rejects.toMatchObject({ codigo: "supervisor_invalido" }); }
    finally { await prisma.pessoa.update({ where: { id: id("supervisor") }, data: { situacao: "ativo" } }); }
    await prisma.usuario.update({ where: { id: aluno.id }, data: { situacao: "inativo" } });
    try { await expect(criarEstagio(aluno, dados)).rejects.toMatchObject({ codigo: "papel_invalido" }); }
    finally { await prisma.usuario.update({ where: { id: aluno.id }, data: { situacao: "ativo" } }); }
    await expect(criarEstagio(aluno, { ...dados, valoresDocumentos: {} })).rejects.toThrow();
    await expect(criarEstagio(aluno, { ...dados, supervisorId: id("orientador") })).rejects.toMatchObject({ codigo: "supervisor_invalido" });
    await expect(criarEstagio(aluno, { ...dados, situacao: "em_andamento" })).rejects.toMatchObject({ codigo: "situacao_nao_permitida" });
    expect(await prisma.estagio.count({ where: { alunoId: aluno.id } })).toBe(antes);
  });
});

describe("preenchimentos persistidos com definição salva", () => {
  it("reabre em outro processo com os valores finais e o endereço corrigido", async () => {
    const criado = await criarRascunho(aluno, "tpl-relatorio-semestral", id("est-aluno"));
    expect(criado.valores.logradouro).toBe("Rua do cadastro");
    const salvo = await salvarRascunho(criado.id, { logradouro: "Rua corrigida", numero: "42", complemento: "Sala 2", cep: "27197000", bairro: "Centro", cidade: "Pinheiral", uf: "RJ", nomeCompleto: "Nome adulterado", campoDesconhecido: "não gravar" }, aluno);
    expect(salvo.valores).toMatchObject({ logradouro: "Rua corrigida", numero: "42", complemento: "Sala 2" });
    expect(salvo.valores.nomeCompleto).not.toBe("Nome adulterado");
    expect(salvo.valores.campoDesconhecido).toBeUndefined();
    await prisma.usuario.update({ where: { id: aluno.id }, data: { nome: "Perfil alterado depois do documento" } });
    const reaberto = await criarRascunho(aluno, "tpl-relatorio-semestral", id("est-aluno"));
    expect(reaberto.id).toBe(criado.id);
    expect(reaberto.valores).toEqual(salvo.valores);
    const script = fileURLToPath(new URL("../support/consultar-documento-processo.ts", import.meta.url));
    const contexto = new URL("../support/contexto-servidor.mjs", import.meta.url).href;
    const { stdout } = await promisify(execFile)(process.execPath, ["--import", "tsx", "--import", contexto, script, criado.id, aluno.id], { env: { ...process.env }, timeout: 20_000 });
    expect(JSON.parse(stdout)).toMatchObject({ documento: { id: criado.id, valores: salvo.valores, definicaoChecksum: criado.definicaoChecksum }, descritor: criado.definicaoSnapshot });
    expect((await documentosDoAluno(aluno.id)).map((doc) => doc.id)).toContain(criado.id);
  });

  it("mantém a definição salva quando o manifesto atual muda e recusa snapshot adulterado", async () => {
    const documento = (await documentosDoAluno(aluno.id))[0];
    const original = manifesto.definicaoKit;
    const alteracao = vi.spyOn(manifesto, "definicaoKit").mockImplementation((chave) => {
      const definicao = original(chave);
      if (definicao) {
        definicao.descritor.titulo = "Definição nova";
        const logradouro = [...(definicao.descritor.auto ?? []), ...definicao.descritor.secoes.flatMap((secao) => secao.campos)].find((campo) => campo.id === "logradouro");
        if (logradouro) logradouro.tipo = "numero";
        definicao.descritor.secoes.push({ id: "nova", titulo: "Nova seção", campos: [{ id: "novoObrigatorio", rotulo: "Novo obrigatório", tipo: "texto", origem: "digitado", obrigatorio: true }] });
        definicao.checksum = manifesto.checksumDefinicao(definicao.descritor);
      }
      return definicao;
    });
    try {
      const salvo = await salvarRascunho(documento.id, { complemento: "Sala 3" }, aluno);
      expect(salvo.definicaoChecksum).toBe(documento.definicaoChecksum);
      expect(descritorDoDocumento(salvo)?.titulo).not.toBe("Definição nova");
      expect(salvo.valores.logradouro).toBe("Rua corrigida");
    } finally { alteracao.mockRestore(); }
    await prisma.documentoPreenchido.update({ where: { id: documento.id }, data: { definicaoChecksum: "0".repeat(64) } });
    try { await expect(documentoPorId(documento.id)).rejects.toMatchObject({ codigo: "definicao_indisponivel" }); }
    finally { await prisma.documentoPreenchido.update({ where: { id: documento.id }, data: { definicaoChecksum: documento.definicaoChecksum! } }); }
  });

  it("revalida usuário, curso e vínculo e recusa gravação por outra conta", async () => {
    await prisma.usuario.update({ where: { id: id("coordenador") }, data: { cursoId: id("outro-curso") } });
    const estagio = (await estagioPorId(id("est-aluno")))!;
    expect(await podeConsultarEstagio({ ...outro, papel: "administrador" }, estagio)).toBe(false);
    await expect(exigirAcessoEstagio(autor("coordenador", "administrador"), estagio.id)).rejects.toMatchObject({ codigo: "acesso_negado" });
    await prisma.usuario.update({ where: { id: id("coordenador") }, data: { cursoId: id("curso") } });
    expect(await podeConsultarEstagio(autor("coordenador"), estagio)).toBe(true);
    const documento = (await documentosDoAluno(aluno.id))[0];
    expect(await podeConsultarDocumento(outro, { ...documento, alunoId: outro.id })).toBe(false);
    await expect(salvarRascunho(documento.id, { logradouro: "Adulterado" }, outro)).rejects.toMatchObject({ codigo: "acesso_negado" });
    await expect(criarRascunho(outro, "tpl-relatorio-semestral", estagio.id)).rejects.toMatchObject({ codigo: "acesso_negado" });
    await prisma.usuario.update({ where: { id: aluno.id }, data: { situacao: "inativo" } });
    expect(await podeConsultarEstagio(aluno, estagio)).toBe(false);
    await expect(salvarRascunho(documento.id, {}, aluno)).rejects.toMatchObject({ codigo: "acesso_negado" });
    await prisma.usuario.update({ where: { id: aluno.id }, data: { situacao: "ativo" } });
    expect((await documentoPorId(documento.id))?.valores.logradouro).toBe("Rua corrigida");
  });

  it("recusa definição, vínculo e conteúdo inválidos sem criar documento parcial", async () => {
    const antes = await prisma.documentoPreenchido.count({ where: { alunoId: outro.id } });
    await expect(criarRascunho(outro, "tpl-relatorio-semestral", id("est-outro"), { cep: "12" })).rejects.toMatchObject({ codigo: "valores_invalidos" });
    await expect(criarRascunho(outro, "tpl-lei-estagio", id("est-outro"))).rejects.toMatchObject({ codigo: "definicao_indisponivel" });
    await expect(criarRascunho(outro, "tpl-relatorio-semestral", id("est-inexistente"))).rejects.toMatchObject({ codigo: "estagio_invalido" });
    expect(await prisma.documentoPreenchido.count({ where: { alunoId: outro.id } })).toBe(antes);
    const salvo = (await documentosDoAluno(aluno.id))[0];
    await expect(salvarRascunho(salvo.id, { cep: "12" }, aluno)).rejects.toMatchObject({ codigo: "valores_invalidos" });
    expect((await documentoPorId(salvo.id))?.valores).toEqual(salvo.valores);
    const inicial = await criarRascunho(aluno, "tpl-formulario-liberacao", id("est-aluno"));
    await expect(salvarRascunho(inicial.id, {}, aluno)).rejects.toMatchObject({ codigo: "dados_iniciais_bloqueados" });
  });
});
