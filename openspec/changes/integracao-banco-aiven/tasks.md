# Tarefas: Integração de Banco Aiven

- [x] 1. Configurar schema Prisma 7 (`prisma/schema.prisma`) com modelos `Usuario` e `MatriculaImportada`
- [x] 2. Configurar cliente Prisma com driver adapter e tratamento de SSL para Aiven (`src/lib/db/prisma.ts`)
- [x] 3. Implementar ponte de persistência e hidratação automática (`src/lib/db/persistencia.ts`)
- [ ] 4. Atualizar `DATABASE_URL` para apontar para banco dedicado (`selic_db`) no Aiven
- [x] 5. Executar migrações e seed no banco dedicado
