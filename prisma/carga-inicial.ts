import "dotenv/config";

import { randomUUID } from "node:crypto";
import { criarClienteOperacional } from "./conexao-operacional";

/**
 * Carga inicial operacional (tarefa 13.4). Cria só o primeiro administrador, com
 * cargo único e conta ativa. Não cria contas de demonstração, não altera registros
 * existentes e não define senha: a senha é estabelecida pelo fluxo padrão de
 * recuperação, com o e-mail informado.
 *
 * Variáveis: SELIC_ADMIN_EMAIL e SELIC_ADMIN_NOME (obrigatórias).
 * Reexecução: se já existe administrador, nada é feito.
 */
async function main() {
  const email = (process.env.SELIC_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const nome = (process.env.SELIC_ADMIN_NOME ?? "").trim();
  if (!email || !nome) throw new Error("Defina SELIC_ADMIN_EMAIL e SELIC_ADMIN_NOME.");

  const { prisma } = criarClienteOperacional();
  try {
    const administradores = await prisma.usuario.count({ where: { papel: "administrador" } });
    if (administradores > 0) {
      console.log("Carga inicial já realizada: há administrador cadastrado. Nenhuma alteração.");
      return;
    }

    const ocupado = await prisma.usuario.findUnique({ where: { email } });
    if (ocupado) {
      throw new Error("O e-mail informado já pertence a outra conta. Resolva manualmente, sem sobrescrever.");
    }

    await prisma.usuario.create({
      data: {
        id: `adm-${randomUUID()}`,
        nome,
        email,
        papel: "administrador",
        situacao: "ativo",
        campus: "Pinheiral",
        membroComissaoEstagio: false,
      },
    });

    console.log(
      "Primeiro administrador criado. Estabeleça a senha pelo fluxo padrão de recuperação de senha, com este e-mail.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : "Falha na carga inicial.");
  process.exitCode = 1;
});
