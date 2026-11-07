import { beforeEach, describe, expect, it, vi } from "vitest";
import { BancoIndisponivelError } from "@/lib/db/erros";

const mocks = vi.hoisted(() => ({
  banco: vi.fn(() => true),
  headers: new Headers({ Cookie: "selic-sessao=usr-legado" }),
  cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  consultar: vi.fn(),
  usuarioSimulado: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: async () => mocks.headers,
  cookies: async () => mocks.cookies,
}));
vi.mock("@/lib/db/prisma", () => ({ bancoConfigurado: mocks.banco }));
vi.mock("@/lib/services/administracao", () => ({ usuarioPorId: mocks.usuarioSimulado }));
vi.mock("./sessao-persistente", () => ({ consultarUsuarioAutenticado: mocks.consultar }));
vi.mock("./autenticacao", () => ({
  obterAutenticacao: async () => ({ api: { signOut: mocks.signOut } }),
}));

import { encerrarSessao, gravarSessao, usuarioDaRequisicao } from "./sessao-servidor";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.banco.mockReturnValue(true);
  mocks.consultar.mockResolvedValue(null);
});

describe("sessão da requisição", () => {
  it("não aceita o cookie legado como prova de identidade no modo persistente", async () => {
    expect(await usuarioDaRequisicao()).toBeNull();
    expect(mocks.consultar).toHaveBeenCalledWith(mocks.headers);
    expect(mocks.cookies.get).not.toHaveBeenCalled();
    expect(mocks.usuarioSimulado).not.toHaveBeenCalled();
  });

  it("propaga indisponibilidade sem recorrer à sessão simulada", async () => {
    mocks.consultar.mockRejectedValueOnce(new BancoIndisponivelError());
    await expect(usuarioDaRequisicao()).rejects.toBeInstanceOf(BancoIndisponivelError);
    expect(mocks.usuarioSimulado).not.toHaveBeenCalled();
  });

  it("não cria sessão persistente com um ID arbitrário", async () => {
    await expect(gravarSessao("usr-administrador")).rejects.toThrow(/provedor/);
    expect(mocks.cookies.set).not.toHaveBeenCalled();
  });

  it("delega logout ao provedor", async () => {
    await encerrarSessao();
    expect(mocks.signOut).toHaveBeenCalledWith({ headers: mocks.headers });
  });

  it("mantém o cookie demonstrativo somente no modo simulado", async () => {
    mocks.banco.mockReturnValue(false);
    mocks.cookies.get.mockReturnValue({ value: "usr-legado" });
    mocks.usuarioSimulado.mockResolvedValue({ id: "usr-legado", situacao: "ativo" });
    expect(await usuarioDaRequisicao()).toMatchObject({ id: "usr-legado" });
    expect(mocks.consultar).not.toHaveBeenCalled();
  });
});
