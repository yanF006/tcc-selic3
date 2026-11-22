## Why

Três changes ficaram abertas apenas por tarefas de fechamento: `frontend-website` (revisão final, remoção do seletor de papel, checks e Preview), `corrigir-hidratacao-e-carregamento-banco` (validação no Preview) e `impedir-cadastro-matricula-duplicada`, cuja implementação foi absorvida por `integrar-banco-backend-completo` e só carece de duas regressões. Manter essas changes abertas impede a sincronização das especificações principais. Esta change reúne o que resta para que as três possam ser arquivadas.

## What Changes

- Revisar responsividade e acessibilidade com a cliente e corrigir o que for apontado (antiga 16.1 de `frontend-website`).
- Remover o seletor de papel, a flag `NEXT_PUBLIC_SELIC_SELADOR_PAPEL`, o script `test:e2e:seletor` e os resíduos de dados de desenvolvimento da entrega (antiga 16.2).
- Adicionar as regressões de matrícula já vinculada com outro e-mail e ocupada entre as etapas do cadastro (restante de `impedir-cadastro-matricula-duplicada`).
- Rodar os checks finais e validar o Preview, incluindo os estados de carregamento, falha e nova tentativa (antigas 16.4 e 16.5 de `frontend-website` e 6.2 de `corrigir-hidratacao-e-carregamento-banco`).
- Reconciliar especificações principais que descrevem o mesmo assunto em duas capacidades (por exemplo, `autenticacao-acesso` e `autenticacao-persistente`; notificações em `parecer-notificacoes` e `fluxo-estagio-persistente`).

## Capabilities

### New Capabilities

### Modified Capabilities

- `autenticacao-acesso`: a entrega não oferece troca de papel nem contas de desenvolvimento.

## Fora de escopo

- Geração real de DOCX/PDF a partir dos modelos do Kit de Estágio: será uma change própria.
- Migração de dados legados: Production não contém dados reais de usuários.

## Impact

- `src/components/layout/seletor-papel.tsx`, `navbar.tsx`, `shell-area.tsx`, `src/app/(publico)/acoes/sessao.ts`, `e2e/seletor-papel.spec.ts`, `package.json` e `.env*.example`.
- Testes de cadastro (`src/lib/services/cadastro.test.ts`, `tests/integracao/cadastro-publico.integration.test.ts`, `e2e/cadastro.spec.ts`).
- Especificações em `openspec/specs/`.
- O deploy de Preview depende de ação do responsável na Vercel.
