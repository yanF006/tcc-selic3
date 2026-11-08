import { beforeEach, describe, expect, it, vi } from "vitest";
import { APIError } from "better-auth/api";

import type { Usuario } from "@/lib/domain/types";

const mocks = vi.hoisted(() => {
  const auth = {
    api: {
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
      getSession: vi.fn(),
      changePassword: vi.fn(),
    },
  };

  return {
    auth,
    bancoConfigurado: vi.fn(() => true),
    obterAutenticacao: vi.fn(async () => auth),
    carregarConfiguracaoAutenticacao: vi.fn(() => ({
      origem: "https://selic.test",
      segredo: "segredo-de-teste",
    })),
    definirSenha: vi.fn(),
    conferirSenha: vi.fn(),
    usuarioPorEmail: vi.fn(),
  };
});

vi.mock("@/lib/db/prisma", () => ({ bancoConfigurado: mocks.bancoConfigurado }));
vi.mock("@/lib/auth/autenticacao", () => ({ obterAutenticacao: mocks.obterAutenticacao }));
vi.mock("@/lib/auth/configuracao", () => ({
  carregarConfiguracaoAutenticacao: mocks.carregarConfiguracaoAutenticacao,
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: "better-auth.session_token=abc" }),
}));
vi.mock("./credenciais", () => ({
  definirSenha: mocks.definirSenha,
  conferirSenha: mocks.conferirSenha,
}));
vi.mock("./administracao", () => ({ usuarioPorEmail: mocks.usuarioPorEmail }));
vi.mock("./store", () => ({ agora: () => "2026-01-01T00:00:00.000Z" }));

import {
  CONFIRMACAO_REDEFINICAO,
  LINK_INVALIDO,
  redefinirSenhaComLink,
  solicitarRedefinicao,
  trocarSenha,
} from "./senhas";

/**
 * Caminho persistente da senha (4.5): com banco configurado, o serviço delega
 * tudo ao Better Auth e nunca toca nos mapas de simulação.
 */

const USUARIO = {
  id: "usuario-1",
  nome: "Aluno",
  email: "aluno@teste.local",
  papel: "aluno",
} as Usuario;

const CABECALHOS = new Headers({ cookie: "better-auth.session_token=abc" });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.bancoConfigurado.mockReturnValue(true);
  mocks.obterAutenticacao.mockResolvedValue(mocks.auth);
  mocks.auth.api.requestPasswordReset.mockResolvedValue({ status: true });
  mocks.auth.api.resetPassword.mockResolvedValue({ status: true });
  mocks.auth.api.getSession.mockResolvedValue({ user: { id: USUARIO.id } });
  mocks.auth.api.changePassword.mockResolvedValue({ status: true });
});

describe("pedido de redefinição persistente", () => {
  it("delega ao Better Auth com o e-mail normalizado e não devolve link", async () => {
    const pedido = await solicitarRedefinicao("  Aluno@Teste.Local ", CABECALHOS);

    expect(mocks.auth.api.requestPasswordReset).toHaveBeenCalledWith({
      body: { email: "aluno@teste.local", redirectTo: "https://selic.test/redefinir-senha" },
      headers: CABECALHOS,
    });
    expect(pedido).toEqual({
      confirmacao: CONFIRMACAO_REDEFINICAO,
      enviadoEm: "2026-01-01T00:00:00.000Z",
    });
    expect(pedido.link).toBeUndefined();
  });

  it("mantém a confirmação genérica mesmo quando o provedor não revela a conta", async () => {
    mocks.auth.api.requestPasswordReset.mockResolvedValue({
      status: true,
      message: "If this email exists in our system, check your email for the reset link",
    });

    const pedido = await solicitarRedefinicao("ninguem@teste.local", CABECALHOS);

    expect(pedido.confirmacao).toBe(CONFIRMACAO_REDEFINICAO);
    expect(pedido.link).toBeUndefined();
  });
});

describe("uso do link persistente", () => {
  it("redefine a senha pelo token do provedor", async () => {
    const resultado = await redefinirSenhaComLink(
      "  token-valido  ",
      "senha-nova-123",
      "senha-nova-123",
      CABECALHOS,
    );

    expect(mocks.auth.api.resetPassword).toHaveBeenCalledWith({
      body: { token: "token-valido", newPassword: "senha-nova-123" },
      headers: CABECALHOS,
    });
    expect(resultado).toEqual({ ok: true, mensagem: "Senha redefinida. Entre com a nova senha." });
    expect(mocks.definirSenha).not.toHaveBeenCalled();
  });

  it.each(["token inválido", "token expirado", "token reutilizado"])(
    "recusa %s com a mesma mensagem",
    async () => {
      mocks.auth.api.resetPassword.mockRejectedValue(
        new APIError(400, { code: "INVALID_TOKEN", message: "Invalid token" }),
      );

      const resultado = await redefinirSenhaComLink(
        "token-qualquer",
        "senha-nova-123",
        "senha-nova-123",
        CABECALHOS,
      );

      expect(resultado).toEqual({ ok: false, campo: "link", erro: LINK_INVALIDO });
    },
  );

  it("valida a nova senha antes de consumir o token", async () => {
    const curta = await redefinirSenhaComLink("token", "curta", "curta", CABECALHOS);
    const divergente = await redefinirSenhaComLink(
      "token",
      "senha-nova-123",
      "outra-senha-123",
      CABECALHOS,
    );

    expect(curta).toMatchObject({ ok: false, campo: "senha" });
    expect(divergente).toMatchObject({ ok: false, campo: "confirmacao" });
    expect(mocks.auth.api.resetPassword).not.toHaveBeenCalled();
  });
});

describe("troca autenticada persistente", () => {
  it("confere a sessão e troca a senha revogando as outras sessões", async () => {
    const resultado = await trocarSenha(
      USUARIO,
      "senha-atual-123",
      "senha-nova-123",
      "senha-nova-123",
      CABECALHOS,
    );

    expect(mocks.auth.api.getSession).toHaveBeenCalledWith({
      headers: CABECALHOS,
      query: { disableCookieCache: true, disableRefresh: true },
    });
    expect(mocks.auth.api.changePassword).toHaveBeenCalledWith({
      headers: CABECALHOS,
      body: {
        currentPassword: "senha-atual-123",
        newPassword: "senha-nova-123",
        revokeOtherSessions: true,
      },
    });
    expect(resultado).toEqual({
      ok: true,
      mensagem: "Senha alterada. Use a nova senha no próximo acesso.",
    });
    expect(mocks.definirSenha).not.toHaveBeenCalled();
  });

  it("não troca a senha quando a senha atual está errada", async () => {
    mocks.auth.api.changePassword.mockRejectedValue(
      new APIError(400, { code: "INVALID_PASSWORD", message: "Invalid password" }),
    );

    const resultado = await trocarSenha(
      USUARIO,
      "senha-errada",
      "senha-nova-123",
      "senha-nova-123",
      CABECALHOS,
    );

    expect(resultado).toEqual({
      ok: false,
      campo: "senhaAtual",
      erro: "A senha atual não confere.",
    });
    expect(mocks.definirSenha).not.toHaveBeenCalled();
  });

  it.each([null, { user: { id: "outro-usuario" } }])(
    "recusa troca sem sessão do próprio usuário",
    async (sessao) => {
      mocks.auth.api.getSession.mockResolvedValue(sessao);

      const resultado = await trocarSenha(
        USUARIO,
        "senha-atual-123",
        "senha-nova-123",
        "senha-nova-123",
        CABECALHOS,
      );

      expect(resultado).toEqual({
        ok: false,
        campo: "senhaAtual",
        erro: "Sessão expirada. Entre novamente.",
      });
      expect(mocks.auth.api.changePassword).not.toHaveBeenCalled();
    },
  );

  it("exige a confirmação antes de consultar a sessão", async () => {
    const resultado = await trocarSenha(
      USUARIO,
      "senha-atual-123",
      "senha-nova-123",
      "outra-senha-123",
      CABECALHOS,
    );

    expect(resultado).toMatchObject({ ok: false, campo: "confirmacao" });
    expect(mocks.auth.api.getSession).not.toHaveBeenCalled();
  });
});
