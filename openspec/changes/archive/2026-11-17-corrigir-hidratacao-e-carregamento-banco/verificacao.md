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

### Preview destinado ao teste de banco inacessível

O usuário informou que o Preview da branch `validacao/persistencia-aiven` estava
configurado com uma `DATABASE_URL` inacessível. Após liberar o acesso pela
proteção da Vercel, foi testado o alias da branch (sem registrar o token de
compartilhamento neste documento).

- O login administrativo concluiu e abriu a tabela de usuários.
- A tabela informou `10 de 10 usuário(s) encontrado(s).`, com as contas de demonstração.
- A mensagem de indisponibilidade esperada não apareceu durante a janela de 60 s.

O cenário de falha remota não foi validado. O resultado é compatível com modo
simulado, mas a configuração efetiva do deployment não foi inspecionada. É
necessário confirmar o escopo Preview/branch da variável e gerar um deployment
após a alteração. No código atual, uma `DATABASE_URL` ausente/vazia ou
`NODE_ENV=test` desativa a persistência; uma URL inacessível não vazia deve
produzir erro, comportamento já coberto no E2E local dedicado.

#### Revalidação após atualização do Preview

Na nova execução no alias da branch, o cenário de banco inacessível foi observado:

- O login permaneceu em `/login` e apresentou a mensagem segura
  `Os dados estão indisponíveis no momento. Tente novamente em instantes.`.
- O tempo observado entre clicar em Entrar e detectar a mensagem foi de cerca
  de 24,8 s. Esse é o tempo de interface/requisição, não uma medição isolada do
  pool; os logs da Vercel ainda são necessários para analisar a duração da conexão.
- Para testar a área protegida sem depender de um login bem-sucedido, foi
  adicionado apenas ao contexto temporário do navegador o cookie de sessão
  simulada utilizado pelo E2E local. Nenhum cadastro foi criado ou alterado.
- `/admin/usuarios` exibiu `Dados temporariamente indisponíveis`, sem tabela.
- O botão `Tentar novamente` ficou visível e pôde ser acionado. Após 15 s, a
  indisponibilidade continuava visível, sem tabela e sem o nome da conta
  administrativa de demonstração na área protegida.

Assim, a falha remota e a manutenção do estado de erro foram verificadas. A
recuperação após restaurar a conectividade sem reiniciar o mesmo processo,
a consistência entre instâncias e a estratégia de egress continuam pendentes.

### Pausa e retomada do Aiven em produção

O usuário coordenou a pausa e a retomada do serviço no painel do Aiven. A URL
verificada foi `https://tcc-selic3.vercel.app/`, sem redeploy durante o teste.

1. Antes da pausa, o login administrativo concluiu em aproximadamente 2,7 s e
   a tabela mostrou `10 de 14 usuário(s) encontrado(s).`.
2. Após a confirmação da pausa, a área administrativa mostrou carregamento e,
   em aproximadamente 12,7 s, `Dados temporariamente indisponíveis`. Não havia
   tabela nem a conta administrativa apresentada como dado de listagem.
3. Clicar em `Tentar novamente` durante a pausa manteve a indisponibilidade
   observada após 15 s, sem retornar fixtures.
4. Após a confirmação da retomada, um novo login concluiu em aproximadamente
   2,8 s e a tabela voltou a mostrar `10 de 14 usuário(s) encontrado(s).`.
   Recarregar a página manteve a tabela e o total.

O teste confirma dependência efetiva do Aiven e recuperação do serviço publicado
sem redeploy. A recuperação foi observada por novo login em outro contexto de
navegador; não foi acionado o botão da página anterior após a retomada. Não há
correlação de logs para comprovar que a mesma instância/processo da Vercel
atendeu a falha e a recuperação. A estratégia de allowlist/egress e a consistência
entre instâncias ainda precisam de evidências; as tarefas 6.1 e 6.2 permanecem
parcialmente verificadas.

### Estratégia de acesso confirmada pelo responsável

O usuário confirmou que o filtro de IPs do Aiven está aberto a todos os IPs
(`open to all`) e que a Vercel não utiliza IP estático. A estratégia adotada é,
portanto, acesso público ao Aiven a partir do egress dinâmico da Vercel, com
autenticação por credenciais e transporte TLS no adapter. Não foi necessário
alterar a configuração de rede para o teste.

As leituras em produção e o teste de pausa/retomada comprovam o caminho real
até o Aiven nesse ambiente. O responsável aceitou explicitamente essa evidência
de Production como suficiente para a tarefa 6.1, dispensando a repetição no
Preview. O critério do checklist foi atualizado para refletir essa decisão e a
tarefa 6.1 foi concluída.

A tarefa 6.2 permanece parcialmente verificada: os testes remotos demonstraram
dados reais, erro recuperável e retorno do serviço sem redeploy, mas ainda não
comprovaram recuperação no mesmo processo nem atualização de uma conta criada
por outra instância dentro do limite definido. A dispensa de repetir a leitura
no Preview não foi interpretada como evidência desses cenários restantes.
