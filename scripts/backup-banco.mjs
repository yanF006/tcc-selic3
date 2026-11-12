#!/usr/bin/env node
// Backup SQL consistente do MySQL do SELIC (tarefa 13.2).
//
// Uso: DATABASE_URL=... [SELIC_DB_CA_FILE=/caminho/ca.pem] [SELIC_BACKUP_DIR=dir] node scripts/backup-banco.mjs
//
// Gera o arquivo .sql, um .meta.json com versão, checksum SHA-256 e contagens por
// tabela. A senha vai só pela variável MYSQL_PWD; nunca aparece na linha de
// comando, no metadado ou na saída. Arquivos de backup não devem ir para o Git.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export function lerConexao(urlTexto) {
  const url = new URL(urlTexto);
  if (!url.hostname || !url.pathname.replace(/^\/+/, "")) {
    throw new Error("DATABASE_URL precisa informar host e nome do banco.");
  }
  return {
    host: url.hostname,
    port: url.port ? String(url.port) : "3306",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    banco: decodeURIComponent(url.pathname.replace(/^\/+/, "")),
  };
}

function argsCliente(conexao, ca) {
  const args = ["-h", conexao.host, "-P", conexao.port, "-u", conexao.user, "--default-character-set=utf8mb4"];
  if (ca) args.push(`--ssl-ca=${ca}`, "--ssl-mode=VERIFY_CA");
  return args;
}

function executar(comando, args, env, entrada) {
  const resultado = spawnSync(comando, args, { env, input: entrada, encoding: "utf8", maxBuffer: 1024 * 1024 * 1024 });
  if (resultado.status !== 0) {
    // A saída pode conter trechos da conexão; mostramos só o código e a primeira linha.
    const primeira = (resultado.stderr || "").split("\n").find((linha) => linha.trim()) ?? "";
    throw new Error(`${comando} falhou (código ${resultado.status}). ${primeira.replace(/password[^ ]*/gi, "***")}`);
  }
  return resultado.stdout;
}

export function contagensPorTabela(conexao, ca, env) {
  const tabelas = executar(
    "mysql",
    [...argsCliente(conexao, ca), "-N", "-B", "-e", `SELECT table_name FROM information_schema.tables WHERE table_schema = '${conexao.banco}' AND table_type = 'BASE TABLE' ORDER BY table_name`],
    env,
  ).split("\n").filter(Boolean);
  const contagens = {};
  for (const tabela of tabelas) {
    const valor = executar(
      "mysql",
      [...argsCliente(conexao, ca), "-N", "-B", conexao.banco, "-e", `SELECT COUNT(*) FROM \`${tabela}\``],
      env,
    ).trim();
    contagens[tabela] = Number(valor);
  }
  return contagens;
}

function principal() {
  const urlTexto = process.env.DATABASE_URL;
  if (!urlTexto) throw new Error("Defina DATABASE_URL.");
  const conexao = lerConexao(urlTexto);
  const ca = process.env.SELIC_DB_CA_FILE;
  const env = { ...process.env, MYSQL_PWD: conexao.password };
  const diretorio = resolve(process.env.SELIC_BACKUP_DIR || "backups");
  mkdirSync(diretorio, { recursive: true });

  const momento = new Date().toISOString().replace(/[:.]/g, "-");
  const base = `selic-${conexao.banco}-${momento}`;
  const arquivo = join(diretorio, `${base}.sql`);

  const sql = executar(
    "mysqldump",
    [
      ...argsCliente(conexao, ca),
      "--single-transaction",
      "--routines",
      "--triggers",
      "--set-gtid-purged=OFF",
      "--no-tablespaces",
      conexao.banco,
    ],
    env,
  );
  writeFileSync(arquivo, sql, { mode: 0o600 });
  try {
    finalizarBackup(conexao, ca, env, arquivo, base, diretorio);
  } catch (erro) {
    // Sem metadados o arquivo não é um backup comprovado: removemos o parcial.
    rmSync(arquivo, { force: true });
    throw erro;
  }
}

function finalizarBackup(conexao, ca, env, arquivo, base, diretorio) {

  const checksum = createHash("sha256").update(readFileSync(arquivo)).digest("hex");
  const contagens = contagensPorTabela(conexao, ca, env);
  const versao = executar("mysql", [...argsCliente(conexao, ca), "-N", "-B", "-e", "SELECT VERSION()"], env).trim();
  // Sem a tabela de migrações, o backup registra isso em vez de falhar: o estado
  // de versão fica explícito no metadado para a restauração conferir.
  const temMigracoes = executar(
    "mysql",
    [...argsCliente(conexao, ca), "-N", "-B", "-e", `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${conexao.banco}' AND table_name = '_prisma_migrations'`],
    env,
  ).trim() === "1";
  const migracoes = temMigracoes
    ? executar(
        "mysql",
        [...argsCliente(conexao, ca), "-N", "-B", conexao.banco, "-e", "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at"],
        env,
      ).split("\n").filter(Boolean)
    : [];

  const meta = {
    criadoEm: new Date().toISOString(),
    banco: conexao.banco,
    versaoMysql: versao,
    ultimaMigracao: migracoes.at(-1) ?? null,
    migracoesAplicadas: migracoes.length,
    arquivo: `${base}.sql`,
    bytes: statSync(arquivo).size,
    sha256: checksum,
    contagens,
  };
  writeFileSync(join(diretorio, `${base}.meta.json`), JSON.stringify(meta, null, 2) + "\n", { mode: 0o600 });

  const totalLinhas = Object.values(contagens).reduce((soma, valor) => soma + valor, 0);
  process.stdout.write(
    `Backup gerado: ${join(diretorio, `${base}.sql`)}\nsha256: ${checksum}\ntabelas: ${Object.keys(contagens).length}, linhas: ${totalLinhas}\nmetadados: ${join(diretorio, `${base}.meta.json`)}\n`,
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
