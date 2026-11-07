import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { Usuario } from "@/lib/domain/types";
import { bancoConfigurado } from "@/lib/db/prisma";
import { fonteDadosSelecionada } from "@/lib/db/adaptador";
import { criarRepositorioUsuarios } from "@/lib/db/repositorios/usuarios";
import { criarRepositorioMatriculas } from "@/lib/db/repositorios/matriculas";
import { executarTransacao } from "@/lib/db/transacoes";

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

const repositorio = criarRepositorioUsuarios(prisma, Prisma);

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function usuarioNovo(): Usuario {
  const id = `usr-repo-${crypto.randomUUID()}`;

  return {
    id,
    nome: "Usuário do Repositório",
    email: `${id}@teste.local`,
    papel: "aluno",
    situacao: "ativo",
    campus: "Pinheiral",
    criadoEm: new Date().toISOString(),
  };
}

describe("repositórios persistentes", () => {
  it.each([false, true])("propaga a transação e mantém atomicidade (falha=%s)", async (falhar) => {
    const usuario = usuarioNovo();
    const registro = {
      id: `mat-${crypto.randomUUID()}`,
      matricula: String(crypto.getRandomValues(new Uint32Array(1))[0]).padStart(11, "0"),
      nome: usuario.nome,
      curso: "Curso do teste transacional",
      origem: "importacao" as const,
      importadaEm: new Date().toISOString(),
    };
    try {
      const operacao = executarTransacao(
        async (tx) => {
          const usuarios = criarRepositorioUsuarios(tx, Prisma);
          await usuarios.criar(usuario);
          await executarTransacao(
            async (mesmoCliente) => {
              expect(mesmoCliente === tx).toBe(true);
              await criarRepositorioMatriculas(mesmoCliente).criar(registro);
            },
            { transacao: tx },
          );
          if (falhar) await usuarios.criar({ ...usuario, id: `usr-${crypto.randomUUID()}` });
        },
        { cliente: prisma },
      );
      if (falhar) {
        await expect(operacao).rejects.toMatchObject({
          codigo: "e_mail_ja_utilizado_por_outro_cadastro",
        });
      } else {
        await operacao;
      }
      expect(await prisma.usuario.count({ where: { id: usuario.id } })).toBe(falhar ? 0 : 1);
      expect(await prisma.matriculaImportada.count({ where: { id: registro.id } })).toBe(
        falhar ? 0 : 1,
      );
    } finally {
      await prisma.usuario.deleteMany({ where: { email: usuario.email } });
      await prisma.matriculaImportada.deleteMany({ where: { id: registro.id } });
    }
  });

  it("seleciona persistência explicitamente no banco de integração", () => {
    vi.stubEnv("SELIC_PERSISTENCIA", "persistente");
    vi.stubEnv("DATABASE_URL", configuracao.url);

    expect(fonteDadosSelecionada()).toBe("persistente");
    expect(bancoConfigurado()).toBe(true);
  });

  it("persiste, lê, atualiza e remove usuário", async () => {
    const usuario = usuarioNovo();

    try {
      await repositorio.criar(usuario);

      const persistido = await repositorio.buscarPorId(usuario.id);
      expect(persistido).toMatchObject({
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: "aluno",
        matricula: usuario.matricula,
      });

      await repositorio.atualizar({ ...usuario, nome: "Nome Atualizado" });
      expect((await repositorio.buscarPorId(usuario.id))?.nome).toBe("Nome Atualizado");
    } finally {
      await repositorio.excluir(usuario.id);
    }

    expect(await repositorio.buscarPorId(usuario.id)).toBeNull();
  });

  it("recusa colisão de ID sem sobrescrever a conta existente", async () => {
    const usuario = usuarioNovo();
    try {
      await repositorio.criar(usuario);
      await expect(
        repositorio.criar({ ...usuario, nome: "Sobrescrita", email: usuarioNovo().email }),
      ).rejects.toMatchObject({ code: "P2002" });
      expect(await repositorio.buscarPorId(usuario.id)).toMatchObject({
        nome: usuario.nome,
        email: usuario.email,
      });
    } finally {
      await repositorio.excluir(usuario.id);
    }
  });

  it("não cria usuário ao editar alvo inexistente", async () => {
    const usuario = usuarioNovo();
    await expect(repositorio.atualizar(usuario)).rejects.toMatchObject({ code: "P2025" });
    expect(await repositorio.buscarPorId(usuario.id)).toBeNull();
  });

  it("preserva cadastros criados em dois processos independentes", async () => {
    const emails = [usuarioNovo().email, usuarioNovo().email];
    const executar = promisify(execFile);
    const script = fileURLToPath(new URL("../support/criar-usuario-processo.ts", import.meta.url));
    try {
      const resultados = await Promise.all(
        emails.map((email) => executar(process.execPath, ["--import", "tsx", script, email])),
      );
      const ids = resultados.map(({ stdout }) => JSON.parse(stdout).id as string);
      expect(new Set(ids).size).toBe(2);
      expect(ids.every((id) => /^usr-[0-9a-f-]{36}$/.test(id))).toBe(true);
      const usuarios = await prisma.usuario.findMany({ where: { email: { in: emails } } });
      expect(usuarios).toHaveLength(2);
      expect(usuarios.map(({ id }) => id).sort()).toEqual(ids.sort());
    } finally {
      await prisma.usuario.deleteMany({ where: { email: { in: emails } } });
    }
  });
});
