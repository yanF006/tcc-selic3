import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import type { Usuario } from "@/lib/domain/types";
import { descartarCliente } from "@/lib/db/prisma";
import { documentosDoIndicador, pesquisarEstatisticas } from "@/lib/services/estatisticas";
import { DESCRITORES } from "@/lib/templates/descriptors";
import { checksumDefinicao } from "@/lib/templates/manifesto";
import * as store from "@/lib/services/store";
import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base = process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");
const prefixo = `estat-${crypto.randomUUID().slice(0, 8)}`;
const prisma = new PrismaClient({ adapter: new PrismaMariaDb({ host: configuracao.host, port: configuracao.porta, user: configuracao.usuario,
  password: configuracao.senha, database: configuracao.banco, connectionLimit: 2, ssl: { ca, rejectUnauthorized: true } }) });
const id = (sufixo: string) => `${prefixo}-${sufixo}`;
const TEMPLATE = "tpl-requerimento-aproveitamento";
const descritor = DESCRITORES.find((item) => item.templateId === TEMPLATE)!;

const coordenadorA: Usuario = { id: id("coord-a"), nome: "Coord A", email: `${id("coord-a")}@teste.local`, papel: "coordenador_curso", cursoId: id("curso-a"), situacao: "ativo", campus: "Pinheiral", criadoEm: "2026-11-12" };
const coordenadorB: Usuario = { ...coordenadorA, id: id("coord-b"), nome: "Coord B", email: `${id("coord-b")}@teste.local`, cursoId: id("curso-b") };
const administrador: Usuario = { id: id("admin"), nome: "Admin", email: `${id("admin")}@teste.local`, papel: "administrador", situacao: "ativo", campus: "Pinheiral", criadoEm: "2026-11-12" };

const alunos = {
  a1: { id: id("aluno-a1"), curso: "a", situacao: "em_andamento" },
  a2: { id: id("aluno-a2"), curso: "a", situacao: "em_preparacao" },
  b1: { id: id("aluno-b1"), curso: "b", situacao: "concluido" },
} as const;

function dadosPessoais(usuarioId: string, curso: "a" | "b") {
  return {
    id: `dp-${usuarioId}`, usuarioId, cpf: "52998224725", rg: "12345678", dataNascimento: new Date("2000-01-01"),
    telefone: "2433334444", celular: "24999994444",
    endereco: { cep: "27197000", logradouro: "Rua", numero: "1", bairro: "Centro", cidade: "Pinheiral", estado: "RJ" },
    cursoId: id(`curso-${curso}`), turmaId: id(`turma-${curso}`), periodoId: id("periodo"),
  };
}

beforeAll(async () => {
  vi.stubEnv("SELIC_PERSISTENCIA", "persistente");
  vi.stubEnv("DATABASE_URL", configuracao.url);
  vi.stubEnv("SELIC_DB_CA_CERT", ca);
  // O caminho persistente não pode consultar fixtures nem o simulador.
  vi.spyOn(store, "obterEstado").mockImplementation(() => { throw new Error("Simulador proibido neste fluxo."); });

  await prisma.periodo.create({ data: { id: id("periodo"), rotulo: `${prefixo}-2026.2`, ano: 2026, semestre: 2 } });
  for (const curso of ["a", "b"] as const) {
    await prisma.curso.create({ data: { id: id(`curso-${curso}`), nome: `${prefixo} curso ${curso}`, codigo: id(`curso-${curso}`) } });
    await prisma.turma.create({ data: { id: id(`turma-${curso}`), nome: `${prefixo} turma ${curso}`, cursoId: id(`curso-${curso}`) } });
  }
  for (const usuario of [coordenadorA, coordenadorB, administrador]) {
    await prisma.usuario.create({ data: { id: usuario.id, nome: usuario.nome, email: usuario.email, situacao: "ativo", papel: usuario.papel, cursoId: usuario.cursoId ?? null } });
  }
  await prisma.instituicaoConcedente.create({ data: { id: id("instituicao"), nome: prefixo, cnpj: prefixo } });
  await prisma.convenio.create({ data: { id: id("convenio"), instituicaoId: id("instituicao"), nome: prefixo, inicioVigencia: new Date("2026-01-01"), fimVigencia: new Date("2031-01-01") } });
  await prisma.pessoa.create({ data: { id: id("supervisor"), nome: `${prefixo} supervisor`, email: `${id("supervisor")}@teste.local`, telefone: "2433334444", papel: "supervisor" } });
  await prisma.pessoa.create({ data: { id: id("orientador"), nome: `${prefixo} orientador`, email: `${id("orientador")}@teste.local`, telefone: "2433334444", papel: "orientador" } });

  for (const [chave, aluno] of Object.entries(alunos)) {
    await prisma.usuario.create({ data: { id: aluno.id, nome: `${prefixo} ${chave}`, email: `${aluno.id}@teste.local`, situacao: "ativo", papel: "aluno" } });
    await prisma.dadosPessoaisAluno.create({ data: dadosPessoais(aluno.id, aluno.curso) });
    await prisma.estagio.create({ data: {
      id: id(`estagio-${chave}`), alunoId: aluno.id, convenioId: id("convenio"), supervisorId: id("supervisor"), orientadorId: id("orientador"),
      dataInicio: new Date("2028-01-03"), dataFim: new Date("2028-01-31"), situacao: aluno.situacao,
    } });
  }

  await prisma.lancamentoHoras.create({ data: {
    id: id("lan-a1"), estagioId: id("estagio-a1"), alunoId: alunos.a1.id, data: new Date("2028-01-04"),
    entrada: "08:00", saida: "10:00", minutos: 120, tipo: "lancamento",
  } });

  const documento = (chave: string, alunoId: string, situacao: string) => prisma.documentoPreenchido.create({ data: {
    id: id(`doc-${chave}`), templateId: TEMPLATE, alunoId, estagioId: id(`estagio-${chave}`), versaoTemplate: 1,
    definicaoChecksum: checksumDefinicao(descritor), definicaoSnapshot: descritor as object, valores: {}, situacao,
  } });
  await documento("a1", alunos.a1.id, "aprovado");
  await documento("b1", alunos.b1.id, "indeferido");
});

afterAll(async () => {
  vi.restoreAllMocks();
  await prisma.documentoPreenchido.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.lancamentoHoras.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.estagio.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.convenio.deleteMany({ where: { id: id("convenio") } });
  await prisma.instituicaoConcedente.deleteMany({ where: { id: id("instituicao") } });
  await prisma.pessoa.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.dadosPessoaisAluno.deleteMany({ where: { usuarioId: { startsWith: prefixo } } });
  await prisma.usuario.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.turma.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.periodo.deleteMany({ where: { id: id("periodo") } });
  await prisma.curso.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.$disconnect();
  descartarCliente();
  vi.unstubAllEnvs();
});

describe("estatísticas persistentes (12.1)", () => {
  it("restringe o coordenador de curso aos próprios estágios, sem vazar outro curso", async () => {
    const pesquisa = await pesquisarEstatisticas(coordenadorA);

    expect(pesquisa.recorte).toMatchObject({ escopo: "curso", cursoId: id("curso-a") });
    const ids = pesquisa.itens.map((item) => item.estagio.id);
    expect(ids).toEqual(expect.arrayContaining([id("estagio-a1"), id("estagio-a2")]));
    expect(ids).not.toContain(id("estagio-b1"));
    expect(pesquisa.total).toBe(pesquisa.itens.length);
    expect(pesquisa.opcoes.cursos.map((opcao) => opcao.valor)).toEqual([id("curso-a")]);
  });

  it("mantém indicador e lista com o mesmo recorte e total, sem contar preparação como andamento", async () => {
    const pesquisa = await pesquisarEstatisticas(coordenadorA);

    expect(pesquisa.indicadores.situacoes).toEqual({ em_preparacao: 1, em_andamento: 1, concluido: 0 });
    expect(pesquisa.itens.find((item) => item.estagio.id === id("estagio-a2"))?.estagio.situacao).toBe("em_preparacao");
    expect(pesquisa.indicadores.documentos.reduce((total, tipo) => total + tipo.total, 0)).toBe(1);
  });

  it("soma as horas efetivas dos lançamentos do próprio recorte", async () => {
    const pesquisa = await pesquisarEstatisticas(coordenadorA);
    const porAluno = pesquisa.totaisHoras.porAluno.find((grupo) => grupo.chave.endsWith("a1"));

    expect(porAluno).toMatchObject({ estagios: 1, horas: 2 });
  });

  it("não devolve registros de outro curso mesmo quando o filtro pede esse curso", async () => {
    const outro = await pesquisarEstatisticas(coordenadorA, { cursoId: id("curso-b") });

    expect(outro.total).toBe(0);
    expect(outro.itens).toEqual([]);
    const lista = await documentosDoIndicador(coordenadorA, TEMPLATE, { cursoId: id("curso-b") });
    expect(lista).toEqual([]);
  });

  it("lista os documentos do indicador somente dentro do recorte", async () => {
    const listaB = await documentosDoIndicador(coordenadorB, TEMPLATE);
    const ids = listaB.map((item) => item.documento.id);

    expect(ids).toContain(id("doc-b1"));
    expect(ids).not.toContain(id("doc-a1"));
    expect(await documentosDoIndicador(coordenadorA, TEMPLATE)).toEqual(
      expect.arrayContaining([expect.objectContaining({ alunoNome: expect.stringContaining("a1") })]),
    );
  });

  it("administrador do campus enxerga os estágios de todos os cursos", async () => {
    const pesquisa = await pesquisarEstatisticas(administrador);
    const ids = pesquisa.itens.map((item) => item.estagio.id);

    expect(pesquisa.recorte.escopo).toBe("campus");
    expect(ids).toEqual(expect.arrayContaining([id("estagio-a1"), id("estagio-a2"), id("estagio-b1")]));
  });
});
