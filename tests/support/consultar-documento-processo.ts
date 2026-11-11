import { carregarCliente } from "../../src/lib/db/prisma";
import { documentoPorId, descritorDoDocumento, podeConsultarDocumento } from "../../src/lib/services/documentos";
import type { Usuario } from "../../src/lib/domain/types";

async function executar() {
  const { prisma } = await carregarCliente();
  const documento = await documentoPorId(process.argv[2]);
  const autor: Usuario = { id: process.argv[3], nome: "Consulta", email: "consulta@teste.local", papel: "administrador", situacao: "ativo", campus: "Pinheiral", criadoEm: "2026-11-10" };
  const permitido = documento && await podeConsultarDocumento(autor, documento);
  process.stdout.write(JSON.stringify(permitido ? { documento, descritor: descritorDoDocumento(documento) } : { permitido: false }));
  await prisma.$disconnect();
}
executar().catch(() => {
  process.stderr.write("Falha ao consultar documento no banco isolado.");
  process.exitCode = 1;
});
