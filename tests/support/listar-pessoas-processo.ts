import { carregarCliente } from "../../src/lib/db/prisma";
import { listarOrientadores, listarSupervisores } from "../../src/lib/services/catalogo";

async function executar() {
  const prefixo = process.argv[2];
  const { prisma } = await carregarCliente();
  const [orientadores, supervisores] = await Promise.all([listarOrientadores(), listarSupervisores()]);
  process.stdout.write(JSON.stringify({
    orientadores: orientadores.filter((pessoa) => pessoa.nome.startsWith(prefixo)),
    supervisores: supervisores.filter((pessoa) => pessoa.nome.startsWith(prefixo)),
  }));
  await prisma.$disconnect();
}

executar().catch(() => {
  process.stderr.write("Falha ao consultar pessoas no banco isolado.");
  process.exitCode = 1;
});
