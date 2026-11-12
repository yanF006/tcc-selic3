#!/usr/bin/env node
// Restauração de backup SQL em banco isolado de ensaio (tarefa 13.2).
//
// Uso:
//   DATABASE_URL=... SELIC_RESTAURACAO_CONFIRMA=<nome do banco> \
//     node scripts/restaurar-backup.mjs --arquivo caminho/backup.sql [--limpar]
//
// Travas, nesta ordem:
//  1. O banco de destino precisa ser de ensaio (sufixo _ensaio, _restauracao ou _teste).
//     Nunca o nome de produção "selic".
//  2. SELIC_RESTAURACAO_CONFIRMA precisa repetir exatamente o nome do banco de destino.
//  3. O SHA-256 do arquivo precisa bater com o metadado gerado pelo backup.
//  4. Banco de destino com tabelas só é apagado com --limpar (mesma confirmação).
// Depois da carga, as contagens por tabela são comparadas com o metadado.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { lerConexao, contagensPorTabela } from "./backup-banco.mjs";

const NOME_DE_ENSAIO = /(_ensaio|_restauracao|_teste)$/;
const NOME_DE_PRODUCAO = "selic";

function executar(comando, args, env, entrada) {
  const resultado = spawnSync(comando, args, { env, input: entrada, encoding: "utf8", maxBuffer: 1024 * 1024 * 1024 });
  if (resultado.status !== 0) {
    const primeira = (resultado.stderr || "").split("\n").find((linha) => linha.trim()) ?? "";
    throw new Error(`${comando} falhou (código ${resultado.status}). ${primeira.replace(/password[^ ]*/gi, "***")}`);
  }
  return resultado.stdout;
}

export function validarDestino(banco, confirmacao) {
  if (banco === NOME_DE_PRODUCAO || !NOME_DE_ENSAIO.test(banco)) {
    throw new Error(`Destino "${banco}" não é um banco de ensaio. Use nome com _ensaio, _restauracao ou _teste.`);
  }
  if (confirmacao !== banco) {
    throw new Error(`Confirmação ausente: defina SELIC_RESTAURACAO_CONFIRMA=${banco} para restaurar.`);
  }
}

function argumento(nome) {
  const indice = process.argv.indexOf(nome);
  return indice >= 0 ? process.argv[indice + 1] : undefined;
}

function principal() {
  const arquivo = argumento("--arquivo");
  if (!arquivo || !existsSync(arquivo)) throw new Error("Informe --arquivo com um backup existente.");
  const metaArquivo = arquivo.replace(/\.sql$/, ".meta.json");
  if (!existsSync(metaArquivo)) throw new Error("Metadado do backup ausente: restauração recusada.");
  const meta = JSON.parse(readFileSync(metaArquivo, "utf8"));

  const urlTexto = process.env.DATABASE_URL;
  if (!urlTexto) throw new Error("Defina DATABASE_URL apontando ao banco de ensaio.");
  const conexao = lerConexao(urlTexto);
  validarDestino(conexao.banco, process.env.SELIC_RESTAURACAO_CONFIRMA);

  const conteudo = readFileSync(arquivo);
  const checksum = createHash("sha256").update(conteudo).digest("hex");
  if (checksum !== meta.sha256) throw new Error("Checksum do backup não confere com o metadado: restauração recusada.");

  const ca = process.env.SELIC_DB_CA_FILE;
  const env = { ...process.env, MYSQL_PWD: conexao.password };
  const cliente = ["-h", conexao.host, "-P", conexao.port, "-u", conexao.user, "--default-character-set=utf8mb4"];
  if (ca) cliente.push(`--ssl-ca=${ca}`, "--ssl-mode=VERIFY_CA");

  const tabelasExistentes = Number(
    executar("mysql", [...cliente, "-N", "-B", "-e", `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${conexao.banco}'`], env).trim(),
  );
  if (tabelasExistentes > 0) {
    if (!process.argv.includes("--limpar")) throw new Error("Destino já tem tabelas: use --limpar para recriar o banco de ensaio.");
    executar("mysql", [...cliente, "-e", `DROP DATABASE \`${conexao.banco}\`; CREATE DATABASE \`${conexao.banco}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`], env);
  } else {
    executar("mysql", [...cliente, "-e", `CREATE DATABASE IF NOT EXISTS \`${conexao.banco}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`], env);
  }

  executar("mysql", [...cliente, conexao.banco], env, conteudo.toString("utf8"));

  const obtidas = contagensPorTabela(conexao, ca, env);
  const divergencias = Object.keys({ ...meta.contagens, ...obtidas }).filter((tabela) => meta.contagens[tabela] !== obtidas[tabela]);
  if (divergencias.length > 0) {
    throw new Error(`Contagens divergentes após a restauração em: ${divergencias.join(", ")}.`);
  }

  const totalLinhas = Object.values(obtidas).reduce((soma, valor) => soma + valor, 0);
  process.stdout.write(
    `Restauração conferida: banco ${conexao.banco}, ${Object.keys(obtidas).length} tabelas, ${totalLinhas} linhas, checksum OK.\n`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    principal();
  } catch (erro) {
    process.stderr.write(`${erro.message}\n`);
    process.exitCode = 1;
  }
}
