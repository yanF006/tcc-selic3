import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { credencialDe, definirSenha } from "./credenciais";
import { entrar, sair } from "./sessao";
import {
  CONFIRMACAO_REDEFINICAO,
  LINK_INVALIDO,
  redefinirSenhaComLink,
  solicitarRedefinicao,
  trocarSenha,
  VALIDADE_LINK_MINUTOS,
} from "./senhas";
import { limparLinks } from "./senhas";
import { reiniciarEstado } from "./store";
import { usuarioPorEmail } from "./administracao";

/**
 * Senha do usuário (5.8 e 5.9): confirmação genérica do pedido, link de uso
 * único, digest no lugar da senha e troca autenticada que exige a senha atual.
 */

const ALUNO = "joao.lima@aluno.ifrj.edu.br";
const SENHA = "selic123";

/** Token do link de redefinição, para as chamadas de serviço. */
function tokenDoLink(link: string): string {
  return new URL(link, "http://localhost").searchParams.get("token") ?? "";
}

beforeEach(() => {
  reiniciarEstado();
  limparLinks();
  sair();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("credenciais", () => {
  it("não guarda a senha em texto legível", async () => {
    const credencial = await credencialDe(ALUNO);

    expect(credencial?.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(credencial?.digest).not.toContain(SENHA);
    expect(credencial?.origem).toBe("conta_desenvolvimento");
  });

  it("semeia a conta de desenvolvimento só na primeira conferência", async () => {
    const primeira = await credencialDe(ALUNO);

    await definirSenha(ALUNO, "outra-senha", "troca_autenticada");

    const segunda = await credencialDe(ALUNO);

    expect(segunda?.origem).toBe("troca_autenticada");
    expect(segunda?.digest).not.toBe(primeira?.digest);
  });

  it("devolve undefined para e-mail sem senha conhecida", async () => {
    expect(await credencialDe("ninguem@aluno.ifrj.edu.br")).toBeUndefined();
  });
});

describe("pedido de redefinição", () => {
  it("devolve a mesma confirmação para e-mail cadastrado e inexistente", async () => {
    const cadastrado = await solicitarRedefinicao(ALUNO);
    const inexistente = await solicitarRedefinicao("ninguem@aluno.ifrj.edu.br");

    expect(cadastrado.confirmacao).toBe(CONFIRMACAO_REDEFINICAO);
    expect(inexistente.confirmacao).toBe(cadastrado.confirmacao);
  });

  it("gera um link diferente a cada pedido", async () => {
    const primeiro = await solicitarRedefinicao(ALUNO);
    const segundo = await solicitarRedefinicao(ALUNO);

    expect(primeiro.link).not.toBe(segundo.link);
  });

  it("usa o e-mail informado sem distinguir maiúsculas e espaços", async () => {
    const pedido = await solicitarRedefinicao(`  ${ALUNO.toUpperCase()} `);

    await redefinirSenhaComLink(tokenDoLink(pedido.link), "senha-nova-123", "senha-nova-123");

    const resultado = await entrar(ALUNO, "senha-nova-123");

    expect(resultado.ok).toBe(true);
  });
});

describe("uso do link de redefinição", () => {
  it("altera a senha e libera o login com a nova senha", async () => {
    const pedido = await solicitarRedefinicao(ALUNO);
    const resultado = await redefinirSenhaComLink(
      tokenDoLink(pedido.link),
      "senha-nova-123",
      "senha-nova-123",
    );

    expect(resultado.ok).toBe(true);
    expect((await entrar(ALUNO, "senha-nova-123")).ok).toBe(true);
    expect((await entrar(ALUNO, SENHA)).ok).toBe(false);
  });

  it("recusa o mesmo link pela segunda vez", async () => {
    const token = tokenDoLink((await solicitarRedefinicao(ALUNO)).link);

    await redefinirSenhaComLink(token, "senha-nova-123", "senha-nova-123");

    const segunda = await redefinirSenhaComLink(token, "outra-senha-123", "outra-senha-123");

    expect(segunda).toEqual({ ok: false, campo: "link", erro: LINK_INVALIDO });
    // A senha continua sendo a da primeira redefinição.
    expect((await entrar(ALUNO, "senha-nova-123")).ok).toBe(true);
  });

  it("recusa token que nunca existiu", async () => {
    const resultado = await redefinirSenhaComLink(
      "rst_inventado",
      "senha-nova-123",
      "senha-nova-123",
    );

    expect(resultado).toEqual({ ok: false, campo: "link", erro: LINK_INVALIDO });
  });

  it("recusa link vencido", async () => {
    vi.useFakeTimers();

    const pedido = await solicitarRedefinicao(ALUNO);

    vi.advanceTimersByTime((VALIDADE_LINK_MINUTOS + 1) * 60_000);

    const resultado = await redefinirSenhaComLink(
      tokenDoLink(pedido.link),
      "senha-nova-123",
      "senha-nova-123",
    );

    expect(resultado).toEqual({ ok: false, campo: "link", erro: LINK_INVALIDO });
  });

  it("recusa senha curta e confirmação divergente antes de queimar o link", async () => {
    const token = tokenDoLink((await solicitarRedefinicao(ALUNO)).link);

    const curta = await redefinirSenhaComLink(token, "curta", "curta");

    expect(curta).toEqual({
      ok: false,
      campo: "senha",
      erro: "A senha deve ter ao menos 8 caracteres.",
    });

    const divergente = await redefinirSenhaComLink(token, "senha-nova-123", "outra-senha-123");

    expect(divergente).toEqual({
      ok: false,
      campo: "confirmacao",
      erro: "A confirmação não bate com a senha.",
    });

    // O link continua válido depois dos dois erros.
    expect((await redefinirSenhaComLink(token, "senha-nova-123", "senha-nova-123")).ok).toBe(true);
  });

  it("não redefine senha de e-mail sem conta", async () => {
    const token = tokenDoLink((await solicitarRedefinicao("ninguem@aluno.ifrj.edu.br")).link);
    const resultado = await redefinirSenhaComLink(token, "senha-nova-123", "senha-nova-123");

    expect(resultado).toEqual({ ok: false, campo: "link", erro: LINK_INVALIDO });
    expect(await usuarioPorEmail("ninguem@aluno.ifrj.edu.br")).toBeNull();
  });
});

describe("troca autenticada de senha", () => {
  it("altera a senha quando a senha atual confere", async () => {
    const usuario = await usuarioPorEmail(ALUNO);
    const resultado = await trocarSenha(usuario!, SENHA, "senha-nova-123", "senha-nova-123");

    expect(resultado.ok).toBe(true);
    expect((await entrar(ALUNO, "senha-nova-123")).ok).toBe(true);
    expect((await entrar(ALUNO, SENHA)).ok).toBe(false);
  });

  it("mantém a senha anterior quando a senha atual está errada", async () => {
    const usuario = await usuarioPorEmail(ALUNO);
    const resultado = await trocarSenha(
      usuario!,
      "senha-errada",
      "senha-nova-123",
      "senha-nova-123",
    );

    expect(resultado).toEqual({
      ok: false,
      campo: "senhaAtual",
      erro: "A senha atual não confere.",
    });
    expect((await entrar(ALUNO, SENHA)).ok).toBe(true);
  });

  it("exige a confirmação da nova senha", async () => {
    const usuario = await usuarioPorEmail(ALUNO);
    const resultado = await trocarSenha(usuario!, SENHA, "senha-nova-123", "outra-senha-123");

    expect(resultado).toEqual({
      ok: false,
      campo: "confirmacao",
      erro: "A confirmação não bate com a senha.",
    });
    expect((await entrar(ALUNO, SENHA)).ok).toBe(true);
  });
});
