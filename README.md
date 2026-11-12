# SELic — Sistema de Estágios das Licenciaturas

Frontend demonstrável do Sistema de Estágios das Licenciaturas do IFRJ Campus Pinheiral.
O desenvolvimento segue OpenSpec/SDD: validar as telas e os contratos de domínio
primeiro, integrar banco de dados e backend definitivo depois.

**Esse arquivo README.md pode estar desatualizado...**

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

## Variáveis na Vercel

Consulte [`.env.vercel.example`](.env.vercel.example) para a configuração de
Production/Preview com MySQL do Aiven, Better Auth e SMTP do Brevo. Cada variável
indica se o valor precisa ser **alterado**, **conferido** ou é **opcional**.

Preencha `DATABASE_URL`, `BETTER_AUTH_SECRET`, `SMTP_USER`, `SMTP_PASSWORD` e
`SMTP_FROM`; confira `BETTER_AUTH_URL` e configure `SELIC_DB_CA_CERT` quando a CA
do banco for necessária. O exemplo usa Brevo na porta 587 com STARTTLS.
Cadastre os valores em **Settings → Environment Variables**, selecione o ambiente
correto e faça um **Redeploy**. O arquivo de exemplo não é carregado automaticamente.
Preview deve usar banco e segredo próprios, separados de Production.

Ao introduzir ou alterar variáveis de ambiente, mantenha `.env.example` e
`.env.vercel.example` atualizados com obrigatoriedade, valores de exemplo sem
segredos e instruções de preenchimento aplicáveis a cada ambiente.

## Banco de dados (Prisma 7 + MySQL)

O modo de dados é escolhido por `SELIC_PERSISTENCIA`:

- **`persistente`** (exige `DATABASE_URL`): todo o domínio lê e grava no MySQL.
  Não há cópia em memória, hidratação, semeadura automática nem contas de
  demonstração. Falha de conexão vira a tela de dados indisponíveis, com nova
  tentativa; nunca vira dado simulado.
- **`simulado`**: o simulador em memória, com as fixtures de demonstração. Testes
  unitários sempre usam este modo.

```bash
cp .env.example .env   # preencha DATABASE_URL e SELIC_PERSISTENCIA
npm run db:generate    # gera o cliente em src/generated/prisma
npm run db:deploy      # aplica as migrações versionadas (nunca db:push em produção)
npm run db:carga-inicial   # cria só o primeiro administrador (SELIC_ADMIN_EMAIL/NOME)
```

Cada conta tem um único cargo (`papel`): aluno, coordenador de curso, coordenador de
estágio ou administrador. Não há vários cargos por conta.

O primeiro administrador não recebe senha pela carga: ele usa o fluxo padrão de
recuperação de senha com o e-mail informado. O seed de demonstração
(`npm run db:seed`) exige `SELIC_SEED_DEMONSTRACAO=1` e só roda em banco de
ensaio; não há semeadura automática pela aplicação.

Documentação operacional:

- `docs/operacao-dados.md`: inspeção, backup, restauração, transformação dos
  dados pessoais, carga inicial e ensaio de implantação interrompida.
- `Contexto/criar-banco-selic.sql`: estrutura final do banco (sem dados), com
  instruções de execução e versão do MySQL (8.0). Conferido contra o schema.

O cliente gerado (`src/generated/prisma`) não é versionado: o `postinstall`
o recria a cada `npm install`. A conexão do app é montada em
`src/lib/db/prisma.ts`, com tradução de falhas de conexão em indisponibilidade.

## Contas de demonstração

As contas abaixo existem só no modo `simulado` (ou no seed de demonstração
em banco de ensaio). Em modo `persistente`, nenhuma conta de demonstração é criada.
A senha das contas de desenvolvimento do simulador é `selic123`.

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

## O que é simulado e o que ainda falta

### O que continua simulado nesta entrega

- **Modo simulado:** existe apenas como ferramenta de desenvolvimento e testes,
  selecionado por `SELIC_PERSISTENCIA=simulado`. No modo `persistente` ele não é
  consultado.
- **Preview Vercel:** a publicação serve à revisão visual e de navegação. A
  verificação de escrita entre instâncias é feita no ambiente de ensaio.
- **Matrícula:** a consulta oficial ao SIGAA não existe; a matrícula é conferida
  contra as matrículas importadas ou lançadas pelo administrador.
- **Documentos:** DOCX/PDF gerados são demonstrativos e não reproduzem o layout
  oficial. A geração final é uma entrega própria.
- **Cadastro:** o formulário não guarda prévia no banco. Recarregar a página
  descarta o que foi preenchido e não grava senha no navegador.

### Adiado por decisão do change `integrar-banco-backend-completo`

- Notificações gerais (central e sino) e trilha genérica de alterações.
- Editor e versionamento de templates: o Kit de Estágio é fixo e identificado.
- Geração final de DOCX/PDF oficiais, com entrega documental própria.
- Integração oficial com o SIGAA.

Os arquivos legados do Convênio e do Termo de Compromisso já foram convertidos
para DOCX; os originais permanecem no histórico. A marca oficial do SELic já está
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
