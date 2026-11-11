import { carregarCliente } from "../../src/lib/db/prisma";
import { documentosParaParecer } from "../../src/lib/services/documentos";
import type { Usuario } from "../../src/lib/domain/types";

async function executar() {
  const { prisma } = await carregarCliente();
  try {
    const autor: Usuario = { id: process.argv[2], papel: "coordenador_curso", situacao: "ativo", campus: "Pinheiral", nome: "Fila", email: "fila@teste.local", criadoEm: "2026-11-11" };
    const fila = await documentosParaParecer("coordenador_curso", autor, { tamanho: 100 });
    process.stdout.write(JSON.stringify({ ...fila, contem: fila.itens.some((documento) => documento.id === process.argv[3]) }));
  } finally { await prisma.$disconnect(); }
}
executar().catch(() => { process.stderr.write("Fila indisponível no banco isolado."); process.exitCode = 1; });
