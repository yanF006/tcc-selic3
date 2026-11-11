import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AnexosDocumento } from "./anexos-documento";
import { LIMITE_ARQUIVO_BYTES } from "@/lib/domain/arquivos";

afterEach(() => vi.unstubAllGlobals());
it("preserva a seleção após falha e não envia arquivo maior que quatro MiB", async () => {
  const rede = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ erro: "Falha de gravação." }) });
  vi.stubGlobal("fetch", rede);
  const tela = render(<AnexosDocumento documentoId="doc" arquivosIniciais={[]} podeAnexar comprovantesPermitidos />);
  const input = screen.getByLabelText("Arquivo (até 4 MiB)") as HTMLInputElement;
  const arquivo = new File(["%PDF-1.7"], "teste.pdf", { type: "application/pdf" });
  fireEvent.change(input, { target: { files: [arquivo] } });
  fireEvent.submit(tela.container.querySelector("form")!);
  expect(await screen.findByText("Falha de gravação.")).toBeInTheDocument();
  expect(input.files?.[0]).toBe(arquivo);
  const grande = new File(["x"], "grande.pdf", { type: "application/pdf" });
  Object.defineProperty(grande, "size", { value: LIMITE_ARQUIVO_BYTES + 1 });
  fireEvent.change(input, { target: { files: [grande] } });
  fireEvent.submit(tela.container.querySelector("form")!);
  await waitFor(() => expect(screen.getByText("O limite por arquivo é de 4 MiB.")).toBeInTheDocument());
  expect(rede).toHaveBeenCalledOnce();
});
