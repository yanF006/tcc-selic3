import { carregarCliente } from "../../src/lib/db/prisma";
import { listarImportacoesMatriculas } from "../../src/lib/services/administracao";

async function executar() {
  const { prisma } = await carregarCliente();
  const lotes = await listarImportacoesMatriculas();
  process.stdout.write(JSON.stringify(lotes.find((lote) => lote.id === process.argv[2])));
  await prisma.$disconnect();
}
executar().catch(() => {
  process.stderr.write("Falha ao consultar lote no banco isolado.");
  process.exitCode = 1;
});
