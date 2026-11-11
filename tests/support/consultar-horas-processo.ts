import { carregarCliente } from "../../src/lib/db/prisma";
import { totalHorasDoEstagio } from "../../src/lib/services/estagios";
import { lancamentosDoEstagioAtuais } from "../../src/lib/services/lancamentos";

async function executar() {
  const { prisma } = await carregarCliente();
  try {
    const itens = await lancamentosDoEstagioAtuais(process.argv[2]);
    process.stdout.write(JSON.stringify({
      total: await totalHorasDoEstagio(process.argv[2]),
      itens: itens.map((item) => ({ id: item.id, tipo: item.tipo, horas: item.horas, corrigeId: item.corrigeId })),
    }));
  } finally { await prisma.$disconnect(); }
}
executar().catch(() => { process.stderr.write("Lançamentos indisponíveis no banco isolado."); process.exitCode = 1; });
