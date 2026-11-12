import "server-only";

import type { Usuario } from "@/lib/domain/types";

import { carregarCliente, descartarCliente } from "./prisma";
import { BancoIndisponivelError, registrarFalhaBanco, traduzirErroPersistencia } from "./erros";
import { criarRepositorioUsuarios } from "./repositorios/usuarios";

/**
 * Escrita de usuário no modo persistente. O banco é a única fonte: não há cópia
 * em memória, não há semeadura com fixtures e uma falha nunca vira sucesso com
 * dados simulados. A falha de conexão sai como `BancoIndisponivelError`, para a
 * tela mostrar indisponibilidade e permitir nova tentativa.
 */
export async function atualizarUsuario(usuario: Usuario): Promise<void> {
  const inicio = Date.now();

  try {
    const { prisma, Prisma } = await carregarCliente();
    await prisma.$transaction(async (tx) => {
      await criarRepositorioUsuarios(tx, Prisma).atualizar(usuario);
      if (usuario.situacao !== "ativo") {
        await tx.authSession.deleteMany({ where: { userId: usuario.id } });
      }
    });
  } catch (causa) {
    const erro = traduzirErroPersistencia(causa);
    if (!(erro instanceof BancoIndisponivelError)) throw erro;

    descartarCliente();
    registrarFalhaBanco(causa, Date.now() - inicio);

    throw erro;
  }
}
