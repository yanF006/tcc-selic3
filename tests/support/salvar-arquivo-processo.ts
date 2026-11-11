import { carregarCliente } from "../../src/lib/db/prisma";
import { salvarArquivo } from "../../src/lib/services/arquivos";

async function executar() {
  const { prisma } = await carregarCliente();
  try {
    const arquivo = await salvarArquivo(process.argv[2], process.argv[3], {
      nome: "../../recebido\r\n.pdf", mimeType: "application/pdf", finalidade: "assinado",
      conteudo: Buffer.from("%PDF-1.7\nArquivo recebido de teste\n%%EOF"),
    });
    process.stdout.write(JSON.stringify(arquivo));
  } finally { await prisma.$disconnect(); }
}
executar().catch(() => { process.stderr.write("Falha ao salvar arquivo no banco isolado."); process.exitCode = 1; });
