import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Prisma } from "../src/generated/prisma/client";
import { matriculasImportadas, usuarios } from "../src/lib/fixtures/base";

/**
 * Semeia o MySQL do Aiven com as fixtures de `usuarios` e `matriculas`.
 *
 * O mesmo povoamento acontece de forma automática na primeira leitura do app
 * (`garantirHidratacao`, em `src/lib/db/persistencia.ts`), quando o banco está
 * vazio. Este script existe para preparar o banco sem depender da aplicação —
 * `npm run db:seed` — e é idempotente: cada registro é inserido ou atualizado
 * pelo id, então rodar de novo não duplica nada.
 *
 * Escopo desta migração: apenas `usuarios` e `matriculas`; cursos, turmas,
 * estágios, documentos e pareceres seguem nas fixtures em memória.
 */

const url = new URL(process.env.DATABASE_URL ?? "");

if (!url.hostname) {
  console.error("DATABASE_URL ausente ou inválida. Copie .env.example para .env.");
  process.exit(1);
}

const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: url.port ? Number(url.port) : 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: decodeURIComponent(url.pathname.replace(/^\/+/, "")) || undefined,
  connectionLimit: 5,
  connectTimeout: 60_000,
  acquireTimeout: 60_000,
  initializationTimeout: 60_000,
  // O certificado gerenciado do Aiven não está na cadeia local.
  ssl: { rejectUnauthorized: false },
});

const prisma = new PrismaClient({ adapter });

async function main() {
  for (const usuario of usuarios) {
    const dados = {
      nome: usuario.nome,
      email: usuario.email,
      papeis: usuario.papeis,
      situacao: usuario.situacao,
      campus: usuario.campus,
      matricula: usuario.matricula ?? null,
      cursoId: usuario.cursoId ?? null,
      membroComissaoEstagio: usuario.membroComissaoEstagio ?? false,
      dadosPessoais: usuario.dadosPessoais
        ? (usuario.dadosPessoais as unknown as Prisma.InputJsonValue)
        : undefined,
      criadoEm: new Date(usuario.criadoEm),
    };

    await prisma.usuario.upsert({
      where: { id: usuario.id },
      create: { id: usuario.id, ...dados },
      update: dados,
    });
  }

  for (const matricula of matriculasImportadas) {
    const dados = {
      matricula: matricula.matricula,
      nome: matricula.nome,
      curso: matricula.curso,
      origem: matricula.origem,
      importadaEm: new Date(matricula.importadaEm),
    };

    await prisma.matriculaImportada.upsert({
      where: { id: matricula.id },
      create: { id: matricula.id, ...dados },
      update: dados,
    });
  }

  const [totalUsuarios, totalMatriculas] = await Promise.all([
    prisma.usuario.count(),
    prisma.matriculaImportada.count(),
  ]);

  console.log(`Seed concluído: ${totalUsuarios} usuário(s) e ${totalMatriculas} matrícula(s).`);
}

main()
  .catch((erro) => {
    console.error("Falha ao semear o banco:", erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
