import { carregarCliente } from "../../src/lib/db/prisma";
import { listarOpcoesAcademicas } from "../../src/lib/db/repositorios/catalogo";

async function executar() {
  const cursoId = process.argv[2];
  const { prisma } = await carregarCliente();
  const { turmas, periodos } = await listarOpcoesAcademicas(prisma);
  const encontradas = turmas
    .filter((turma) => turma.cursoId === cursoId)
    .map((turma) => ({
      id: turma.id,
      nome: turma.nome,
      periodoIds: turma.periodoIds,
      periodos: (turma.periodoIds ?? []).map((id) => periodos.find((periodo) => periodo.id === id)),
    }));

  process.stdout.write(JSON.stringify(encontradas));
  await prisma.$disconnect();
}

executar().catch((erro) => {
  process.stderr.write(
    `Falha ao listar turmas no banco isolado: ${erro instanceof Error ? erro.message : String(erro)}`,
  );
  process.exitCode = 1;
});
