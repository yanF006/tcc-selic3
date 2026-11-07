import { randomInt } from "node:crypto";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";

import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: configuracao.host,
    port: configuracao.porta,
    user: configuracao.usuario,
    password: configuracao.senha,
    database: configuracao.banco,
    connectionLimit: 1,
    ssl: { rejectUnauthorized: false },
  }),
});

const prefixo = `institucional-${crypto.randomUUID()}`;
const instituicoesCriadas: string[] = [];
const responsaveisCriados: string[] = [];
const conveniosCriados: string[] = [];
const renovacoesCriadas: string[] = [];
const pessoasCriadas: string[] = [];

afterAll(async () => {
  if (responsaveisCriados.length > 0) {
    await prisma.responsavelInstituicao.deleteMany({
      where: { id: { in: responsaveisCriados } },
    });
  }
  if (renovacoesCriadas.length > 0) {
    await prisma.renovacaoConvenio.deleteMany({
      where: { id: { in: renovacoesCriadas } },
    });
  }
  if (conveniosCriados.length > 0) {
    await prisma.convenio.deleteMany({ where: { id: { in: conveniosCriados } } });
  }
  if (instituicoesCriadas.length > 0) {
    await prisma.instituicaoConcedente.deleteMany({
      where: { id: { in: instituicoesCriadas } },
    });
  }
  if (pessoasCriadas.length > 0) {
    await prisma.pessoa.deleteMany({ where: { id: { in: pessoasCriadas } } });
  }
  await prisma.$disconnect();
});

function novoCnpj() {
  return `${Date.now()}${String(randomInt(10, 99))}`;
}

async function novaInstituicao(cnpj = novoCnpj()) {
  const instituicao = await prisma.instituicaoConcedente.create({
    data: {
      id: crypto.randomUUID(),
      nome: "Instituição de Teste",
      cnpj,
      campus: "Pinheiral",
      situacao: "ativo",
    },
  });
  instituicoesCriadas.push(instituicao.id);
  return instituicao;
}

async function novoConvenio(instituicaoId: string) {
  const convenio = await prisma.convenio.create({
    data: {
      id: crypto.randomUUID(),
      instituicaoId,
      nome: "Convênio de Teste",
      inicioVigencia: new Date("2026-01-01T00:00:00.000Z"),
      fimVigencia: new Date("2031-01-01T00:00:00.000Z"),
      campus: "Pinheiral",
      situacao: "ativo",
    },
  });
  conveniosCriados.push(convenio.id);
  return convenio;
}

describe("instituições, responsáveis, convênios e pessoas externas", () => {
  it("preserva relações de instituição, responsável, convênio e renovação", async () => {
    const instituicao = await novaInstituicao();
    const responsavel = await prisma.responsavelInstituicao.create({
      data: {
        id: crypto.randomUUID(),
        instituicaoId: instituicao.id,
        nome: "Responsável de Teste",
        email: `${prefixo}-responsavel@teste.local`,
        telefone: "2433334444",
        cargo: "Gerente",
      },
    });
    responsaveisCriados.push(responsavel.id);

    const convenio = await novoConvenio(instituicao.id);
    const renovacao = await prisma.renovacaoConvenio.create({
      data: {
        id: crypto.randomUUID(),
        convenioId: convenio.id,
        inicioVigencia: new Date("2031-01-01T00:00:00.000Z"),
        fimVigencia: new Date("2036-01-01T00:00:00.000Z"),
      },
    });
    renovacoesCriadas.push(renovacao.id);

    const instituicaoCompleta = await prisma.instituicaoConcedente.findUniqueOrThrow({
      where: { id: instituicao.id },
      include: { responsaveis: true, convenios: true },
    });
    expect(instituicaoCompleta.responsaveis.map((item) => item.id)).toEqual([responsavel.id]);
    expect(instituicaoCompleta.convenios.map((item) => item.id)).toEqual([convenio.id]);

    const convenioCompleto = await prisma.convenio.findUniqueOrThrow({
      where: { id: convenio.id },
      include: { instituicao: true, historicoRenovacoes: true },
    });
    expect(convenioCompleto.instituicao.id).toBe(instituicao.id);
    expect(convenioCompleto.historicoRenovacoes).toHaveLength(1);
    expect(convenioCompleto.historicoRenovacoes[0].id).toBe(renovacao.id);
  });

  it("impede exclusão física de referências protegidas e duplicidades", async () => {
    const instituicao = await novaInstituicao();
    const convenio = await novoConvenio(instituicao.id);
    const renovacao = await prisma.renovacaoConvenio.create({
      data: {
        id: crypto.randomUUID(),
        convenioId: convenio.id,
        inicioVigencia: new Date("2031-01-01T00:00:00.000Z"),
        fimVigencia: new Date("2036-01-01T00:00:00.000Z"),
      },
    });
    renovacoesCriadas.push(renovacao.id);

    await expect(
      prisma.instituicaoConcedente.delete({ where: { id: instituicao.id } }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.convenio.delete({ where: { id: convenio.id } })).rejects.toMatchObject({
      code: "P2003",
    });

    await expect(
      prisma.instituicaoConcedente.create({
        data: {
          id: crypto.randomUUID(),
          nome: "Instituição Duplicada",
          cnpj: instituicao.cnpj,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    const responsavel = await prisma.responsavelInstituicao.create({
      data: {
        id: crypto.randomUUID(),
        instituicaoId: instituicao.id,
        nome: "Responsável Duplicado",
        email: `${prefixo}-duplicado@teste.local`,
        telefone: "2433335555",
      },
    });
    responsaveisCriados.push(responsavel.id);
    await expect(
      prisma.responsavelInstituicao.create({
        data: {
          id: crypto.randomUUID(),
          instituicaoId: instituicao.id,
          nome: "Responsável Duplicado 2",
          email: responsavel.email,
          telefone: "2433336666",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("não cria identidade de login para pessoa externa", async () => {
    const usuariosAntes = await prisma.usuario.count();
    const pessoa = await prisma.pessoa.create({
      data: {
        id: crypto.randomUUID(),
        nome: "Supervisor Externo",
        email: `${prefixo}-supervisor@teste.local`,
        telefone: "24999998888",
        papel: "supervisor",
        situacao: "ativo",
      },
    });
    pessoasCriadas.push(pessoa.id);

    expect(pessoa.papel).toBe("supervisor");
    expect(await prisma.usuario.count()).toBe(usuariosAntes);

    const colunas = await prisma.$queryRawUnsafe<Array<{ Field: string }>>(
      "SHOW COLUMNS FROM pessoas",
    );
    expect(colunas.map((coluna) => coluna.Field)).not.toContain("usuarioId");
    expect(colunas.map((coluna) => coluna.Field)).not.toContain("userId");
  });
});
