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

const prefixo = `aprovacao-${crypto.randomUUID()}`;
const usuariosCriados: string[] = [];
const cursosCriados: string[] = [];
const matriculasCriadas: string[] = [];
const importacoesCriadas: string[] = [];

afterAll(async () => {
  if (usuariosCriados.length > 0) {
    await prisma.solicitacaoAcesso.deleteMany({
      where: { usuarioId: { in: usuariosCriados } },
    });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCriados } } });
  }
  if (importacoesCriadas.length > 0) {
    await prisma.itemImportacaoMatricula.deleteMany({
      where: { importacaoId: { in: importacoesCriadas } },
    });
    await prisma.importacaoMatriculas.deleteMany({
      where: { id: { in: importacoesCriadas } },
    });
  }
  if (matriculasCriadas.length > 0) {
    await prisma.matriculaImportada.deleteMany({
      where: { id: { in: matriculasCriadas } },
    });
  }
  if (cursosCriados.length > 0) {
    await prisma.curso.deleteMany({ where: { id: { in: cursosCriados } } });
  }
  await prisma.$disconnect();
});

function novoUsuario(email: string, papel = "aluno") {
  const id = crypto.randomUUID();
  usuariosCriados.push(id);
  return { id, nome: "Usuário de Teste", email, papel };
}

async function novoCurso() {
  const curso = await prisma.curso.create({
    data: {
      id: crypto.randomUUID(),
      nome: "Curso de Aprovação",
      codigo: crypto.randomUUID(),
    },
  });
  cursosCriados.push(curso.id);
  return curso;
}

function novaMatricula() {
  return `9${Date.now().toString().slice(-8)}${String(randomInt(10, 99))}`;
}

describe("solicitações de acesso e importações de matrícula", () => {
  it("vincula a solicitação à conta, ao curso e à decisão", async () => {
    const usuario = await prisma.usuario.create({
      data: novoUsuario(`${prefixo}-solicitante@teste.local`),
    });
    const decisor = await prisma.usuario.create({
      data: novoUsuario(`${prefixo}-decisor@teste.local`, "administrador"),
    });
    const curso = await novoCurso();

    const solicitacao = await prisma.solicitacaoAcesso.create({
      data: {
        id: crypto.randomUUID(),
        usuarioId: usuario.id,
        cursoId: curso.id,
        situacao: "autorizado",
        motivo: "Matrícula conferida.",
        decididoPorId: decisor.id,
        decididoEm: new Date("2026-11-06T12:00:00.000Z"),
      },
      include: { usuario: true, curso: true, decididoPor: true },
    });

    expect(solicitacao.usuario.id).toBe(usuario.id);
    expect(solicitacao.curso.id).toBe(curso.id);
    expect(solicitacao.decididoPor?.id).toBe(decisor.id);
    expect(solicitacao.situacao).toBe("autorizado");

    await expect(
      prisma.solicitacaoAcesso.create({
        data: {
          id: crypto.randomUUID(),
          usuarioId: usuario.id,
          cursoId: curso.id,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    await prisma.usuario.delete({ where: { id: decisor.id } });
    const semDecisor = await prisma.solicitacaoAcesso.findUnique({
      where: { id: solicitacao.id },
    });
    expect(semDecisor?.decididoPorId).toBeNull();
  });

  it("preserva a matrícula importada e sua associação acadêmica opcional", async () => {
    const curso = await novoCurso();
    const matricula = novaMatricula();

    const registro = await prisma.matriculaImportada.create({
      data: {
        id: crypto.randomUUID(),
        matricula,
        nome: "Aluno Importado",
        curso: "Curso Recebido no Arquivo",
        cursoId: curso.id,
        origem: "importacao",
      },
      include: { cursoAcademico: true },
    });
    matriculasCriadas.push(registro.id);

    expect(registro.curso).toBe("Curso Recebido no Arquivo");
    expect(registro.cursoAcademico?.id).toBe(curso.id);

    await expect(
      prisma.matriculaImportada.create({
        data: {
          id: crypto.randomUUID(),
          matricula,
          nome: "Outro Aluno",
          curso: "Outro Curso",
          origem: "cadastro_administrador",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("mantém o lote e os resultados de cada linha consultáveis", async () => {
    const importacao = await prisma.importacaoMatriculas.create({
      data: {
        id: crypto.randomUUID(),
        arquivo: `${prefixo}.csv`,
        importadoEm: new Date("2026-11-06T12:30:00.000Z"),
        validas: 1,
        rejeitadas: 1,
        ignoradas: 1,
        itens: {
          create: [
            {
              id: crypto.randomUUID(),
              matricula: "20260000001",
              nome: "Aluno Válido",
              curso: "Curso A",
              resultado: "valida",
            },
            {
              id: crypto.randomUUID(),
              matricula: "20260000002",
              nome: "Aluno Inválido",
              curso: "Curso B",
              resultado: "rejeitada",
              motivo: "Matrícula inválida.",
            },
            {
              id: crypto.randomUUID(),
              matricula: "20260000003",
              nome: "Aluno Repetido",
              curso: "Curso C",
              resultado: "ignorada",
              motivo: "Matrícula já registrada.",
            },
          ],
        },
      },
      include: { itens: true },
    });
    importacoesCriadas.push(importacao.id);

    expect(importacao.arquivo).toBe(`${prefixo}.csv`);
    expect(importacao.itens).toHaveLength(3);
    expect(importacao.itens.map((item) => item.resultado).sort()).toEqual([
      "ignorada",
      "rejeitada",
      "valida",
    ]);
    expect(
      await prisma.itemImportacaoMatricula.count({ where: { importacaoId: importacao.id } }),
    ).toBe(3);

    await prisma.importacaoMatriculas.delete({ where: { id: importacao.id } });
    expect(
      await prisma.itemImportacaoMatricula.count({ where: { importacaoId: importacao.id } }),
    ).toBe(0);
  });

  it("mantém uma única restrição única para a matrícula do usuário", async () => {
    const indices = await prisma.$queryRawUnsafe<
      Array<{ Key_name: string; Non_unique: number; Column_name: string }>
    >("SHOW INDEX FROM usuarios WHERE Column_name = 'matricula'");

    const unicos = indices.filter(
      (indice) => Number(indice.Non_unique) === 0 && indice.Column_name === "matricula",
    );
    expect(unicos).toHaveLength(1);
  });
});
