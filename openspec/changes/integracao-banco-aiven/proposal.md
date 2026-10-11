# Proposta: Integração de Persistência com Prisma 7 e Aiven MySQL

## Resumo
Introduz a camada de persistência definitiva utilizando Prisma 7 com driver adapter do MariaDB/MySQL para conectar ao banco de dados Aiven, substituindo parcialmente o estado em memória para `usuarios` e `matriculas`.

## Escopo
- Configuração do Prisma 7 (`prisma7.config.ts`, `prisma/schema.prisma`).
- Cliente Prisma com driver adapter otimizado para Aiven (TLS, timeouts estendidos).
- Ponte de persistência e hidratação (`src/lib/db/persistencia.ts`).
- Uso de banco de dados dedicado no Aiven (`selic_db`) para evitar colisões com outros sistemas no `defaultdb`.
