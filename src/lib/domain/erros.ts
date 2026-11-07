/** Falha de negócio com mensagem pública e código estável. */
export class ErroDeRegra extends Error {
  constructor(
    message: string,
    readonly codigo: string,
  ) {
    super(message);
    this.name = "ErroDeRegra";
  }
}
