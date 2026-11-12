import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import type { Usuario } from "@/lib/domain/types";
import { carregarCliente, descartarCliente } from "@/lib/db/prisma";
import { executarTransacao } from "@/lib/db/transacoes";
import { dadosSolicitacaoTeste } from "@/lib/fixtures/solicitacao-teste";
import { excluirUsuario } from "@/lib/services/administracao";
import { baixarArquivo, salvarArquivo } from "@/lib/services/arquivos";
import { criarRascunho } from "@/lib/services/documentos";
import { criarEstagio, excluirEstagio } from "@/lib/services/estagios";
import { aplicarRemocaoDaPessoa, reaplicarRemocoesDesde } from "@/lib/services/remocao-dados-pessoais-persistentes";
import * as store from "@/lib/services/store";
import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base = process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");
const prefixo = `remocao-${crypto.randomUUID().slice(0, 8)}`;
const prisma = new PrismaClient({ adapter: new PrismaMariaDb({ host: configuracao.host, port: configuracao.porta, user: configuracao.usuario,
  password: configuracao.senha, database: configuracao.banco, connectionLimit: 4, ssl: { ca, rejectUnauthorized: true } }) });
const id = (sufixo: string) => `${prefixo}-${sufixo}`;
const PDF = Buffer.from("%PDF-1.4\n% comprovante com CPF 529.982.247-25\n");
const CPF = "52998224725";

async function criarAluno(sufixo: string): Promise<Usuario> {
  const aluno: Usuario = { id: id(`aluno-${sufixo}`), nome: `Aluno ${sufixo}`, email: `${id(`aluno-${sufixo}`)}@teste.local`, papel: "aluno", situacao: "ativo", campus: "Pinheiral", criadoEm: "2026-11-12" };
  await prisma.usuario.create({ data: { id: aluno.id, nome: aluno.nome, email: aluno.email, situacao: "ativo", papel: "aluno" } });
  await prisma.dadosPessoaisAluno.create({ data: {
    id: id(`dp-${sufixo}`), usuarioId: aluno.id, cpf: CPF, rg: "12345678", dataNascimento: new Date("2000-01-01"), telefone: "2433334444", celular: "24999994444",
    endereco: { cep: "27197000", logradouro: "Rua do cadastro", numero: "1", bairro: "Centro", cidade: "Pinheiral", estado: "RJ" },
    cursoId: id("curso"), turmaId: id("turma"), periodoId: id("periodo"),
  } });
  return aluno;
}

function solicitacao(ano: number, supervisorId = id("supervisor")) {
  return { ...dadosSolicitacaoTeste(), convenioId: id("convenio"), supervisorId, orientadorId: id("orientador"), dataInicio: `${ano}-01-03`, dataFim: `${ano}-01-31` };
}

/** Simula cópias de dados pessoais no preenchimento, como ocorreria antes da remoção. */
async function contaminarDocumento(documentoId: string, extras: Record<string, unknown> = {}) {
  const atual = await prisma.documentoPreenchido.findUniqueOrThrow({ where: { id: documentoId } });
  await prisma.documentoPreenchido.update({ where: { id: documentoId }, data: {
    valores: { ...(atual.valores as Record<string, unknown>), cpf: CPF, nomeCompleto: "Aluno Teste", telefoneSupervisor: "2433334444", ...extras } as Prisma.InputJsonValue,
  } });
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
  await prisma.instituicaoConcedente.create({ data: { id: id("instituicao"), nome: prefixo, cnpj: prefixo } });
  await prisma.convenio.create({ data: { id: id("convenio"), instituicaoId: id("instituicao"), nome: prefixo, inicioVigencia: new Date("2026-01-01"), fimVigencia: new Date("2031-01-01") } });
  for (const papel of ["supervisor", "orientador"]) await prisma.pessoa.create({ data: { id: id(papel), nome: `Nome ${papel}`, email: `${id(papel)}@teste.local`, telefone: "2433334444", papel } });
});

afterAll(async () => {
  const estagios = { alunoId: { startsWith: prefixo } };
  const estagioIds = (await prisma.estagio.findMany({ where: estagios, select: { id: true } })).map((estagio) => estagio.id);
  await prisma.remocaoDadosPessoais.deleteMany({ where: { OR: [{ alvoId: { in: estagioIds } }, { alvoId: { startsWith: prefixo } }] } });
  await prisma.solicitacaoExclusaoEstagio.deleteMany({ where: { estagio: estagios } });
  await prisma.arquivo.deleteMany({ where: { autorId: { startsWith: prefixo } } });
  await prisma.observacaoDocumento.deleteMany({ where: { documento: estagios } });
  await prisma.submissaoDocumento.deleteMany({ where: { documento: estagios } });
  await prisma.envioExterno.deleteMany({ where: { documento: estagios } });
  await prisma.pedidoEnvioDocumento.deleteMany({ where: { documento: estagios } });
  await prisma.documentoPreenchido.deleteMany({ where: { alunoId: { startsWith: prefixo } } });
  await prisma.estagioTemplate.deleteMany({ where: { estagio: estagios } });
  await prisma.estagio.deleteMany({ where: estagios });
  await prisma.convenio.deleteMany({ where: { id: id("convenio") } });
  await prisma.instituicaoConcedente.deleteMany({ where: { id: id("instituicao") } });
  await prisma.pessoa.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.dadosPessoaisAluno.deleteMany({ where: { usuarioId: { startsWith: prefixo } } });
  await prisma.usuario.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.turmaPeriodo.deleteMany({ where: { turmaId: id("turma") } });
  await prisma.turma.deleteMany({ where: { id: id("turma") } });
  await prisma.periodo.deleteMany({ where: { id: id("periodo") } });
  await prisma.curso.deleteMany({ where: { id: id("curso") } });
  await prisma.$disconnect();
  descartarCliente();
  vi.unstubAllEnvs();
});

describe("remoção de dados pessoais em anexos, cópias e restaurações", () => {
  it("anexo de estágio excluído perde o conteúdo e não é mais baixado", async () => {
    const aluno = await criarAluno("anexo");
    const estagio = await criarEstagio(aluno, solicitacao(2040));
    const documento = await criarRascunho(aluno, "tpl-formulario-liberacao", estagio.id, {});
    const arquivo = await salvarArquivo(aluno.id, documento.id, { nome: "comprovante.pdf", mimeType: "application/pdf", finalidade: "comprovante", conteudo: PDF });
    expect((await baixarArquivo(aluno.id, arquivo.id)).conteudo.byteLength).toBe(PDF.byteLength);

    await excluirEstagio(estagio.id, aluno);

    await expect(baixarArquivo(aluno.id, arquivo.id)).rejects.toMatchObject({ codigo: "arquivo_removido" });
    const linha = await prisma.arquivo.findUniqueOrThrow({ where: { id: arquivo.id } });
    expect(linha).toMatchObject({ tamanhoBytes: 0, checksum: "removido", nome: "anexo-removido" });
    expect(linha.conteudo.byteLength).toBe(0);
  });

  it("ensaio de restauração: a cópia restaurada volta a conter dados pessoais até a reaplicação das remoções", async () => {
    const aluno = await criarAluno("restauracao");
    const estagio = await criarEstagio(aluno, solicitacao(2041));
    const documento = await criarRascunho(aluno, "tpl-formulario-liberacao", estagio.id, {});
    await contaminarDocumento(documento.id);
    const arquivo = await salvarArquivo(aluno.id, documento.id, { nome: "comprovante.pdf", mimeType: "application/pdf", finalidade: "comprovante", conteudo: PDF });

    // Backup tirado no ponto de restauração, antes da exclusão.
    const ponto = new Date(Date.now() - 1000);
    const estagioAntes = await prisma.estagio.findUniqueOrThrow({ where: { id: estagio.id } });
    const documentosAntes = await prisma.documentoPreenchido.findMany({ where: { estagioId: estagio.id } });
    const arquivosAntes = await prisma.arquivo.findMany({ where: { documentoId: { in: documentosAntes.map((linha) => linha.id) } } });

    await excluirEstagio(estagio.id, aluno);
    expect((await prisma.documentoPreenchido.findUniqueOrThrow({ where: { id: documento.id } })).valores).not.toHaveProperty("cpf");

    // Restauração do backup: o estado volta ao ponto anterior à exclusão e às remoções.
    await prisma.estagio.update({ where: { id: estagio.id }, data: { excluidoEm: estagioAntes.excluidoEm, canceladoEm: estagioAntes.canceladoEm } });
    for (const linha of documentosAntes) {
      await prisma.documentoPreenchido.update({ where: { id: linha.id }, data: {
        valores: linha.valores as Prisma.InputJsonValue, situacao: linha.situacao, inativadoEm: linha.inativadoEm,
      } });
    }
    for (const linha of arquivosAntes) {
      await prisma.arquivo.update({ where: { id: linha.id }, data: { conteudo: linha.conteudo, tamanhoBytes: linha.tamanhoBytes, checksum: linha.checksum, nome: linha.nome } });
    }
    expect((await prisma.documentoPreenchido.findUniqueOrThrow({ where: { id: documento.id } })).valores).toHaveProperty("cpf");
    expect((await prisma.estagio.findUniqueOrThrow({ where: { id: estagio.id } })).excluidoEm).toBeNull();

    // Reaplicação das remoções posteriores ao ponto restaurado, antes de reabrir consultas.
    const aplicadas = await executarTransacao((tx) => reaplicarRemocoesDesde(tx, ponto), { cliente: (await carregarCliente()).prisma });
    expect(aplicadas).toBeGreaterThan(0);
    expect((await prisma.estagio.findUniqueOrThrow({ where: { id: estagio.id } })).excluidoEm).toBeTruthy();
    expect((await prisma.documentoPreenchido.findUniqueOrThrow({ where: { id: documento.id } }))).toMatchObject({ situacao: "inativo" });
    expect((await prisma.documentoPreenchido.findUniqueOrThrow({ where: { id: documento.id } })).valores).not.toHaveProperty("cpf");
    expect(await prisma.arquivo.findUniqueOrThrow({ where: { id: arquivo.id } })).toMatchObject({ checksum: "removido", tamanhoBytes: 0 });
  });

  it("exclusão de cadastro com histórico remove cópias nos documentos, anexos e perfil, mantendo a identidade técnica", async () => {
    const aluno = await criarAluno("conta");
    const estagio = await criarEstagio(aluno, solicitacao(2042));
    const documento = await criarRascunho(aluno, "tpl-formulario-liberacao", estagio.id, {});
    await contaminarDocumento(documento.id);
    const arquivo = await salvarArquivo(aluno.id, documento.id, { nome: "comprovante.pdf", mimeType: "application/pdf", finalidade: "comprovante", conteudo: PDF });

    await excluirUsuario(aluno.id);

    expect(await prisma.usuario.findUniqueOrThrow({ where: { id: aluno.id } })).toMatchObject({ nome: "Cadastro excluído", situacao: "inativo" });
    expect(await prisma.dadosPessoaisAluno.findUnique({ where: { usuarioId: aluno.id } })).toBeNull();
    const valores = (await prisma.documentoPreenchido.findUniqueOrThrow({ where: { id: documento.id } })).valores as Record<string, unknown>;
    expect(valores).not.toHaveProperty("cpf");
    expect(valores).not.toHaveProperty("nomeCompleto");
    // O contato do supervisor é dado da pessoa, tratado pela regra de orientador/supervisor.
    expect(valores).toHaveProperty("telefoneSupervisor");
    expect(await prisma.arquivo.findUniqueOrThrow({ where: { id: arquivo.id } })).toMatchObject({ checksum: "removido", tamanhoBytes: 0 });
    expect(await prisma.remocaoDadosPessoais.count({ where: { alvoTipo: "conta", alvoId: aluno.id } })).toBe(1);
  });

  it("orientador e supervisor perdem contato e identificação pessoal, mantendo o nome do histórico", async () => {
    const pessoa = await prisma.pessoa.create({ data: {
      id: id("pessoa-remocao"), nome: "Supervisora Histórica", email: `${id("pessoa-remocao")}@teste.local`, telefone: "2433335555", papel: "supervisor",
      cpf: CPF, rg: "1234567", endereco: { cep: "27197000", logradouro: "Rua", numero: "2", bairro: "Centro", cidade: "Pinheiral", estado: "RJ" },
    } });
    const aluno = await criarAluno("pessoa");
    const estagio = await criarEstagio(aluno, solicitacao(2043, pessoa.id));
    const documento = await criarRascunho(aluno, "tpl-formulario-liberacao", estagio.id, {});
    await contaminarDocumento(documento.id, { telefoneSupervisor: "2433335555" });

    await executarTransacao((tx) => aplicarRemocaoDaPessoa(tx, pessoa.id), { cliente: (await carregarCliente()).prisma });

    expect(await prisma.pessoa.findUniqueOrThrow({ where: { id: pessoa.id } })).toMatchObject({ nome: "Supervisora Histórica", cpf: null, rg: null, endereco: null, telefone: "" });
    const valores = (await prisma.documentoPreenchido.findUniqueOrThrow({ where: { id: documento.id } })).valores as Record<string, unknown>;
    expect(valores).not.toHaveProperty("telefoneSupervisor");
  });
});
