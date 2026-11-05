## Why

No Preview da Vercel, uma falha transitória de conexão com o Aiven (`ER_GET_CONNECTION_TIMEOUT`, código 45028) é convertida em sucesso pelo `catch` de `garantirHidratacao()`. O processo passa a responder para sempre com as fixtures e exibe apenas as contas padrão, mesmo após F5, até que uma nova instância seja criada. O log também descarta a causa real da falha, e não há estado de carregamento ou erro visível para o administrador.

## What Changes

- Tratar falha de banco, quando `DATABASE_URL` está configurada, como indisponibilidade explícita — nunca como sucesso com fixtures.
- Remover o latch permanente `disponivel = false`; tentar novamente na requisição seguinte com espera curta entre tentativas.
- Reduzir os timeouts de conexão/aquisição para falhar rápido e permitir carregamento e erro responsivos.
- Registrar a causa completa da falha (`code`, `errno`, `sqlState`, `cause`, stack), sem expor credenciais.
- Adicionar estados de carregamento, erro recuperável e nova tentativa em todas as telas que leem dados do banco.
- Garantir que listas e filtros enxerguem todo o conjunto persistido, sem limite silencioso de 50 registros no servidor nem filtragem apenas sobre a página carregada.
- Definir a atualização das leituras entre instâncias da Vercel (leitura por requisição ou cache com validade curta e invalidação), evitando snapshots eternos por processo.
- Documentar e verificar o pré-requisito de rede do Aiven para o egress da Vercel (IPs permitidos/TLS), sem o qual nenhuma correção de aplicação recupera a conexão.

## Capabilities

### New Capabilities

- `dados-remotos-confiaveis`: comportamento visível das telas que dependem do banco — carregamento, indisponibilidade, nova tentativa, resultados completos e ausência de dados fictícios apresentados como reais.

### Modified Capabilities

- `persistencia-aiven`: conexão resiliente, hidratação sem fallback silencioso, atualização das leituras, timeouts e diagnóstico de falhas.

## Impact

- `src/lib/db/persistencia.ts` e `src/lib/db/prisma.ts`: máquina de estados da conexão, retry, timeouts e log.
- `src/lib/services/administracao.ts` e telas de usuários/matrículas: leitura atual, paginação e filtros no servidor.
- Layouts/route groups e Server Actions: `loading.tsx`, error boundary, Suspense e estados pendentes.
- Testes unitários, de integração e E2E: simulação sem banco, falha com banco configurado, retry, carregamento e resultados completos.
- Operação Vercel/Aiven: verificação de egress/IP permitido e TLS no ambiente de Preview.
