import { carregarCliente } from "../../src/lib/db/prisma";
import { listarConvenios } from "../../src/lib/services/catalogo";

async function executar() {
  const { prisma } = await carregarCliente();
  try {
    const busca = process.argv[2];
    const tamanho = Number(process.argv[3]);
    const paginas: string[][] = [];
    const total = (await listarConvenios({ busca, tamanho, pagina: 1 })).total;
    for (let pagina = 1; pagina <= Math.max(1, Math.ceil(total / tamanho)); pagina += 1) {
      paginas.push((await listarConvenios({ busca, tamanho, pagina })).itens.map((item) => item.id));
    }
    process.stdout.write(JSON.stringify({ total, paginas }));
  } finally { await prisma.$disconnect(); }
}
executar().catch(() => { process.stderr.write("Convênios indisponíveis no banco isolado."); process.exitCode = 1; });
