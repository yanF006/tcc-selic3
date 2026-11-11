import { carregarCliente } from "../../src/lib/db/prisma";
import { consultarEstagios, exigirAcessoEstagio } from "../../src/lib/services/estagios";
import type { Usuario } from "../../src/lib/domain/types";

async function executar() {
  const { prisma } = await carregarCliente();
  try {
    const autor: Usuario = { id: process.argv[2], papel: "administrador", situacao: "ativo", campus: "Pinheiral", nome: "Consulta", email: "consulta@teste.local", criadoEm: "2026-11-11" };
    const lista = await consultarEstagios(autor, { busca: process.argv[3] });
    const detalhe = await exigirAcessoEstagio(autor, process.argv[3]);
    process.stdout.write(JSON.stringify({ lista, detalhe }));
  } finally { await prisma.$disconnect(); }
}
executar().catch(() => { process.stderr.write("Estágio indisponível no banco isolado."); process.exitCode = 1; });
