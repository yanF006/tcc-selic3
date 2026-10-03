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
