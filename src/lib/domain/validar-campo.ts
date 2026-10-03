import type { ZodType } from "zod";

/**
 * Validação de campo compartilhada entre as telas de dados pessoais (D7).
 *
 * O mesmo esquema Zod roda no navegador e no servidor; aqui só se extrai a
 * mensagem, para o formulário controlado do cadastro e o formulário do React
 * Hook Form no perfil mostrarem exatamente o mesmo texto.
 */
export function mensagemDeErro(esquema: ZodType, valor: string): string | null {
  const resultado = esquema.safeParse(valor);

  if (resultado.success) return null;

  return resultado.error.issues[0]?.message ?? "Valor inválido.";
}