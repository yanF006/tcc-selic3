import { DIGEST_BANCO_INDISPONIVEL, MENSAGEM_BANCO_INDISPONIVEL } from "./mensagens";

/**
 * Falha controlada de acesso ao banco. A mensagem é segura para a interface; a
 * causa original segue em `cause` apenas para log e diagnóstico no servidor.
 */
export class BancoIndisponivelError extends Error {
  readonly digest = DIGEST_BANCO_INDISPONIVEL;

  constructor(causa?: unknown) {
    super(MENSAGEM_BANCO_INDISPONIVEL, causa === undefined ? undefined : { cause: causa });
    this.name = "BancoIndisponivelError";
  }
}

/** true quando o erro (ou a cadeia de causas) é uma indisponibilidade de banco. */
export function ehBancoIndisponivel(erro: unknown): erro is BancoIndisponivelError {
  return erro instanceof BancoIndisponivelError;
}

export interface DetalhesErroBanco {
  name: string;
  message: string;
  code?: string;
  errno?: string | number;
  sqlState?: string;
  cause?: DetalhesErroBanco;
}

function valorSeguro(valor: unknown): string | undefined {
  if (valor === undefined || valor === null) return undefined;

  return redigir(String(valor));
}

/** Credenciais presentes na URL, para removê-las de qualquer mensagem. */
function credenciaisDaUrl(): string[] {
  const url = process.env.DATABASE_URL;

  if (!url) return [];

  try {
    const parsed = new URL(url);
    const usuario = decodeURIComponent(parsed.username);
    const senha = decodeURIComponent(parsed.password);

    return [usuario, senha].filter((valor) => valor.length >= 2);
  } catch {
    return [];
  }
}

/**
 * Remove URL completa, usuário e senha de textos de erro. Host e porta podem
 * permanecer no log — eles não são credenciais e ajudam no diagnóstico.
 */
export function redigir(texto: string): string {
  let resultado = texto
    .replace(/\b(mysql|mariadb|postgres(?:ql)?):\/\/\S+/gi, "[url-redigida]")
    .replace(/\b(password|passwd|pwd|senha)=([^&\s;]+)/gi, "$1=[redigido]");

  for (const credencial of credenciaisDaUrl()) {
    const escapada = credencial.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const padrao = new RegExp(`(^|[^A-Za-z0-9_])${escapada}(?=$|[^A-Za-z0-9_])`, "g");

    resultado = resultado.replace(padrao, "$1[redigido]");
  }

  return resultado;
}

/**
 * Extrai `name`, `code`, `errno`, `sqlState`, `message` e a cadeia de `cause`,
 * com profundidade limitada e sem credenciais. O retorno é serializável para o
 * log.
 */
export function detalhesDoErro(erro: unknown, profundidade = 0): DetalhesErroBanco {
  if (!(erro instanceof Error)) {
    if (typeof erro !== "object" || erro === null) {
      return {
        name: "ErroDesconhecido",
        message: redigir(typeof erro === "string" ? erro : String(erro)),
      };
    }

    const registro = erro as Record<string, unknown>;
    const mensagem = typeof registro.message === "string" ? registro.message : "Objeto de erro";

    return {
      name: typeof registro.name === "string" ? registro.name : "ErroDesconhecido",
      message: redigir(mensagem),
      ...(valorSeguro(registro.code) ? { code: valorSeguro(registro.code) } : {}),
      ...(typeof registro.errno === "number" || typeof registro.errno === "string"
        ? { errno: registro.errno }
        : {}),
      ...(valorSeguro(registro.sqlState) ? { sqlState: valorSeguro(registro.sqlState) } : {}),
      ...(profundidade < 3 && registro.cause !== undefined
        ? { cause: detalhesDoErro(registro.cause, profundidade + 1) }
        : {}),
    };
  }

  const alvo = erro as Error & {
    code?: unknown;
    errno?: unknown;
    sqlState?: unknown;
    cause?: unknown;
    meta?: { driverAdapterError?: unknown };
  };
  const causa = alvo.cause ?? alvo.meta?.driverAdapterError;

  return {
    name: alvo.name || "Error",
    message: redigir(alvo.message),
    ...(valorSeguro(alvo.code) ? { code: valorSeguro(alvo.code) } : {}),
    ...(typeof alvo.errno === "number" || typeof alvo.errno === "string"
      ? { errno: alvo.errno }
      : {}),
    ...(valorSeguro(alvo.sqlState) ? { sqlState: valorSeguro(alvo.sqlState) } : {}),
    ...(profundidade < 3 && causa !== undefined
      ? { cause: detalhesDoErro(causa, profundidade + 1) }
      : {}),
  };
}

/** Registra uma falha de banco uma vez por tentativa, com duração e causa. */
export function registrarFalhaBanco(erro: unknown, duracaoMs: number): void {
  console.warn(
    `[persistencia] Falha no banco após ${Math.max(0, Math.round(duracaoMs))} ms.`,
    detalhesDoErro(erro),
  );
}
