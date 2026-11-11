import { afterEach, expect, it, vi } from "vitest";
import { usuarioDaRequisicao } from "@/lib/auth/sessao-servidor";
import { lerArquivoKit } from "@/lib/templates/manifesto";
import { ErroDeRegra } from "@/lib/domain/erros";
import { GET } from "./route";

vi.mock("@/lib/auth/sessao-servidor", () => ({ usuarioDaRequisicao: vi.fn() }));
vi.mock("@/lib/templates/manifesto", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/templates/manifesto")>();
  return { ...original, lerArquivoKit: vi.fn(original.lerArquivoKit) };
});
afterEach(() => vi.clearAllMocks());

async function baixar(templateId: string) {
  return GET(new Request("http://localhost/documentos/baixar"), { params: Promise.resolve({ templateId }) });
}
async function autenticar() {
  vi.mocked(usuarioDaRequisicao).mockResolvedValue({ id: "gestor", nome: "Gestor", email: "gestor@teste.local", papel: "administrador", situacao: "ativo", campus: "Pinheiral", criadoEm: "2026-11-10" });
}

it("exige sessão e recusa referência desconhecida ou preenchível", async () => {
  vi.mocked(usuarioDaRequisicao).mockResolvedValue(null);
  expect((await baixar("tpl-lei-estagio")).status).toBe(401);
  await autenticar();
  expect((await baixar("inexistente")).status).toBe(404);
  expect((await baixar("tpl-termo-compromisso")).status).toBe(409);
});

it("entrega o PDF oficial validado e informa indisponibilidade sem corpo de arquivo fictício", async () => {
  await autenticar();
  const resposta = await baixar("tpl-lei-estagio");
  expect(resposta.status).toBe(200);
  expect(resposta.headers.get("content-type")).toBe("application/pdf");
  expect(resposta.headers.get("cache-control")).toBe("private, no-store");
  expect(resposta.headers.get("etag")).toMatch(/^"[a-f0-9]{64}"$/);
  expect(Buffer.from(await resposta.arrayBuffer()).subarray(0, 4).toString()).toBe("%PDF");
  vi.mocked(lerArquivoKit).mockRejectedValueOnce(new ErroDeRegra("Ausente", "arquivo_kit_indisponivel"));
  const ausente = await baixar("tpl-lei-estagio");
  expect(ausente.status).toBe(503);
  expect(await ausente.json()).toEqual({ erro: "Arquivo do Kit indisponível." });
});
