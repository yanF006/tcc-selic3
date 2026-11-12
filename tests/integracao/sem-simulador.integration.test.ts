import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import type { Usuario } from "@/lib/domain/types";
import { descartarCliente } from "@/lib/db/prisma";
import { dadosDoAluno } from "@/lib/services/aluno";
import {
  contarUsuariosPorSituacao,
  listarImportacoesMatriculas,
  listarMatriculas,
  listarSolicitacoes,
  listarUsuarios,
  usuarioPorEmail,
  usuarioPorId,
} from "@/lib/services/administracao";
import { listarConvenios, listarCursos, listarPeriodos, listarTurmas } from "@/lib/services/catalogo";
import { consultarEstagios } from "@/lib/services/estagios";
import { pesquisarEstatisticas } from "@/lib/services/estatisticas";
import { documentosParaParecer } from "@/lib/services/documentos";
import * as store from "@/lib/services/store";
import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";

/**
 * Prova da 12.5: no modo persistente, as leituras das telas não consultam o
 * simulador nem fixtures. O espião em `obterEstado` falha o teste se algum
 * caminho ainda lê a memória.
 */

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base = process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");
const prefixo = `semsim-${crypto.randomUUID().slice(0, 8)}`;
const prisma = new PrismaClient({ adapter: new PrismaMariaDb({ host: configuracao.host, port: configuracao.porta, user: configuracao.usuario,
  password: configuracao.senha, database: configuracao.banco, connectionLimit: 2, ssl: { ca, rejectUnauthorized: true } }) });
const id = (sufixo: string) => `${prefixo}-${sufixo}`;

const administrador: Usuario = { id: id("admin"), nome: "Admin", email: `${id("admin")}@teste.local`, papel: "administrador", situacao: "ativo", campus: "Pinheiral", criadoEm: "2026-11-12" };
const aluno: Usuario = { id: id("aluno"), nome: "Aluno", email: `${id("aluno")}@teste.local`, papel: "aluno", situacao: "ativo", campus: "Pinheiral", criadoEm: "2026-11-12" };

beforeAll(async () => {
  vi.stubEnv("SELIC_PERSISTENCIA", "persistente");
  vi.stubEnv("DATABASE_URL", configuracao.url);
  vi.stubEnv("SELIC_DB_CA_CERT", ca);
  vi.spyOn(store, "obterEstado").mockImplementation(() => {
    throw new Error("Simulador consultado no modo persistente.");
  });

  await prisma.usuario.create({ data: { id: administrador.id, nome: administrador.nome, email: administrador.email, situacao: "ativo", papel: "administrador" } });
  await prisma.usuario.create({ data: { id: aluno.id, nome: aluno.nome, email: aluno.email, situacao: "ativo", papel: "aluno" } });
});

afterAll(async () => {
  vi.restoreAllMocks();
  await prisma.usuario.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.$disconnect();
  descartarCliente();
  vi.unstubAllEnvs();
});

describe("modo persistente sem simulador (12.5)", () => {
  it("resolve as leituras das telas de administração, cadastro e estágio sem tocar na memória", async () => {
    await expect(listarUsuarios({ tamanho: 5 })).resolves.toMatchObject({ total: expect.any(Number) });
    await expect(usuarioPorId(administrador.id)).resolves.toMatchObject({ id: administrador.id });
    await expect(usuarioPorEmail(administrador.email)).resolves.toMatchObject({ id: administrador.id });
    await expect(contarUsuariosPorSituacao()).resolves.toMatchObject({ ativo: expect.any(Number) });
    await expect(listarMatriculas({ tamanho: 5 })).resolves.toMatchObject({ total: expect.any(Number) });
    await expect(listarImportacoesMatriculas()).resolves.toEqual(expect.any(Array));
    await expect(listarSolicitacoes({ tamanho: 5 }, administrador)).resolves.toMatchObject({ total: expect.any(Number) });
    await expect(consultarEstagios(administrador, { tamanho: 5 })).resolves.toMatchObject({ total: expect.any(Number) });
  });

  it("resolve catálogos, perfil do aluno, estatísticas e filas sem fixtures", async () => {
    await expect(listarCursos()).resolves.toEqual(expect.any(Array));
    await expect(listarTurmas(undefined, true)).resolves.toEqual(expect.any(Array));
    await expect(listarPeriodos(true)).resolves.toEqual(expect.any(Array));
    await expect(listarConvenios({ tamanho: 5 })).resolves.toMatchObject({ total: expect.any(Number) });
    await expect(dadosDoAluno(aluno)).resolves.toBeNull();
    await expect(pesquisarEstatisticas(administrador)).resolves.toMatchObject({ total: expect.any(Number) });
    await expect(documentosParaParecer("comissao_estagio", administrador)).resolves.toMatchObject({ total: expect.any(Number) });
  });
});
