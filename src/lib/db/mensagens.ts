/**
 * Mensagem exibida ao usuário quando o banco configurado não responde.
 *
 * O texto é genérico de propósito: não inclui host, usuário, senha, URL nem
 * detalhes do driver. O diagnóstico completo fica apenas no log do servidor.
 */
export const MENSAGEM_BANCO_INDISPONIVEL =
  "Os dados estão indisponíveis no momento. Tente novamente em instantes.";

/** Digest estável para o error boundary distinguir falha de banco de erro inesperado. */
export const DIGEST_BANCO_INDISPONIVEL = "SELIC_BANCO_INDISPONIVEL";
