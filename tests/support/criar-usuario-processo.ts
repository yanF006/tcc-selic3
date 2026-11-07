import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../../src/generated/prisma/client";
import { novoId } from "../../src/lib/services/store";
import { carregarUrlAppTeste, validarUrlTeste } from "../integracao/configuracao";

async function executar() {
  const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb({
      host: configuracao.host,
      port: configuracao.porta,
      user: configuracao.usuario,
      password: configuracao.senha,
      database: configuracao.banco,
      connectionLimit: 1,
      ssl: { rejectUnauthorized: false },
    }),
  });

  try {
    const usuario = await prisma.usuario.create({
      data: { id: novoId("usr"), nome: "Cadastro entre processos", email: process.argv[2] },
    });
    process.stdout.write(JSON.stringify({ id: usuario.id }));
  } finally {
    await prisma.$disconnect();
  }
}

executar().catch(() => {
  process.stderr.write("Falha ao criar usuário no banco isolado de testes.");
  process.exitCode = 1;
});
