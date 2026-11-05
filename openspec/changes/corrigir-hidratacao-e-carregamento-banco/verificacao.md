# Verificação

Execução em 2026-11-05, com `DATABASE_URL=` para o modo de simulação.

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | passou |
| `npm run lint` | passou |
| `npm run test:unit` | 42 arquivos, 568 testes passaram |
| `npm run test:e2e` (servidor de produção via `PLAYWRIGHT_SERVER_COMMAND="npm run start -- --port 3000"`) | 126 passaram, 1 ignorado |
| `npm run test:e2e:banco-indisponivel` | 1 passou, com causa `45028` registrada em ~8,3 s |
| `DATABASE_URL= npm run build` | passou |
| `openspec validate corrigir-hidratacao-e-carregamento-banco --strict` | válido |

Observação: a suíte E2E padrão com `next dev` sofreu `Page crashed` no teste
13.1 (varredura de 33 rotas) nesta máquina, sem falha de asserção e sem
reprodução no servidor de produção. O mesmo teste e a suíte completa passaram
com `next start` após o build. O cenário dedicado de banco indisponível roda em
`next dev` e passa.

## Verificação do endereço publicado

Em 2026-11-05, foi verificado `https://tcc-selic3.vercel.app/` com Playwright,
usando a conta administrativa de demonstração publicada na própria tela de login.

- Login concluiu em `/admin/usuarios`; a tabela ficou visível sem erros JavaScript.
- O indicador informou `14 de 14 usuário(s) encontrado(s).`.
- Buscar `Maria` retornou `1 de 14 usuário(s) encontrado(s).`, mas a URL permaneceu
  `/admin/usuarios`, sem `searchParams` de busca. Esse comportamento indica que a
  versão publicada ainda utiliza a filtragem anterior no cliente.
- Não foram criados ou alterados cadastros nesta verificação.

As tarefas 6.1 e 6.2 permanecem pendentes: o login bem-sucedido não comprova a
conexão ao Aiven, pois a versão anterior pode servir dados em memória após falha.
É necessário publicar esta implementação e consultar a configuração/logs da
Vercel e do Aiven para confirmar o egress e executar os cenários de recuperação
e consistência entre instâncias.

### Após a confirmação do novo deploy

Nova verificação com Playwright no mesmo endereço, após o usuário confirmar a
conclusão do deploy:

- Login administrativo concluiu sem erros JavaScript.
- A lista inicial mostrou `10 de 14 usuário(s) encontrado(s).`, com 10 linhas de dados.
- Busca por `Maria` navegou para `/admin/usuarios?busca=Maria` e mostrou
  `1 de 1 usuário(s) encontrado(s).`.
- A próxima página navegou para `/admin/usuarios?pagina=2` e mostrou os quatro
  registros restantes (`4 de 14`); o resultado permaneceu após recarregar a página.
- `/admin/matriculas` carregou sua tabela com sete registros.

Esses resultados confirmam que o comportamento novo está publicado e que as
leituras autenticadas funcionam no momento da verificação. Não foi inspecionada
a configuração de `DATABASE_URL`/egress/allowlist, nem provocada indisponibilidade
no ambiente remoto. Não foram feitas mutações para validar consistência entre
instâncias. Portanto, as tarefas operacionais 6.1 e 6.2 ainda não estão integralmente
verificadas.
