import "dotenv/config";

import type { Prisma } from "../src/generated/prisma/client";
import { matriculasImportadas, usuarios } from "../src/lib/fixtures/base";
import { criarClienteOperacional } from "./conexao-operacional";

/**
 * Seed de DEMONSTRAÇÃO (tarefa 13.4). Não é carga operacional e nunca roda
 * sozinho: a aplicação não semeia mais o banco. Travas:
 *  - SELIC_SEED_DEMONSTRACAO=1 precisa estar definido;
 *  - o banco precisa ser de demonstração ou ensaio (sufixo _ensaio, _teste ou _demo);
 *  - só insere registros ausentes (skipDuplicates): nunca atualiza um registro existente.
 * Produção não recebe este seed: use a carga inicial (`npm run db:carga-inicial`).
 */

const { prisma, banco } = criarClienteOperacional();

async function main() {
  if (process.env.SELIC_SEED_DEMONSTRACAO !== "1") {
    throw new Error("Seed de demonstração recusado: defina SELIC_SEED_DEMONSTRACAO=1.");
  }
  if (!/(_ensaio|_teste|_demo)$/.test(banco) || banco === "selic") {
    throw new Error(`Seed de demonstração recusado para o banco "${banco}".`);
  }

  const usuariosParaInserir = usuarios.map((usuario) => ({
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
    situacao: usuario.situacao,
    campus: usuario.campus,
    matricula: usuario.matricula ?? null,
    cursoId: usuario.cursoId ?? null,
    membroComissaoEstagio: usuario.membroComissaoEstagio ?? false,
    dadosPessoais: usuario.dadosPessoais
      ? (usuario.dadosPessoais as unknown as Prisma.InputJsonValue)
      : undefined,
    criadoEm: new Date(usuario.criadoEm),
  }));

  const matriculasParaInserir = matriculasImportadas.map((matricula) => ({
    id: matricula.id,
    matricula: matricula.matricula,
    nome: matricula.nome,
    curso: matricula.curso,
    origem: matricula.origem,
    importadaEm: new Date(matricula.importadaEm),
  }));

  await prisma.usuario.createMany({ data: usuariosParaInserir, skipDuplicates: true });
  await prisma.matriculaImportada.createMany({ data: matriculasParaInserir, skipDuplicates: true });

  const [totalUsuarios, totalMatriculas] = await Promise.all([
    prisma.usuario.count(),
    prisma.matriculaImportada.count(),
  ]);

  console.log(`Seed de demonstração concluído: ${totalUsuarios} usuário(s) e ${totalMatriculas} matrícula(s).`);
}

main()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : "Falha ao semear o banco de demonstração.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
