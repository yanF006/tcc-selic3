import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import type { Usuario } from "@/lib/domain/types";
import { descartarCliente } from "@/lib/db/prisma";
import { salvarCadastro, removerCadastro, consultarCadastros } from "@/lib/services/cadastros";
import { convenioPorId, listarConvenios, renovarConvenio } from "@/lib/services/catalogo";
import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base = process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");
const prefixo = `conv-serv-${crypto.randomUUID().slice(0, 8)}`;
const cnpj = String(BigInt(`0x${crypto.randomUUID().replaceAll("-", "").slice(0, 11)}`)).padStart(14, "0");
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: configuracao.host,
    port: configuracao.porta,
    user: configuracao.usuario,
    password: configuracao.senha,
    database: configuracao.banco,
    connectionLimit: 2,
    ssl: { ca, rejectUnauthorized: true },
  }),
});

const autor: Usuario = {
  id: `${prefixo}-autor`,
  nome: "Gestor",
  email: `${prefixo}@teste.local`,
  papel: "coordenador_estagio",
  situacao: "ativo",
  campus: "Pinheiral",
  criadoEm: new Date().toISOString(),
};

beforeAll(() => {
  vi.stubEnv("SELIC_PERSISTENCIA", "persistente");
  vi.stubEnv("DATABASE_URL", configuracao.url);
  vi.stubEnv("SELIC_DB_CA_CERT", ca);
});

afterAll(async () => {
  const instituicao = await prisma.instituicaoConcedente.findUnique({ where: { cnpj } });
  if (instituicao) {
    await prisma.renovacaoConvenio.deleteMany({ where: { convenio: { instituicaoId: instituicao.id } } });
    await prisma.convenio.deleteMany({ where: { instituicaoId: instituicao.id } });
    await prisma.responsavelInstituicao.deleteMany({ where: { instituicaoId: instituicao.id } });
    await prisma.instituicaoConcedente.delete({ where: { id: instituicao.id } });
  }
  await prisma.$disconnect();
  descartarCliente();
  vi.unstubAllEnvs();
});

async function criar(nome: string, inicioVigencia: string) {
  return salvarCadastro(autor, "convenio", {
    nome: `${prefixo}-${nome}`,
    instituicao: `${prefixo}-instituicao`,
    cnpj,
    inicioVigencia,
  });
}

describe("serviços de convênios persistentes", () => {
  it("salva contatos compartilhados, permite edição e remoção sem criar conta", async () => {
    const contasAntes = await prisma.usuario.count();
    const primeiro = await criar("contatos", "2026-01-01");
    const segundo = await criar("contatos-outro", "2026-01-01");
    const dados = {
      nome: `${prefixo}-contatos`, instituicao: `${prefixo}-instituicao`, cnpj,
      inicioVigencia: "2026-01-01",
      responsaveis: [{ nome: "Contato A", email: `${prefixo}-A@teste.local`, telefone: "2433334444", cargo: "Diretora" }],
    };
    await salvarCadastro(autor, "convenio", dados, primeiro.id);
    descartarCliente();
    expect((await convenioPorId(segundo.id))?.responsaveis).toEqual([
      expect.objectContaining({ nome: "Contato A", email: `${prefixo}-a@teste.local`, cargo: "Diretora" }),
    ]);
    expect((await consultarCadastros(autor)).convenios.find((item) => item.id === primeiro.id)?.responsaveis).toHaveLength(1);

    await expect(salvarCadastro(autor, "convenio", {
      ...dados, nome: "Não deve gravar", responsaveis: [dados.responsaveis[0], dados.responsaveis[0]],
    }, primeiro.id)).rejects.toThrow();
    expect((await convenioPorId(primeiro.id))?.nome).toBe(dados.nome);

    await salvarCadastro(autor, "convenio", {
      ...dados, responsaveis: [{ ...dados.responsaveis[0], nome: "Contato atualizado" }],
    }, primeiro.id);
    expect((await convenioPorId(segundo.id))?.responsaveis?.[0].nome).toBe("Contato atualizado");
    await salvarCadastro(autor, "convenio", { ...dados, responsaveis: [] }, primeiro.id);
    expect((await convenioPorId(segundo.id))?.responsaveis).toEqual([]);
    expect(await prisma.responsavelInstituicao.count({ where: { email: `${prefixo}-a@teste.local`, situacao: "inativo" } })).toBe(1);
    expect(await prisma.usuario.count()).toBe(contasAntes);
    await prisma.convenio.deleteMany({ where: { id: { in: [primeiro.id, segundo.id] } } });
  });
  it("preserva a instituição compartilhada, edição e leitura após recriar o cliente", async () => {
    const primeiro = await criar("vigente", "2026-01-01");
    const segundo = await criar("outro", "2026-01-01");
    const linhas = await prisma.convenio.findMany({ where: { id: { in: [primeiro.id, segundo.id] } } });
    expect(new Set(linhas.map((linha) => linha.instituicaoId)).size).toBe(1);

    await salvarCadastro(autor, "convenio", {
      nome: `${prefixo}-editado`,
      instituicao: `${prefixo}-instituicao`,
      cnpj,
      inicioVigencia: "2026-02-01",
    }, primeiro.id);

    descartarCliente();
    expect(await convenioPorId(primeiro.id)).toMatchObject({
      nome: `${prefixo}-editado`,
      inicioVigencia: "2026-02-01",
      fimVigencia: "2031-02-01",
      cnpj,
    });
    const pagina = await listarConvenios({ busca: prefixo, situacao: "ativo", tamanho: 1, pagina: 2 });
    expect(pagina).toMatchObject({ total: 2, pagina: 2, tamanhoPagina: 1 });
    expect(pagina.itens).toHaveLength(1);
  });

  it("retira vencidos e inativos da seleção, mantendo a consulta por ID", async () => {
    const vencido = await criar("vencido", "2010-01-01");
    const inativo = await criar("inativo", "2026-01-01");
    await removerCadastro(autor, "convenio", inativo.id, true);

    const ativos = await listarConvenios({ busca: prefixo, situacao: "ativo", tamanho: 100 });
    expect(ativos.itens.map((item) => item.id)).not.toContain(vencido.id);
    expect(ativos.itens.map((item) => item.id)).not.toContain(inativo.id);
    expect(await convenioPorId(vencido.id)).toMatchObject({ id: vencido.id, fimVigencia: "2015-01-01" });
    expect(await convenioPorId(inativo.id)).toMatchObject({ id: inativo.id, situacao: "inativo" });
    expect((await consultarCadastros(autor)).convenios).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: vencido.id, classificacao: "expirado", totalEstagios: 0 }),
    ]));
  });

  it("grava renovação e novas datas conjuntamente e recusa renovação ainda vigente", async () => {
    const convenio = await criar("renovar", "2020-01-01");
    const renovado = await renovarConvenio(convenio.id, "2026-11-10");
    expect(renovado).toMatchObject({ inicioVigencia: "2026-01-01", fimVigencia: "2031-01-01", renovacoes: 1 });
    expect(await prisma.renovacaoConvenio.findMany({ where: { convenioId: convenio.id } })).toEqual([
      expect.objectContaining({ inicioVigencia: new Date("2026-01-01"), fimVigencia: new Date("2031-01-01") }),
    ]);
    await expect(renovarConvenio(convenio.id, "2026-11-10")).rejects.toMatchObject({ codigo: "convenio_vigente" });
    expect(await prisma.renovacaoConvenio.count({ where: { convenioId: convenio.id } })).toBe(1);
  });
});
