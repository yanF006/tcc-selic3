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

const prefixo = `app-${crypto.randomUUID()}`;
const usuariosCriados: string[] = [];
const cursosCriados: string[] = [];
const turmasCriadas: string[] = [];
const periodosCriados: string[] = [];

afterAll(async () => {
  if (usuariosCriados.length > 0) {
    await prisma.dadosPessoaisAluno.deleteMany({
      where: { usuarioId: { in: usuariosCriados } },
    });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCriados } } });
  }
  if (turmasCriadas.length > 0) {
    await prisma.turmaPeriodo.deleteMany({ where: { turmaId: { in: turmasCriadas } } });
    await prisma.turma.deleteMany({ where: { id: { in: turmasCriadas } } });
  }
  if (periodosCriados.length > 0) {
    await prisma.periodo.deleteMany({ where: { id: { in: periodosCriados } } });
  }
  if (cursosCriados.length > 0) {
    await prisma.curso.deleteMany({ where: { id: { in: cursosCriados } } });
  }
  await prisma.$disconnect();
});

function novoUsuario(email: string) {
  const id = crypto.randomUUID();
  usuariosCriados.push(id);
  return { id, nome: "Usuário de Teste", email };
}

describe("schema de identidade e vínculos acadêmicos", () => {
  it("permite vários usuários sem matrícula e aplica os defaults seguros", async () => {
    const usuarios = await Promise.all(
      [1, 2, 3].map((indice) =>
        prisma.usuario.create({
          data: novoUsuario(`${prefixo}-${indice}@teste.local`),
        }),
      ),
    );

    expect(usuarios).toHaveLength(3);
    for (const usuario of usuarios) {
      expect(usuario.matricula).toBeNull();
      expect(usuario.papel).toBe("aluno");
      expect(usuario.situacao).toBe("pendente");
      expect(usuario.campus).toBe("Pinheiral");
      expect(usuario.emailVerificado).toBe(false);
    }
  });

  it("rejeita e-mail e matrícula duplicados", async () => {
    const primeiro = novoUsuario(`${prefixo}-duplicado@teste.local`);
    await prisma.usuario.create({ data: primeiro });

    await expect(
      prisma.usuario.create({
        data: novoUsuario(`${prefixo}-duplicado@teste.local`),
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    const matricula = "20261234567";
    await prisma.usuario.create({
      data: { ...novoUsuario(`${prefixo}-matricula-1@teste.local`), matricula },
    });

    await expect(
      prisma.usuario.create({
        data: { ...novoUsuario(`${prefixo}-matricula-2@teste.local`), matricula },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("mantém FKs acadêmicas e o vínculo único de dados pessoais", async () => {
    const curso = await prisma.curso.create({
      data: {
        id: crypto.randomUUID(),
        nome: "Curso de Teste",
        codigo: `${prefixo}-curso`,
      },
    });
    cursosCriados.push(curso.id);

    const periodo = await prisma.periodo.create({
      data: {
        id: crypto.randomUUID(),
        rotulo: `${prefixo}-2026.1`,
        ano: 2026,
        semestre: 1,
      },
    });
    periodosCriados.push(periodo.id);

    const turma = await prisma.turma.create({
      data: {
        id: crypto.randomUUID(),
        nome: "Turma de Teste",
        cursoId: curso.id,
      },
    });
    turmasCriadas.push(turma.id);

    await prisma.turmaPeriodo.create({
      data: { turmaId: turma.id, periodoId: periodo.id },
    });

    const usuario = await prisma.usuario.create({
      data: novoUsuario(`${prefixo}-aluno@teste.local`),
    });

    const dados = await prisma.dadosPessoaisAluno.create({
      data: {
        id: crypto.randomUUID(),
        usuarioId: usuario.id,
        cpf: "12345678901",
        rg: "1234567",
        dataNascimento: new Date("2000-01-01T00:00:00.000Z"),
        telefone: "2433334444",
        celular: "24999998888",
        endereco: {
          cep: "27280000",
          logradouro: "Rua de Teste",
          numero: "10",
          bairro: "Centro",
          cidade: "Pinheiral",
          estado: "RJ",
        },
        cursoId: curso.id,
        turmaId: turma.id,
        periodoId: periodo.id,
      },
      include: { curso: true, turma: true, periodo: true, usuario: true },
    });

    expect(dados.curso.id).toBe(curso.id);
    expect(dados.turma.id).toBe(turma.id);
    expect(dados.periodo.id).toBe(periodo.id);
    expect(dados.usuario.id).toBe(usuario.id);
    expect(await prisma.dadosPessoaisAluno.count({ where: { usuarioId: usuario.id } })).toBe(1);

    await expect(
      prisma.dadosPessoaisAluno.create({
        data: {
          id: crypto.randomUUID(),
          usuarioId: usuario.id,
          cpf: "98765432100",
          rg: "7654321",
          dataNascimento: new Date("2001-01-01T00:00:00.000Z"),
          telefone: "2433335555",
          celular: "24999997777",
          endereco: {
            cep: "27280001",
            logradouro: "Rua 2",
            numero: "20",
            bairro: "Centro",
            cidade: "Pinheiral",
            estado: "RJ",
          },
          cursoId: curso.id,
          turmaId: turma.id,
          periodoId: periodo.id,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
