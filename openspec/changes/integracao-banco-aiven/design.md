# Design: Persistência Prisma 7 + Aiven

## Arquitetura
- **Prisma 7 com Driver Adapter (`@prisma/adapter-mariadb`)**: O Prisma 7 removeu o engine Rust tradicional em favor de drivers nativos. O cliente gerado é isolado em `src/generated/prisma`.
- **Estratégia de Hidratação**: Na inicialização, se houver `DATABASE_URL` configurada, o sistema hidrata o estado em memória (`store.ts`) a partir do MySQL do Aiven. Se o banco estiver vazio, semeia as fixtures iniciais.
- **Isolamento de Banco**: O banco utilizado no Aiven deve ser dedicado (`selic_db`) para evitar interferência de tabelas de outros projetos presentes no `defaultdb`.
