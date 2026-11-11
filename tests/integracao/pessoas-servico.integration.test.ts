import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import type { Usuario } from "@/lib/domain/types";
import { descartarCliente } from "@/lib/db/prisma";
import { ativarCadastro, consultarCadastros, removerCadastro, salvarCadastro } from "@/lib/services/cadastros";
import { listarOrientadores, listarSupervisores, pessoaPorId } from "@/lib/services/catalogo";
import { criarEstagio } from "@/lib/services/estagios";
import * as store from "@/lib/services/store";
import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base = process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");
const prefixo = `pess-${crypto.randomUUID().slice(0, 8)}`;
const cnpj = String(BigInt(`0x${crypto.randomUUID().replaceAll("-", "").slice(0, 11)}`)).padStart(14, "0");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb({
  host: configuracao.host, port: configuracao.porta, user: configuracao.usuario,
  password: configuracao.senha, database: configuracao.banco, connectionLimit: 2,
  ssl: { ca, rejectUnauthorized: true },
}) });
const ids: string[] = [];
const autor: Usuario = {
  id: `${prefixo}-autor`, nome: "Gestor", email: `${prefixo}@teste.local`,
  papel: "coordenador_estagio", situacao: "ativo", campus: "Pinheiral", criadoEm: new Date().toISOString(),
};

beforeAll(() => {
  vi.stubEnv("SELIC_PERSISTENCIA", "persistente");
  vi.stubEnv("DATABASE_URL", configuracao.url);
  vi.stubEnv("SELIC_DB_CA_CERT", ca);
  vi.spyOn(store, "obterEstado").mockImplementation(() => { throw new Error("Leitura indevida de fixtures."); });
});
afterAll(async () => {
  await prisma.usuario.deleteMany({ where: { id: `${prefixo}-autor` } });
  await prisma.pessoa.deleteMany({ where: { id: { in: ids } } });
  const instituicao = await prisma.instituicaoConcedente.findUnique({ where: { cnpj } });
  if (instituicao) {
    await prisma.convenio.deleteMany({ where: { instituicaoId: instituicao.id } });
    await prisma.instituicaoConcedente.delete({ where: { id: instituicao.id } });
  }
  await prisma.$disconnect();
  descartarCliente();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function criar(papel: "supervisor" | "orientador", sufixo: string) {
  const pessoa = await salvarCadastro(autor, papel, {
    nome: `${prefixo}-${sufixo}`, email: `  ${prefixo}-${sufixo}@TESTE.LOCAL  `,
    telefone: "2433334444", papel: "administrador", situacao: "inativo",
  });
  ids.push(pessoa.id);
  return pessoa;
}

describe("pessoas externas persistentes", () => {
  it("oferece as funções corretas em outro processo sem criar identidade de acesso", async () => {
    const antes = await Promise.all([prisma.usuario.count(), prisma.authAccount.count(), prisma.authSession.count()]);
    const orientador = await criar("orientador", "ori");
    const supervisor = await criar("supervisor", "sup");
    expect(await pessoaPorId(supervisor.id)).toMatchObject({
      papel: "supervisor", situacao: "ativo", email: `${prefixo}-sup@teste.local`,
    });
    const script = fileURLToPath(new URL("../support/listar-pessoas-processo.ts", import.meta.url));
    const contexto = new URL("../support/contexto-servidor.mjs", import.meta.url).href;
    const { stdout } = await promisify(execFile)(process.execPath,
      ["--import", "tsx", "--import", contexto, script, prefixo], { env: { ...process.env }, timeout: 20_000 });
    expect(JSON.parse(stdout)).toMatchObject({
      orientadores: [expect.objectContaining({ id: orientador.id, papel: "orientador" })],
      supervisores: [expect.objectContaining({ id: supervisor.id, papel: "supervisor" })],
    });
    expect((await consultarCadastros(autor)).pessoas).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: orientador.id }), expect.objectContaining({ id: supervisor.id }),
    ]));
    expect(await Promise.all([prisma.usuario.count(), prisma.authAccount.count(), prisma.authSession.count()])).toEqual(antes);
  });

  it("recusa função incompatível na edição, inativação e seleção de estágio", async () => {
    const orientador = await criar("orientador", "papel");
    await expect(salvarCadastro(autor, "supervisor", { nome: "Não gravar" }, orientador.id)).rejects.toMatchObject({ codigo: "nao_encontrado" });
    await expect(removerCadastro(autor, "supervisor", orientador.id, true)).rejects.toMatchObject({ codigo: "nao_encontrado" });
    await expect(ativarCadastro(autor, "supervisor", orientador.id)).rejects.toMatchObject({ codigo: "nao_encontrado" });
    expect(await pessoaPorId(orientador.id)).toMatchObject({ nome: `${prefixo}-papel`, papel: "orientador", situacao: "ativo" });
    const convenio = await salvarCadastro(autor, "convenio", {
      nome: prefixo, instituicao: prefixo, cnpj, inicioVigencia: "2026-01-01",
    });
    const aluno: Usuario = { ...autor, papel: "aluno" };
    await prisma.usuario.create({ data: { id: aluno.id, nome: aluno.nome, email: aluno.email, papel: "aluno", situacao: "ativo" } });
    const dados = { convenioId: convenio.id, supervisorId: orientador.id, orientadorId: orientador.id,
      dataInicio: "2026-12-01", dataFim: "2027-01-31" };
    await expect(criarEstagio(aluno, dados)).rejects.toMatchObject({ codigo: "supervisor_invalido" });
    const supervisor = await criar("supervisor", "papel-sup");
    await expect(criarEstagio(aluno, { ...dados, supervisorId: supervisor.id, orientadorId: supervisor.id })).rejects.toMatchObject({ codigo: "orientador_invalido" });
    await expect(salvarCadastro(aluno, "supervisor", { nome: "Negado" })).rejects.toMatchObject({ codigo: "acesso_negado" });
    const antes = await prisma.pessoa.count();
    await expect(salvarCadastro(autor, "orientador", { nome: "Ausente" }, `${prefixo}-ausente`)).rejects.toMatchObject({ codigo: "nao_encontrado" });
    expect(await prisma.pessoa.count()).toBe(antes);
  });

  it("inativa, reativa e anonimiza sem perder a referência por ID", async () => {
    const supervisor = await criar("supervisor", "ciclo");
    await salvarCadastro(autor, "supervisor", { nome: `${prefixo}-editado`, email: "", telefone: "" }, supervisor.id);
    await removerCadastro(autor, "supervisor", supervisor.id, true);
    expect((await listarSupervisores()).map((pessoa) => pessoa.id)).not.toContain(supervisor.id);
    expect(await pessoaPorId(supervisor.id)).toMatchObject({ situacao: "inativo", nome: `${prefixo}-editado` });
    await ativarCadastro(autor, "supervisor", supervisor.id);
    expect((await listarSupervisores()).map((pessoa) => pessoa.id)).toContain(supervisor.id);
    expect((await listarOrientadores()).map((pessoa) => pessoa.id)).not.toContain(supervisor.id);
    await prisma.pessoa.update({ where: { id: supervisor.id }, data: { cpf: "12345678901", rg: "1234567", endereco: { logradouro: "Rua A" } } });
    await removerCadastro(autor, "supervisor", supervisor.id);
    expect(await pessoaPorId(supervisor.id)).toMatchObject({ nome: "Cadastro excluído", email: "", telefone: "", situacao: "inativo", dadosPessoais: undefined });
    expect(await prisma.pessoa.findUnique({ where: { id: supervisor.id } })).toMatchObject({ cpf: null, rg: null, endereco: null });
  });
});
