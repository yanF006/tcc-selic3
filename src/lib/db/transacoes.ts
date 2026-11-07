import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { BancoIndisponivelError, registrarFalhaBanco, traduzirErroPersistencia } from "./erros";
import { bancoConfigurado, carregarCliente, descartarCliente } from "./prisma";

export type ContextoBanco =
  | { cliente: PrismaClient; transacao?: never }
  | { transacao: Prisma.TransactionClient; cliente?: never };

export interface OpcoesTransacao {
  timeout?: number;
  maxWait?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

/**
 * Propaga o mesmo cliente aos casos de uso subordinados. Nunca repete a
 * operação: uma perda de conexão durante commit não permite inferir rollback.
 */
export async function executarTransacao<T>(
  operacao: (cliente: Prisma.TransactionClient) => Promise<T>,
  contexto?: ContextoBanco,
  opcoes: OpcoesTransacao = {},
): Promise<T> {
  // Não inferir pelo método $transaction: o proxy transacional do Prisma 7
  // pode expô-lo em runtime. O chamador identifica a transação explicitamente.
  if (contexto?.transacao) return operacao(contexto.transacao);
  const cliente = contexto?.cliente;
  const inicio = Date.now();
  try {
    if (!cliente && !bancoConfigurado())
      throw new Error("Transação persistente exige banco configurado.");
    const atual = cliente ?? (await carregarCliente()).prisma;
    return await atual.$transaction(operacao, { maxWait: 12_000, timeout: 20_000, ...opcoes });
  } catch (causa) {
    const erro = traduzirErroPersistencia(causa);
    if (erro instanceof BancoIndisponivelError) {
      if (!cliente) descartarCliente();
      registrarFalhaBanco(causa, Date.now() - inicio);
    }
    throw erro;
  }
}
