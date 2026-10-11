# Persistência com Aiven MySQL

## Purpose

Preservar usuários e matrículas do SELic em banco dedicado no Aiven, permitindo recuperar os registros entre execuções da aplicação sem misturá-los aos dados de outros sistemas.

## Requirements

### Requirement: Conexão e Persistência no Aiven MySQL
O sistema SHALL conectar-se ao banco de dados MySQL hospedado no Aiven utilizando Prisma 7 e driver adapter com suporte a TLS.

#### Scenario: Hidratação e Persistência de Usuários e Matrículas
- **WHEN** a aplicação inicia com `DATABASE_URL` configurada apontando para um banco dedicado (`selic`)
- **THEN** o sistema SHALL hidratar o estado em memória a partir do banco de dados e persistir mutações de usuários e matrículas continuamente.
