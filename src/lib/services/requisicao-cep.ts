/** Limita também a leitura do corpo. Cancelamento do chamador continua distinguível. */
export async function requisicaoCep<T>(
  url: string,
  limite: number,
  interpretar: (resposta: Response) => Promise<T>,
  sinal?: AbortSignal,
): Promise<T> {
  const controle = new AbortController();
  const cancelar = () => controle.abort(sinal?.reason);
  sinal?.addEventListener("abort", cancelar, { once: true });
  if (sinal?.aborted) cancelar();
  const temporizador = setTimeout(
    () => controle.abort(new Error("Tempo de consulta excedido.")),
    limite,
  );
  try {
    controle.signal.throwIfAborted();
    return await interpretar(await fetch(url, { signal: controle.signal, cache: "no-store" }));
  } finally {
    clearTimeout(temporizador);
    sinal?.removeEventListener("abort", cancelar);
  }
}
