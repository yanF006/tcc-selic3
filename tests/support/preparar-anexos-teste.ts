import { readFile } from "node:fs/promises";
import * as mariadb from "mariadb";
import { homedir } from "node:os";
import { join } from "node:path";
import { carregarUrlAppTeste, validarUrlTeste } from "../integracao/configuracao";

async function executar() {
const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const ca = await readFile(join(process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste"), "tls/ca.pem"), "utf8");
const conexao = await mariadb.createConnection({ host: configuracao.host, port: configuracao.porta, user: configuracao.usuario, password: configuracao.senha, database: configuracao.banco, ssl: { ca, rejectUnauthorized: true } });
try {
  const colunas = await conexao.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'arquivos' AND COLUMN_NAME = 'finalidade'", [configuracao.banco]);
  if (!colunas.length) await conexao.query(await readFile(new URL("../../prisma/migrations/20261110000100_finalidade_arquivos/migration.sql", import.meta.url), "utf8"));
  console.log("Migração de finalidade de anexos aplicada/conferida somente em selic_teste_app.");
} finally { await conexao.end(); }
}
executar().catch(() => { console.error("Falha na preparação de anexos no banco isolado."); process.exitCode = 1; });
