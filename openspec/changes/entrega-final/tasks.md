## 1. Revisão com a cliente

- [ ] 1.1 Revisar responsividade e acessibilidade com a cliente e corrigir o que for apontado (antiga 16.1 de `frontend-website`) — verificação: lista de problemas zerada

## 2. Limpeza da entrega

- [ ] 2.1 Remover o seletor de papel, a ação de troca de sessão, a flag `NEXT_PUBLIC_SELIC_SELADOR_PAPEL`, o script `test:e2e:seletor`, o E2E correspondente e os dados de desenvolvimento ainda referenciados pela entrega; atualizar `.env.example`, `.env.vercel.example` e README (antiga 16.2) — verificação: `grep -ri "seletor\|SELADOR_PAPEL\|trocarSessao" src e2e package.json .env*.example` sem resultados e build de produção limpo

## 3. Regressões de matrícula duplicada

- [ ] 3.1 Adicionar testes de cadastro recusado para matrícula já vinculada a conta ativa, pendente ou inativa com outro e-mail, e para matrícula ocupada entre a primeira etapa e a conclusão (restante de 3.2 e 3.3 de `impedir-cadastro-matricula-duplicada`) — verificação: `npm run test:unit -- src/lib/services/cadastro.test.ts`, teste de integração de cadastro e `npm run test:e2e -- e2e/cadastro.spec.ts` passam, sem criação de conta, credencial ou solicitação

## 4. Verificação final

- [ ] 4.1 Rodar `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e` e `npm run build` (antiga 16.4) — verificação: todos os comandos passam
- [ ] 4.2 Publicar o Preview e validar com a cliente o fluxo completo, a lista de usuários com contas reais, o erro recuperável quando o banco falha e a nova tentativa sem reinício (antigas 16.5 de `frontend-website` e 6.2 de `corrigir-hidratacao-e-carregamento-banco`) — verificação: roteiro registrado com as evidências; o deploy depende do responsável na Vercel

## 5. Especificações

- [ ] 5.1 Reconciliar capacidades duplicadas em `openspec/specs/` (`autenticacao-acesso` × `autenticacao-persistente`, `administracao-sistema`/`gestao-coordenacao` × `cadastros-persistentes`, `parecer-notificacoes`/`estagios-aluno` × `fluxo-estagio-persistente`), removendo ou ajustando requisitos superados como a central de notificações retirada na 12.4 de `integrar-banco-backend-completo` — verificação: cada assunto descrito em um só lugar e nenhum requisito contradiz o comportamento atual
- [ ] 5.2 Arquivar esta change — verificação: delta de `autenticacao-acesso` sincronizado e pasta movida para `openspec/changes/archive/`
