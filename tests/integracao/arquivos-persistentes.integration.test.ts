import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import * as mariadb from "mariadb";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { descartarCliente } from "@/lib/db/prisma";
import { checksumDefinicao, definicaoKit } from "@/lib/templates/manifesto";
import { LIMITE_ARQUIVO_BYTES } from "@/lib/domain/arquivos";
import { baixarArquivo, listarArquivos, salvarArquivo } from "@/lib/services/arquivos";
import * as store from "@/lib/services/store";
import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base = process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");
const prefixo = `arq-${crypto.randomUUID().slice(0, 8)}`;
const autorId = `${prefixo}-autor`;
const outroId = `${prefixo}-outro`;
const documentoId = `${prefixo}-doc`;
const gatilho = `probe_${prefixo.replaceAll("-", "_")}`;
const prisma = new PrismaClient({ adapter: new PrismaMariaDb({ host: configuracao.host, port: configuracao.porta, user: configuracao.usuario, password: configuracao.senha, database: configuracao.banco, connectionLimit: 2, ssl: { ca, rejectUnauthorized: true } }) });
const pdf = Buffer.from("%PDF-1.7\nArquivo recebido de teste\n%%EOF");
const entrada = { nome: "documento.pdf", mimeType: "application/pdf", finalidade: "assinado", conteudo: pdf };

async function ddl(sql: string) {
  const conexao = await mariadb.createConnection({ socketPath: join(base, "run/mysql.sock"), user: "root", database: configuracao.banco });
  try { await conexao.query(sql); } finally { await conexao.end(); }
}
beforeAll(async () => {
  vi.stubEnv("SELIC_PERSISTENCIA", "persistente"); vi.stubEnv("DATABASE_URL", configuracao.url); vi.stubEnv("SELIC_DB_CA_CERT", ca);
  vi.spyOn(store, "obterEstado").mockImplementation(() => { throw new Error("Fixtures proibidas."); });
  for (const id of [autorId, outroId]) await prisma.usuario.create({ data: { id, nome: id, email: `${id}@teste.local`, situacao: "ativo", papel: id === autorId ? "administrador" : "aluno" } });
  const definicao = definicaoKit("tpl-convenio-estagio")!;
  await prisma.documentoPreenchido.create({ data: { id: documentoId, alunoId: autorId, templateId: definicao.chave, versaoTemplate: 2, definicaoChecksum: definicao.checksum, definicaoSnapshot: definicao.descritor as unknown as Prisma.InputJsonValue, valores: {}, situacao: "rascunho" } });
});
afterAll(async () => {
  await ddl(`DROP TRIGGER IF EXISTS ${gatilho}`);
  await prisma.arquivo.deleteMany({ where: { documentoId } });
  await prisma.documentoPreenchido.deleteMany({ where: { id: documentoId } });
  await prisma.usuario.deleteMany({ where: { id: { in: [autorId, outroId] } } });
  await prisma.$disconnect(); descartarCliente(); vi.restoreAllMocks(); vi.unstubAllEnvs();
});

describe("anexos privados persistentes", () => {
  it("preserva bytes, checksum e finalidade em outro processo sem alterar assinaturas/situação", async () => {
    const antes = await prisma.documentoPreenchido.findUniqueOrThrow({ where: { id: documentoId } });
    const gravar = fileURLToPath(new URL("../support/salvar-arquivo-processo.ts", import.meta.url));
    const contexto = new URL("../support/contexto-servidor.mjs", import.meta.url).href;
    const { stdout: gravado } = await promisify(execFile)(process.execPath, ["--import", "tsx", "--import", contexto, gravar, autorId, documentoId], { env: { ...process.env }, timeout: 20_000 });
    // O processo que gravou já terminou; o download abaixo inicia outro runtime.
    const arquivo = JSON.parse(gravado);
    expect(arquivo).toMatchObject({ nome: "recebido.pdf", finalidade: "assinado", tamanhoBytes: pdf.byteLength, checksum: createHash("sha256").update(pdf).digest("hex") });
    const script = fileURLToPath(new URL("../support/baixar-arquivo-processo.ts", import.meta.url));
    const { stdout } = await promisify(execFile)(process.execPath, ["--import", "tsx", "--import", contexto, script, autorId, arquivo.id], { env: { ...process.env }, timeout: 20_000 });
    expect(JSON.parse(stdout)).toMatchObject({ id: arquivo.id, finalidade: "assinado", checksum: arquivo.checksum, conteudo: pdf.toString("base64") });
    const lista = await listarArquivos(autorId, documentoId);
    expect(lista.find((item) => item.id === arquivo.id)).toEqual(arquivo);
    expect(lista.every((item) => !("conteudo" in item))).toBe(true);
    const depois = await prisma.documentoPreenchido.findUniqueOrThrow({ where: { id: documentoId } });
    expect(depois.situacao).toBe(antes.situacao);
    expect(depois.assinaturasConfirmadasEm).toBeNull();
    expect(depois.registradoEm).toBeNull();
    const coluna = await prisma.$queryRaw<{ DATA_TYPE: string }[]>`SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ${configuracao.banco} AND TABLE_NAME = 'arquivos' AND COLUMN_NAME = 'conteudo'`;
    expect(coluna[0].DATA_TYPE.toLowerCase()).toBe("longblob");
  });

  it("aceita o limite exato e recusa excesso, bytes incompatíveis e PNG como assinado sem escrita parcial", async () => {
    const maximo = Buffer.alloc(LIMITE_ARQUIVO_BYTES); pdf.copy(maximo);
    const grande = await salvarArquivo(autorId, documentoId, { ...entrada, conteudo: maximo });
    expect((await baixarArquivo(autorId, grande.id)).conteudo.byteLength).toBe(LIMITE_ARQUIVO_BYTES);
    const antes = await prisma.arquivo.count({ where: { documentoId } });
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);
    await expect(salvarArquivo(autorId, documentoId, { ...entrada, conteudo: Buffer.alloc(LIMITE_ARQUIVO_BYTES + 1) })).rejects.toMatchObject({ codigo: "arquivo_excede_limite" });
    await expect(salvarArquivo(autorId, documentoId, { ...entrada, conteudo: Buffer.from("<html>não é PDF</html>") })).rejects.toMatchObject({ codigo: "tipo_arquivo_invalido" });
    await expect(salvarArquivo(autorId, documentoId, { nome: "imagem.png", mimeType: "image/png", finalidade: "assinado", conteudo: png })).rejects.toMatchObject({ codigo: "tipo_arquivo_invalido" });
    expect(await prisma.arquivo.count({ where: { documentoId } })).toBe(antes);
    await salvarArquivo(autorId, documentoId, { nome: "imagem.png", mimeType: "image/png", finalidade: "comprovante", conteudo: png });
    await salvarArquivo(autorId, documentoId, { nome: "imagem.jpg", mimeType: "image/jpeg", finalidade: "comprovante", conteudo: Buffer.from([255, 216, 255, 1]) });
  });

  it("nega outra conta e conta inativada e recusa binário adulterado", async () => {
    const arquivo = await salvarArquivo(autorId, documentoId, entrada);
    await expect(listarArquivos(outroId, documentoId)).rejects.toMatchObject({ codigo: "acesso_negado" });
    await expect(baixarArquivo(outroId, arquivo.id)).rejects.toMatchObject({ codigo: "acesso_negado" });
    await expect(salvarArquivo(outroId, documentoId, entrada)).rejects.toMatchObject({ codigo: "acesso_negado" });
    await prisma.usuario.update({ where: { id: autorId }, data: { situacao: "inativo" } });
    try { await expect(baixarArquivo(autorId, arquivo.id)).rejects.toMatchObject({ codigo: "acesso_negado" }); }
    finally { await prisma.usuario.update({ where: { id: autorId }, data: { situacao: "ativo" } }); }
    await prisma.arquivo.update({ where: { id: arquivo.id }, data: { conteudo: Buffer.from("conteúdo adulterado") } });
    await expect(baixarArquivo(autorId, arquivo.id)).rejects.toMatchObject({ codigo: "arquivo_indisponivel" });
  });

  it("desfaz o binário e seus metadados se a atualização do documento falha", async () => {
    const antes = await prisma.arquivo.count({ where: { documentoId } });
    await ddl(`CREATE TRIGGER ${gatilho} BEFORE UPDATE ON documentos_preenchidos FOR EACH ROW BEGIN IF NEW.id = '${documentoId}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'probe_anexo'; END IF; END`);
    try { await expect(salvarArquivo(autorId, documentoId, entrada)).rejects.toThrow(); }
    finally { await ddl(`DROP TRIGGER IF EXISTS ${gatilho}`); }
    expect(await prisma.arquivo.count({ where: { documentoId } })).toBe(antes);
  });

  it("não usa o upload para contornar parecer pendente ou editar comprovantes após submissão", async () => {
    const original = await prisma.documentoPreenchido.findUniqueOrThrow({ where: { id: documentoId } });
    const snapshot = definicaoKit("tpl-convenio-estagio")!.descritor;
    snapshot.metadados!.tipoParecer = "coordenador_curso";
    const antes = await prisma.arquivo.count({ where: { documentoId } });
    await prisma.documentoPreenchido.update({ where: { id: documentoId }, data: { situacao: "submetido", definicaoSnapshot: snapshot as unknown as Prisma.InputJsonValue, definicaoChecksum: checksumDefinicao(snapshot) } });
    try {
      await expect(salvarArquivo(autorId, documentoId, entrada)).rejects.toMatchObject({ codigo: "parecer_pendente" });
      await expect(salvarArquivo(autorId, documentoId, { ...entrada, finalidade: "comprovante" })).rejects.toMatchObject({ codigo: "documento_bloqueado" });
      expect(await prisma.arquivo.count({ where: { documentoId } })).toBe(antes);
    } finally {
      await prisma.documentoPreenchido.update({ where: { id: documentoId }, data: { situacao: original.situacao, definicaoSnapshot: original.definicaoSnapshot as Prisma.InputJsonValue, definicaoChecksum: original.definicaoChecksum } });
    }
  });
});
