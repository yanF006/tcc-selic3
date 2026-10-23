# SELic — Sistema de Estágios das Licenciaturas

Frontend demonstrável do Sistema de Estágios das Licenciaturas do IFRJ Campus Pinheiral.
O desenvolvimento segue OpenSpec/SDD: validar as telas e os contratos de domínio
primeiro, integrar banco de dados e backend definitivo depois.

## Tecnologias

- Next.js 16, App Router, React 19 e TypeScript em modo estrito.
- Tailwind CSS 4, componentes shadcn/ui sobre Radix UI e `next-themes`.
- React Hook Form, Zod, máscaras próprias e formatação pt-BR.
- Vitest/Testing Library para regras e componentes; Playwright para fluxos.
- Server Components para leitura e Server Actions para mutações no simulador.
- Prisma 7 com driver adapter `mariadb` para persistir **usuários e matrículas**
  no MySQL; o restante do domínio segue no simulador em memória.

## Setup e comandos

Requisitos: Node.js 20 ou superior (testado no Node 24) e npm 10 ou superior.

```bash
npm install
npm run dev             # http://localhost:3000
npm run typecheck       # tipos das rotas e TypeScript
npm run lint
npm run test:unit
npm run test:e2e
npm run test:e2e:seletor # fluxo com seletor de papel habilitado
npm run build
npm run start           # serve o build de produção
```

`/login` inicia o fluxo de acesso. `/laboratorio` reúne os componentes, temas,
formulário dirigido por descritor e demonstração do isolamento de impressão.
`npm run format` formata o projeto; `npm run format:check` confere a formatação.

Os E2E modificam o simulador. Para uma execução completa e reproduzível, use um
servidor recém-iniciado. O Playwright inicia e encerra seu próprio `next dev`
quando não há servidor na porta 3000; se já houver um, ele o reutiliza, com o
estado existente. `PLAYWRIGHT_BASE_URL` permite apontar para outro servidor;
testes que escrevem estado devem rodar em servidor local ou de CI dedicado,
nunca contra o Preview da Vercel, cujo estado é compartilhado entre execuções.

Para validar o build compilado, execute `npm run build` e depois
`PLAYWRIGHT_SERVER_COMMAND="npm run start" npm run test:e2e`. Isso evita a
compilação de rotas durante os testes. O fluxo do seletor de papel usa o servidor
de desenvolvimento com sua flag específica.

## Banco de dados (Prisma 7 + MySQL)

A persistência real cobre **usuários e matrículas**; o restante do estado
continua nas fixtures em memória. O acesso usa o driver adapter
`@prisma/adapter-mariadb` (exigido pelo Prisma 7) com TLS, lido de uma única
variável de ambiente:

```bash
cp .env.example .env   # preencha DATABASE_URL com a URI do MySQL
```

Sem `DATABASE_URL` — e sempre nos testes unitários — a persistência fica
desligada e o simulador se comporta como antes. Com a variável presente, a
primeira leitura hidrata a memória a partir do banco; um banco vazio é semeado
com as fixtures, então as contas de demonstração continuam funcionando.

```bash
npm run db:generate   # gera o cliente em src/generated/prisma
npm run db:deploy     # aplica as migrações versionadas
npm run db:seed       # opcional: semeia usuários e matrículas
npm run db:migrate    # cria uma migração nova durante o desenvolvimento
```

O cliente gerado (`src/generated/prisma`) não é versionado: o `postinstall`
o recria a cada `npm install`. A conexão do app é montada em
`src/lib/db/prisma.ts`; hidratação e escrita contínua ficam em
`src/lib/db/persistencia.ts`.

## Contas de demonstração

A senha das contas de desenvolvimento é `selic123`.

| Perfil                      | E-mail                          |
| --------------------------- | ------------------------------- |
| Aluna                       | maria.souza@aluno.ifrj.edu.br   |
| Aluno com estágio concluído | joao.lima@aluno.ifrj.edu.br     |
| Aluna com endereço pendente | luiza.santos@aluno.ifrj.edu.br  |
| Coordenadora de Estágio     | ana.correia@ifrj.edu.br         |
| Coordenadora de Curso       | carla.menezes@ifrj.edu.br       |
| Administrador               | felipe.andrade@ifrj.edu.br      |
| Aluna com cadastro pendente | paula.batista@aluno.ifrj.edu.br |

O campus é fixo em **Pinheiral**. O seletor de papel é uma ferramenta de
demonstração, habilitada por `NEXT_PUBLIC_SELIC_SELADOR_PAPEL=true`.

## Arquitetura

```text
src/app/                 rotas, layouts, Server Actions e downloads
src/components/ui/       componentes base shadcn/ui
src/components/          shell, formulários, documentos, temas e identidade
src/features/            componentes de cadastro e gestão
src/lib/domain/          tipos, autorização de domínio, situações e validação
src/lib/services/        leitura e mutações do simulador
src/lib/fixtures/        dados fictícios de desenvolvimento
src/lib/templates/       descritores dos 12 documentos do Kit de Estágio
src/lib/auth/            cookie de sessão e guardas das áreas
src/lib/db/              cliente Prisma, hidratação e escrita contínua
src/lib/mask/            máscaras controladas
src/lib/format/          datas, números e horas pt-BR
prisma/                  schema, migrações e seed do MySQL
openspec/changes/        mudanças ativas; as arquivadas ficam em archive/
Contexto/kit-estagio/     documentos-fonte do Kit
```

As telas acessam os serviços; não importam fixtures diretamente. Papéis são um
conjunto, a navegação vem de `src/nav.ts` e o administrador satisfaz as guardas
de papel. As operações de estágio e documento também conferem o vínculo do
registro ao aluno, curso ou campus.

## Funcionalidades disponíveis

- Login, cadastro público em duas etapas, fila de autorização, recuperação e
  troca de senha simuladas.
- Perfil com máscaras, validação e matrícula imutável; consulta real de CEP pelo ViaCEP.
- Gestão administrativa de usuários e lançamento/listagem de matrículas.
- Cadastro, histórico, detalhes, edição, seleção de documentos e solicitação
  de exclusão de estágio. A exclusão solicitada aguarda autorização superior.
- Gestão de estágios com recorte por curso e autoria da edição registrada.
- Catálogo dos 12 documentos, formulários dirigidos por descritor, rascunhos,
  identificação automática somente leitura, endereços corrigíveis e aviso de dados ausentes.
- Limites de palavras, escalas de avaliação e conceito global calculado.
- Lançamentos de horas: até 6 h por dia e 30 h por semana, com opção de descontar
  1 h de almoço. Múltiplos lançamentos por data respeitam a soma diária.
- Correções imutáveis: cada correção substitui a contribuição de seu original
  nos totais, mantendo todos os registros no histórico.
- Submissão inicial a parecer, com recusa de campos e comprovantes pendentes,
  já utilizada pelo Requerimento para Aproveitamento de Horas. O Plano de
  Atividades não exige parecer; o Relatório Semestral exige parecer externo do
  orientador. A submissão dedicada com transições de situação (9.2–9.4), as
  filas e o ciclo completo de parecer ainda estão pendentes.
- Registro da Ficha de Frequência já assinada pela concedente, com lançamento
  de horas e avaliações, associado ao estágio como documento consultável.
- Página de impressão do documento preenchido, com a folha isolada em fundo
  claro nos dois temas e sem a interface ao redor.
- Downloads fixos do Kit e geração de arquivos **demonstrativos** em DOCX/PDF.
  O download usa o último preenchimento salvo ou submetido.
- Exclusão de usuários remove dados pessoais do cadastro e mantém referências
  necessárias aos documentos, estágios e pareceres históricos.

## Consulta de endereço por CEP

Cadastro, perfil e os sete grupos de endereço dos documentos usam
`GET /api/enderecos/cep?cep=<oito-digitos>`. O servidor consulta o ViaCEP com
timeout de cinco segundos; o cliente limita a espera a sete segundos. A busca
não usa chave de API, cache ou tentativas automáticas.

No cadastro e no perfil, informar um CEP válido inicia a consulta. Nos documentos,
o endereço do aluno vem primeiro do cadastro hidratado pelo banco; abrir o
formulário não consulta o ViaCEP. Use **Alterar endereço** e mude o CEP, ou
**Consultar CEP** para consultar o valor atual. Os endereços da concedente ficam
independentes; na ausência de fonte cadastrada vinculada, usam o preenchimento
salvo ou começam vazios.

Logradouro, bairro, cidade e UF continuam editáveis. Número e complemento são
sempre manuais. Falha externa, CEP inexistente ou resposta parcial preservam os
valores existentes e permitem salvar um preenchimento manual válido. Respostas
atrasadas não substituem um CEP mais recente nem campos editados durante a busca.
Correções no documento não alteram o perfil e prevalecem ao salvar/reabrir.

Registros antigos com endereço em texto livre mantêm esse texto até que
logradouro e número sejam reconstruídos. Transcreva manualmente número e
complemento: o sistema não tenta separar texto legado por vírgulas.

A consulta real não altera a persistência híbrida: endereços do cadastro usam
o JSON de dados pessoais do usuário; documentos continuam em memória e não
ganham durabilidade após reinício do servidor. Publique cliente, rota e adaptador
juntos. Em rollback, preserve os valores dos documentos, pois a versão anterior
pode reaplicar o endereço do perfil sobre rascunhos corrigidos.

Os testes do adaptador/rota usam rede controlada; os testes de integração
cobrem os nove grupos (cadastro, perfil, liberação/aluno e local, convênio,
termo, ficha, relatório/aluno e instituição). `e2e/suporte/cep.ts` intercepta
as consultas de navegador e `e2e/consulta-cep.spec.ts` cobre salvar/reabrir,
falhas e respostas atrasadas. Para executar os E2E com o banco de produção
desligado e sem depender do ViaCEP, use um servidor recém-iniciado:

```bash
DATABASE_URL= npm run test:e2e
```

## O que é simulado e o que ainda falta

### Simulação prevista nesta entrega

- **Persistência:** usuários e matrículas vivem no MySQL (Prisma 7, driver
  `mariadb`). Os demais dados — cursos, turmas, períodos, convênios, estágios,
  documentos e pareceres — seguem em `src/lib/services/store.ts`, na memória do
  processo do servidor. A memória é hidratada a partir do banco na primeira
  leitura e cada mutação é gravada de volta; sem `DATABASE_URL` o simulador roda
  inteiramente em memória, como antes.
- **Preview Vercel:** instâncias podem ter estados diferentes. A publicação
  serve à revisão visual e de navegação; escrita é verificada localmente.
- **Autenticação:** o cookie HTTP-only contém o identificador do usuário. As
  credenciais ficam em memória como sal e digest SHA-256; Better Auth ainda não
  está integrado.
- **Matrícula:** sem consulta oficial ao SIGAA. A consulta de CEP já usa o
  ViaCEP real; a importação de matrículas por arquivo ainda não tem UI.
- **E-mail:** recuperação mostra um link de demonstração. Não há envio real,
  Nodemailer ou integração com assinantes externos.
- **Documentos:** DOCX/PDF demonstrativos contêm valores do preenchimento, mas
  não reproduzem o layout oficial. Geração final com Docxtemplater é futura.

### Próximos incrementos planejados

O estado detalhado e os critérios de aceitação estão em
`openspec/changes/frontend-website/tasks.md`, com 46 das 143
tarefas ainda abertas. Permanecem, entre outros:

- Filas de parecer, decisões, central de notificações e histórico de envios.
- Gestão completa de convênios, cursos, turmas, orientadores e supervisores.
- Gerenciamento/versionamento de templates e importação de matrículas por arquivo.
- Estatísticas, auditoria de acessibilidade/responsividade e revisão com a cliente.

Prisma/MySQL cobre hoje usuários e matrículas; Better Auth, Nodemailer, geração
final, a migração do restante do domínio para o banco e a integração oficial com
SIGAA pertencem às próximas mudanças. A remoção do seletor de papel e dos dados
de desenvolvimento (16.2) é o último gate antes da entrega; a ordem de execução
da validação final está registrada na seção 16 do arquivo de tarefas. Os
arquivos legados do Convênio e do Termo de Compromisso já foram convertidos para
DOCX; os originais permanecem no histórico. A marca oficial do SELic já está
incorporada.

## Fluxo OpenSpec

```bash
openspec list --json
openspec status --change frontend-website --json
openspec instructions apply --change frontend-website --json
openspec validate frontend-website --type change
```

Uma tarefa só deve ser marcada como concluída depois de atender seu cenário e
executar a verificação correspondente. Antes de commit, execute typecheck,
lint, testes pertinentes e build. Revisões visuais com a cliente precisam de
registro próprio; testes automatizados não substituem essa confirmação.
