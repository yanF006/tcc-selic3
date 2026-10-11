# Tarefas: Integração de Banco Aiven

- [x] 1. Configurar schema Prisma 7 (`prisma/schema.prisma`) com modelos `Usuario` e `MatriculaImportada`
- [x] 2. Configurar cliente Prisma com driver adapter e tratamento de SSL para Aiven (`src/lib/db/prisma.ts`)
- [x] 3. Implementar ponte de persistência e hidratação automática (`src/lib/db/persistencia.ts`)
- [x] 4. Atualizar `DATABASE_URL` para apontar para banco dedicado (`selic`) no Aiven
- [x] 5. Executar migrações e seed no banco dedicado

## Evidências da reexecução local (2026-10-11)

- Destino confirmado pela URL salva e por `SELECT DATABASE()`: `selic`. Antes da migração, a consulta ao catálogo retornou zero tabelas nesse banco.
- `npm run db:deploy`: aplicou a migração `20261011120000_init` em `selic`.
- `npm run db:seed`: concluiu com 10 usuários e 3 matrículas.
- `prisma migrate status`: schema atualizado, sem migrações pendentes.
- Consulta após o seed: somente `usuarios`, `matriculas` e `_prisma_migrations` no banco `selic`; conexão TLS com cifra `TLS_AES_256_GCM_SHA384`.
- `garantirHidratacao()`: IDs de usuários e matrículas no estado em memória conferidos contra as leituras do banco.
- A execução anterior ocorreu em `defaultdb` e não comprova estas tarefas. Os testes unitários usam fixtures em memória e também não comprovam a conexão Aiven.
- Estas evidências são do ambiente local; a configuração da Vercel e a revisão dos dados gravados anteriormente em `defaultdb` não foram verificadas nesta reexecução.
