// Configuração do Prisma CLI (migrações, introspecção e seed).
//
// O Prisma 7 removeu `url` do bloco `datasource` do schema: a conexão usada pelo
// CLI vive aqui. O runtime da aplicação não passa por este arquivo — ele usa o
// driver adapter em `src/lib/db/prisma.ts`.
//
// O nome `prisma7.config.ts` (e não `prisma.config.ts`) evita colisão com o
// formato do Prisma 8; o CLI do 7 reconhece os dois nomes.

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // `process.env` em vez de `env()`: gerar o cliente não deve exigir a URL.
    url: process.env.DATABASE_URL,
  },
});
