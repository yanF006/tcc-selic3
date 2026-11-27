import "dotenv/config";

import { criarClienteOperacional } from "./conexao-operacional";

/**
 * Restaura o cargo de administrador da conta cujo e-mail está em
 * SELIC_ADMIN_EMAIL. Uso: recuperar o acesso quando o administrador trocou o
 * próprio cargo e não há outro administrador para desfazer a troca.
 *
 * A conta precisa já existir; o script não cria conta nem define senha.
 * Define papel "administrador", situação "ativo" e remove o vínculo de curso
 * (exclusivo do coordenador de curso). Os demais dados não são alterados.
 */
async function main() {
  const email = (process.env.SELIC_ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!email) throw new Error("Defina SELIC_ADMIN_EMAIL no .env.");

  const { prisma } = criarClienteOperacional();
  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) {
      throw new Error(
        "Nenhuma conta com o e-mail de SELIC_ADMIN_EMAIL. Use npm run db:carga-inicial.",
      );
    }

    if (usuario.papel === "administrador" && usuario.situacao === "ativo") {
      console.log("A conta já é administrador ativo. Nenhuma alteração.");
      return;
    }

    await prisma.usuario.update({
      where: { email },
      data: { papel: "administrador", situacao: "ativo", cursoId: null },
    });

    console.log(
      `Conta restaurada como administrador (antes: ${usuario.papel}, ${usuario.situacao}). Saia e entre de novo no site.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : "Falha ao restaurar o administrador.");
  process.exitCode = 1;
});
