import { BancoIndisponivelError } from "@/lib/db/erros";

/**
 * Erros de regra de negócio. A interface web exibe `mensagem` no formulário e o
 * backend vai mapear `codigo` para o código HTTP correspondente.
 */

export class ErroDeRegra extends Error {
  constructor(
    message: string,
    readonly codigo: string,
  ) {
    super(message);
    this.name = "ErroDeRegra";
  }
}

/**
 * Mensagem segura para Server Actions. Erros de regra continuam mostrando o
 * texto de negócio; indisponibilidade de banco usa a mensagem genérica; qualquer
 * outro erro não vaza detalhes internos para o formulário.
 */
export function mensagemSeguraParaUsuario(erro: unknown): string {
  if (erro instanceof ErroDeRegra) return erro.message;

  if (erro instanceof BancoIndisponivelError) return erro.message;

  return "Não foi possível concluir a operação.";
}
