import { describe, expect, it, vi } from "vitest";
import { lerCorpoArquivo } from "./arquivos";
import { LIMITE_ARQUIVO_BYTES } from "@/lib/domain/arquivos";

describe("leitura limitada de upload", () => {
  it("recusa tamanho declarado antes de consumir o corpo", async () => {
    const request = new Request("http://localhost/upload", { method: "POST", body: "pequeno", headers: { "content-length": String(LIMITE_ARQUIVO_BYTES + 1) } });
    const ler = vi.spyOn(request.body!, "getReader");
    await expect(lerCorpoArquivo(request)).rejects.toMatchObject({ codigo: "arquivo_excede_limite" });
    expect(ler).not.toHaveBeenCalled();
  });
  it("cancela um stream sem Content-Length ao ultrapassar quatro MiB", async () => {
    const cancelar = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new Uint8Array(LIMITE_ARQUIVO_BYTES)); controller.enqueue(new Uint8Array(1));
    }, cancel: cancelar });
    const opcoes: RequestInit & { duplex: string } = { method: "POST", body: stream, duplex: "half" };
    await expect(lerCorpoArquivo(new Request("http://localhost/upload", opcoes))).rejects.toMatchObject({ codigo: "arquivo_excede_limite" });
    expect(cancelar).toHaveBeenCalledOnce();
  });
  it("retorna os bytes e rejeita corpo incompleto", async () => {
    expect(await lerCorpoArquivo(new Request("http://localhost/upload", { method: "POST", body: "abc" }))).toEqual(new Uint8Array([97, 98, 99]));
    await expect(lerCorpoArquivo(new Request("http://localhost/upload", { method: "POST", body: "abc", headers: { "content-length": "5" } }))).rejects.toMatchObject({ codigo: "arquivo_invalido" });
  });
});
