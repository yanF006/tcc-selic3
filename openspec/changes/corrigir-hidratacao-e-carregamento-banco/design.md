## Context

Ver `proposal.md` para a motivação. Hoje `src/lib/db/persistencia.ts` mantém um `Promise` de hidratação e um booleano `disponivel`. Uma falha no primeiro `prisma.usuario.count()` no Preview da Vercel (`ER_GET_CONNECTION_TIMEOUT`, 45028) grava `disponivel = false` e resolve a promise como sucesso; todas as leituras seguintes usam as fixtures até o processo reiniciar. Os timeouts do pool estão em 60 s e o `catch` registra apenas `erro.message`.

Apenas usuários e matrículas são persistidos. O restante do domínio continua nas fixtures e não deve ser afetado. As telas autenticadas passam por `usuarioDaRequisicao()`, que consulta usuários; portanto, qualquer área autenticada depende do banco quando `DATABASE_URL` existe.

## Goals / Non-Goals

**Goals:**

- Impedir que uma falha transitória vire modo permanente ou sucesso com fixtures.
- Tornar a indisponibilidade rápida, visível e recuperável, com carregamento e nova tentativa.
- Garantir que a listagem de usuários enxergue todo o conjunto persistido.
- Delimitar a atualização entre instâncias da Vercel sem exigir reinício.
- Preservar a causa real das falhas no log, sem credenciais.

**Non-Goals:**

- Migrar cursos, turmas, convênios, estágios, documentos ou pareceres para o banco.
- Substituir o cookie de sessão ou integrar Better Auth.
- Introduzir cache distribuído, Redis ou filas.
- Resolver o problema de rede do Aiven apenas por código; o allowlist/egress continua sendo pré-requisito operacional.
- Definir uma política de exibição de dados antigos durante indisponibilidade; este change falha de forma explícita.

## Decisions

### 1. Máquina de estados da persistência em vez de booleanos e latch

Substituir `hidratacao: Promise | null` e `disponivel: boolean | null` por um estado explícito:

```text
simulado  <- sem DATABASE_URL
pronto    <- ultima hidratacao bem-sucedida (com timestamp)
falha     <- ultima tentativa falhou (com proximaTentativa)
```

`garantirHidratacao()` passa a:

- retornar imediatamente no modo `simulado`;
- reutilizar o snapshot enquanto estiver dentro da validade;
- coalescer chamadas concorrentes em uma única hidratação;
- lançar `BancoIndisponivelError` quando a tentativa falhar;
- permitir nova tentativa após um cooldown curto, em vez de memorizar a falha para sempre.

Alternativa rejeitada: manter `disponivel = false` e apenas adicionar um botão de retry na UI. O botão não resolveria chamadas de layout, sessão e Server Actions, e a falha continuaria invisível fora da tela de usuários.

### 2. Validade curta do snapshot com coalescência por requisição

Adotar um TTL curto (2 s como padrão, configurável) para o snapshot de usuários/matrículas. Leituras dentro do TTL usam a memória; acima dele, disparam uma única hidratação coalescida. Mutações bem-sucedidas atualizam a memória e renovam o timestamp.

Isso define uma janela de consistência entre instâncias, em vez de um snapshot eterno. Também evita duas consultas ao banco em cada componente de uma mesma requisição.

Alternativas consideradas:

- **Leitura direta por requisição, removendo usuários/matrículas do estado global:** mais correta, porém exige refatorar todos os serviços que leem `obterEstado().usuarios` de forma síncrona. Fica para a migração definitiva de backend.
- **TTL zero (sempre consultar):** aumenta a latência em todas as páginas e multiplica consultas durante a navegação; o ganho sobre 2 s é pequeno para este domínio.
- **Snapshot eterno:** é o comportamento atual e causa o bug entre instâncias.

### 3. Falhar explicitamente, sem dados fictícios e sem dados antigos silenciosos

Com `DATABASE_URL` configurada, se a hidratação necessária falhar, a leitura falha com erro de domínio. Não há retorno de fixtures e não há exibição de snapshot expirado como se fosse atual. O erro sobe para o error boundary da área, que oferece nova tentativa.

Sem `DATABASE_URL`, o modo simulado continua retornando fixtures normalmente. A distinção é feita em `bancoConfigurado()`, não pelo conteúdo do banco.

Alternativa rejeitada: servir o último snapshot bom com um aviso. Ainda não há mecanismo de aviso global nem critério claro de aceitabilidade; introduzir isso agora misturaria indisponibilidade com sucesso parcial. Pode ser avaliado depois.

### 4. Timeouts e diagnóstico

Reduzir os limites padrão do pool para a faixa de 8–12 s (conexão, aquisição e inicialização), com `initializationTimeout` menor que `acquireTimeout` para que a causa real apareça antes do timeout de aquisição. Os valores ficam sobrescrevíveis por ambiente.

Registrar uma vez por tentativa:

- `name`, `code`, `errno`, `sqlState` e `message`;
- cadeia de `cause` com profundidade limitada;
- duração da tentativa.

Nunca registrar `DATABASE_URL`, usuário ou senha. A mensagem exibida ao usuário é genérica e inclui ação de nova tentativa.

### 5. Carregamento e erro no nível da área

Adicionar `loading.tsx` e `error.tsx` por route group que dependa de sessão/banco, com esqueleto e mensagem consistentes. O botão de nova tentativa usa `reset()` do error boundary e `router.refresh()` para forçar nova leitura do Server Component.

Server Actions que gravam no banco devem capturar `BancoIndisponivelError` e devolver resultado de negócio (`{ ok: false, erro }`), mantendo o formulário aberto e o botão desabilitado enquanto pendente. O erro de leitura não deve derrubar a aplicação inteira.

### 6. Filtros e paginação no servidor

A página de usuários passa a ler `searchParams` (busca, papel, situação, curso, página) e a chamar `listarUsuarios` com esses filtros e `tamanho`. O cliente renderiza os resultados já paginados e a navegação usa a URL. O `total` vem do conjunto filtrado no servidor, e não de uma página pré-carregada.

A mesma auditoria deve ser aplicada às demais listas persistidas para eliminar limites silenciosos. Hoje o caso concreto é a lista de usuários com `tamanho: 50` no servidor e filtragem sobre esses 50 no cliente.

### 7. Pré-requisito operacional do Aiven

A correção de aplicação só funciona se a Vercel conseguir abrir conexão com o Aiven. Antes da validação final, confirmar:

- serviço MySQL ativo e host/porta corretos;
- TLS exigido pelo Aiven aceito pelo adapter;
- egress da Vercel permitido no allowlist do Aiven, seja por faixa ampla com TLS/credencial forte, IP estático (Secure Compute) ou integração dedicada.

Sem isso, o comportamento correto passa a ser erro visível e recuperável, não lista de contas padrão.

## Risks / Trade-offs

- **TTL de 2 s ainda permite leitura levemente desatualizada entre instâncias** → documentar o limite e renovar imediatamente após mutação local; aceitável para a lista administrativa.
- **Falhar explicitamente aumenta a visibilidade de indisponibilidades curtas do Aiven** → cooldown curto, retry e mensagem clara; melhor do que dados fictícios.
- **Timeouts curtos podem abortar conexões lentas em cold start** → faixa de 8–12 s e configuração por ambiente; monitorar logs.
- **Error boundary genérico pode mascarar erros não relacionados ao banco** → mensagem diferencia indisponibilidade de banco de erro inesperado e registra a causa.
- **Paginação no servidor altera a URL e os testes E2E atuais** → atualizar testes para refletir busca/filtros por `searchParams`.
- **Allowlist do Aiven pode continuar bloqueando a Vercel** → tratar como gate operacional da entrega, não como bug de código.

## Migration Plan

1. Instrumentar o log completo e reduzir timeouts; validar que a causa real aparece no Preview.
2. Substituir o latch pela máquina de estados com TTL e cooldown, mantendo o modo simulado intacto.
3. Adicionar error/loading boundaries e ajustar Server Actions.
4. Mover filtros/paginação de usuários para o servidor e auditar listas persistidas.
5. Configurar/confirmar o acesso do Aiven a partir da Vercel.
6. Validar no Preview: falha controlada sem fixtures, recuperação sem reinício, dados atuais e lista completa.

Rollback: reverter o código para o snapshot anterior. Não há migração de schema. O banco permanece compatível; a diferença de comportamento fica restrita ao tratamento de falha e às consultas.

## Open Questions

- O allowlist do Aiven será aberto para o egress dinâmico da Vercel, ou será usado IP estático/Secure Compute? A resposta muda o custo operacional, não o desenho do código.
