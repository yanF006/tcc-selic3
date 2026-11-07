import "dotenv/config";

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ConfiguracaoTeste {
  url: string;
  host: string;
  porta: number;
  usuario: string;
  senha: string;
  banco: string;
}

const BASE_PADRAO = join(homedir(), ".local/share/selic-mysql-teste");

type Ambiente = Record<string, string | undefined>;

function lerCredencial(nome: string, ambiente: Ambiente): string {
  const base = ambiente.SELIC_MYSQL_TESTE_BASE?.trim() || BASE_PADRAO;
  const arquivo = join(base, "credentials.env");
  if (!existsSync(arquivo)) {
    throw new Error(
      `${nome} ausente. Execute \`scripts/banco-teste.sh iniciar\` antes dos testes de integração.`,
    );
  }

  const prefixo = `${nome}=`;
  const linha = readFileSync(arquivo, "utf8")
    .split("\n")
    .find((item) => item.startsWith(prefixo));
  if (!linha) {
    throw new Error(`${nome} não encontrada em ${arquivo}.`);
  }

  return linha.slice(prefixo.length).trim();
}

/** Lê a URL exclusiva de testes; nunca cai para `DATABASE_URL`. */
export function carregarUrlTeste(ambiente: Ambiente = process.env): string {
  return ambiente.TEST_DATABASE_URL?.trim() || lerCredencial("TEST_DATABASE_URL", ambiente);
}

/** Lê a URL do schema completo de modelos; nunca cai para `DATABASE_URL`. */
export function carregarUrlAppTeste(ambiente: Ambiente = process.env): string {
  return ambiente.TEST_APP_DATABASE_URL?.trim() || lerCredencial("TEST_APP_DATABASE_URL", ambiente);
}

/**
 * Recusa qualquer destino que não seja a instância isolada de testes: loopback,
 * schema de teste e URL diferente da usada pela aplicação.
 */
export function validarUrlTeste(
  urlString: string,
  ambiente: Ambiente = process.env,
  bancoEsperado: string = ambiente.SELIC_MYSQL_TESTE_BANCO?.trim() || "selic_teste",
): ConfiguracaoTeste {
  let url: URL;

  try {
    url = new URL(urlString);
  } catch {
    throw new Error("TEST_DATABASE_URL não é uma URL válida.");
  }

  if (url.protocol !== "mysql:") {
    throw new Error("TEST_DATABASE_URL deve usar o protocolo mysql://.");
  }

  const host = url.hostname;
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
    throw new Error("TEST_DATABASE_URL deve apontar para o banco local de testes (loopback).");
  }

  const banco = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (banco !== bancoEsperado) {
    throw new Error(
      `A URL de teste deve apontar para o schema ${bancoEsperado}; recebido "${banco}".`,
    );
  }

  const urlAplicacao = ambiente.DATABASE_URL?.trim();
  if (urlAplicacao && urlAplicacao === urlString) {
    throw new Error("A URL de teste não pode ser igual à DATABASE_URL da aplicação.");
  }

  const urlAutenticacao = ambiente.TEST_DATABASE_URL?.trim();
  if (bancoEsperado !== "selic_teste" && urlAutenticacao && urlAutenticacao === urlString) {
    throw new Error("A URL do schema de modelos deve ser diferente da URL de autenticação.");
  }

  return {
    url: urlString,
    host,
    porta: url.port ? Number(url.port) : 3306,
    usuario: decodeURIComponent(url.username),
    senha: decodeURIComponent(url.password),
    banco,
  };
}
