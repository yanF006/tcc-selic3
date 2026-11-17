## Why

O cadastro público aceita outra conta para uma matrícula já vinculada quando o e-mail é diferente. Isso permite que a identidade acadêmica de um aluno seja compartilhada por contas distintas, pois o serviço verifica apenas o e-mail e o banco não impõe unicidade a `usuarios.matricula`.

## What Changes

- Recusar matrícula já vinculada a um usuário na primeira etapa e revalidá-la ao concluir o cadastro, independentemente do e-mail e da situação da conta existente.
- Diferenciar matrícula importada para autorizar cadastro de matrícula já vinculada a uma conta: somente a segunda bloqueia um novo cadastro.
- Garantir unicidade da matrícula não nula no banco, inclusive para requisições simultâneas ou executadas em processos diferentes.
- Tratar conflitos de unicidade sem publicar um usuário, credencial ou solicitação de acesso do cadastro rejeitado.
- Consultar a persistência atual quando houver banco configurado, evitando confiar apenas no estado hidratado uma vez por processo.
- Inspecionar duplicidades antes da migração e interromper sua aplicação se houver conflitos, sem excluir nem escolher contas automaticamente.
- Corrigir testes que hoje consideram válida a criação de uma segunda conta para uma matrícula já ocupada.

## Capabilities

### New Capabilities

### Modified Capabilities

- `persistencia-aiven`: adicionar os contratos de matrícula vinculada a uma única conta, validação nas duas etapas e rejeição consistente de conflitos de cadastro.

## Impact

- `src/lib/services/cadastro.ts`, ponte de persistência em `src/lib/db/persistencia.ts` e modelo `Usuario` de `prisma/schema.prisma`.
- Nova migração aditiva de índice único em `usuarios.matricula`, aplicada exclusivamente ao banco dedicado `selic` após inspeção de conflitos.
- Testes unitários de cadastro e persistência; testes E2E e preparação de matrículas livres nos cenários de cadastro bem-sucedido.
- Contas existentes com matrícula duplicada exigirão uma decisão explícita sobre os registros antes da migração. A alteração não elimina usuários nem modifica o e-mail ou a matrícula de contas existentes automaticamente.
