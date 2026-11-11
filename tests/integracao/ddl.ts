import { homedir } from "node:os";
import { join } from "node:path";

import * as mariadb from "mariadb";

import type { ConfiguracaoTeste } from "./configuracao";

const base =
  process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");

/**
 * Cria o executor de DDL administrativo dos testes (sondas de falha em
 * triggers e limpeza), sempre como root na instância isolada de testes. No
 * Linux a administração usa o socket local do mysqld; no Windows, sem socket
 * Unix, usa a porta TCP em loopback da mesma instância.
 */
export function criarExecutorDdl(configuracao: ConfiguracaoTeste) {
  return async (sql: string) => {
    const conexao = await mariadb.createConnection({
      ...(process.platform === "win32"
        ? { host: configuracao.host, port: configuracao.porta }
        : { socketPath: join(base, "run/mysql.sock") }),
      user: "root",
      database: configuracao.banco,
      multipleStatements: true,
    });
    try {
      await conexao.query(sql);
    } finally {
      await conexao.end();
    }
  };
}
