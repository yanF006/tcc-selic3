import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { BancoIndisponivelError, traduzirErroPersistencia } from "./erros";
import { executarTransacao } from "./transacoes";
import { ErroDeRegra } from "@/lib/domain/erros";
import { esquemaPapel } from "@/lib/domain/schemas";

describe("erros e transações", () => {
  it("distingue validação, referência e indisponibilidade sem expor erros internos", () => {
    const validacao = esquemaPapel.safeParse(["administrador", "aluno"]);
    expect(traduzirErroPersistencia(validacao.error)).toMatchObject({
      codigo: "validacao_invalida",
    });
    expect(traduzirErroPersistencia({ code: "P2003" })).toMatchObject({
      codigo: "referencia_invalida",
    });
    expect(
      traduzirErroPersistencia({ code: "P2002", meta: { target: ["matricula"] } }),
    ).toMatchObject({ codigo: "matricula_ja_utilizada" });
    expect(
      traduzirErroPersistencia({
        code: "P2039",
        meta: { driverAdapterError: { cause: { code: "ECONNRESET" } } },
      }),
    ).toBeInstanceOf(BancoIndisponivelError);
    const desconhecido = new TypeError("Erro de programação");
    expect(traduzirErroPersistencia(desconhecido)).toBe(desconhecido);
    const regra = new ErroDeRegra("Operação recusada", "recusada");
    expect(traduzirErroPersistencia(regra)).toBe(regra);
  });

  it("não repete a operação quando perde a resposta do commit", async () => {
    const operacao = vi.fn().mockResolvedValue("gravado");
    const $transaction = vi.fn(async (executar: () => Promise<unknown>) => {
      await executar();
      throw Object.assign(new Error("Resposta do commit perdida"), { code: "ECONNRESET" });
    });
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await expect(
        executarTransacao(operacao, { cliente: { $transaction } as unknown as PrismaClient }),
      ).rejects.toBeInstanceOf(BancoIndisponivelError);
      expect($transaction).toHaveBeenCalledTimes(1);
      expect(operacao).toHaveBeenCalledTimes(1);
    } finally {
      aviso.mockRestore();
    }
  });
});
