import { afterEach, expect, it, vi } from "vitest";
import { usuarioDaRequisicao } from "@/lib/auth/sessao-servidor";
import { baixarArquivo, exigirAcessoAnexos, listarArquivos, salvarArquivo } from "@/lib/services/arquivos";
import { ErroDeRegra } from "@/lib/domain/erros";
import { GET, POST } from "./route";
import { GET as download } from "@/app/api/arquivos/[arquivoId]/route";

vi.mock("@/lib/auth/sessao-servidor", () => ({ usuarioDaRequisicao: vi.fn() }));
vi.mock("@/lib/services/arquivos", () => ({ baixarArquivo: vi.fn(), exigirAcessoAnexos: vi.fn(), listarArquivos: vi.fn(), salvarArquivo: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const contexto = () => ({ params: Promise.resolve({ documentoId: "doc" }) });
function sessao() {
  vi.mocked(usuarioDaRequisicao).mockResolvedValue({ id: "autor", nome: "Autor", email: "autor@teste.local", papel: "aluno", situacao: "ativo", campus: "Pinheiral", criadoEm: "2026-11-10" });
}
function requisicao(origin = "http://localhost") {
  return new Request("http://localhost/api/documentos/doc/arquivos", { method: "POST", body: "%PDF-1.7", headers: { origin, "content-type": "application/pdf", "x-arquivo-nome": "documento.pdf", "x-arquivo-finalidade": "assinado" } });
}

it("exige sessão/origem e verifica acesso antes de ler o corpo", async () => {
  vi.mocked(usuarioDaRequisicao).mockResolvedValue(null);
  expect((await POST(requisicao(), contexto())).status).toBe(401);
  sessao();
  expect((await POST(requisicao("https://outro.local"), contexto())).status).toBe(403);
  vi.mocked(exigirAcessoAnexos).mockRejectedValue(new ErroDeRegra("Indisponível", "acesso_negado"));
  const request = requisicao();
  const ler = vi.spyOn(request.body!, "getReader");
  expect((await POST(request, contexto())).status).toBe(404);
  expect(ler).not.toHaveBeenCalled();
  expect(salvarArquivo).not.toHaveBeenCalled();
});

it("envia bytes limitados ao serviço e retorna somente os metadados", async () => {
  sessao();
  vi.mocked(salvarArquivo).mockResolvedValue({ id: "arq", documentoId: "doc", nome: "documento.pdf", mimeType: "application/pdf", finalidade: "assinado", tamanhoBytes: 8, checksum: "a".repeat(64), autorId: "autor", criadoEm: "2026-11-10" });
  const resposta = await POST(requisicao(), contexto());
  expect(resposta.status).toBe(201);
  expect(salvarArquivo).toHaveBeenCalledWith("autor", "doc", expect.objectContaining({ nome: "documento.pdf", finalidade: "assinado", conteudo: new Uint8Array(Buffer.from("%PDF-1.7")) }));
  expect(await resposta.json()).toMatchObject({ arquivo: { id: "arq" } });
  vi.mocked(listarArquivos).mockResolvedValue([]);
  const lista = await GET(new Request("http://localhost/api/documentos/doc/arquivos"), contexto());
  expect(lista.headers.get("cache-control")).toBe("private, no-store");
  expect(await lista.json()).toEqual({ arquivos: [] });
});

it("entrega download privado somente após autenticação e nega acesso sem expor o arquivo", async () => {
  const contextoDownload = () => ({ params: Promise.resolve({ arquivoId: "arq" }) });
  vi.mocked(usuarioDaRequisicao).mockResolvedValue(null);
  expect((await download(new Request("http://localhost/api/arquivos/arq"), contextoDownload())).status).toBe(401);
  sessao();
  vi.mocked(baixarArquivo).mockRejectedValueOnce(new ErroDeRegra("Indisponível", "acesso_negado"));
  expect((await download(new Request("http://localhost/api/arquivos/arq"), contextoDownload())).status).toBe(404);
  vi.mocked(baixarArquivo).mockResolvedValue({ id: "arq", documentoId: "doc", nome: "recebido.pdf", mimeType: "application/pdf", finalidade: "assinado", tamanhoBytes: 5, checksum: "a".repeat(64), autorId: "autor", criadoEm: "2026-11-10", conteudo: new Uint8Array(Buffer.from("%PDF-")) });
  const resposta = await download(new Request("http://localhost/api/arquivos/arq"), contextoDownload());
  expect(resposta.headers.get("cache-control")).toBe("private, no-store");
  expect(resposta.headers.get("x-content-type-options")).toBe("nosniff");
  expect(await resposta.text()).toBe("%PDF-");
});
