export interface ConfiguracaoAutenticacao {
  origem: string;
  segredo: string;
}

/** Origem canônica explícita; nunca deriva confiança de headers da requisição. */
export function carregarConfiguracaoAutenticacao(
  ambiente: Record<string, string | undefined> = process.env,
): ConfiguracaoAutenticacao {
  const origem = ambiente.BETTER_AUTH_URL?.trim();
  const segredo = ambiente.BETTER_AUTH_SECRET;
  if (!origem) throw new Error("BETTER_AUTH_URL não configurada.");
  const url = new URL(origem);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("BETTER_AUTH_URL deve conter somente uma origem HTTP(S).");
  if (ambiente.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("BETTER_AUTH_URL deve usar HTTPS em produção.");
  }
  if (!segredo || segredo.trim().length < 32) {
    throw new Error("BETTER_AUTH_SECRET deve ter pelo menos 32 caracteres.");
  }
  return { origem: url.origin, segredo };
}
