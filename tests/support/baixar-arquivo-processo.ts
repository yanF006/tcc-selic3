import { carregarCliente } from "../../src/lib/db/prisma";
import { baixarArquivo } from "../../src/lib/services/arquivos";

async function executar() {
  const { prisma } = await carregarCliente();
  try {
    const arquivo = await baixarArquivo(process.argv[2], process.argv[3]);
    process.stdout.write(JSON.stringify({ id: arquivo.id, nome: arquivo.nome, finalidade: arquivo.finalidade, checksum: arquivo.checksum, tamanhoBytes: arquivo.tamanhoBytes, conteudo: Buffer.from(arquivo.conteudo).toString("base64") }));
  } finally { await prisma.$disconnect(); }
}
executar().catch(() => { process.stderr.write("Arquivo indisponível no banco isolado."); process.exitCode = 1; });
