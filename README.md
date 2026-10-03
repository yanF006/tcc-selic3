# SELic — Sistema de Gestão de Estágio

> Sistema de Gestão de Estágio (SELic) do IFRJ Campus Pinheiral, para
> acompanhamento de estágios, lançamento de horas, documentos do Kit de Estágio e
> pareceres de coordenação.

Este repositório contém **apenas o frontend** (Next.js 16, App Router, React 19 e
Tailwind 4). Os dados vêm de um simulador em memória; o backend é a etapa
seguinte do projeto.

## Requisitos

- Node.js 20 ou superior (testado no Node 24)
- npm 10 ou superior (testado no npm 11)

## Comandos

```bash
npm install          # instala as dependências
npm run dev          # servidor de desenvolvimento em http://localhost:3000
npm run build        # build de produção
npm run start        # serve o build de produção

npm run typecheck     # next typegen e tsc --noEmit
npm run lint         # ESLint (flat config, padrão do Next.js)
npm run format       # Prettier

npm run test:unit       # Vitest em execução única
npm run test:unit:watch # Vitest em modo watch
npm run test:e2e        # Playwright (fluxos de ponta a ponta)
npm run test:e2e:seletor # Playwright com o seletor de papel ligado
```

## Como rodar e testar em três minutos

1. `npm install`
2. `npm run dev`: `http://localhost:3000/login` entra no sistema e
   `http://localhost:3000/laboratorio` mostra os componentes base, o controle de
   tema claro/escuro e o contraste medido.
3. `npm run test:unit` para a suíte unitária (326 testes), `npm run test:e2e`
   para os fluxos de acesso, de senhas e de gestão de usuários,
   `npm run test:e2e:seletor` para o seletor de papel e `npm run typecheck` para a
   checagem de tipos.

## Contas de desenvolvimento

A tela de login simula o Better Auth com quatro contas fixas. A senha de todas é
`selic123`.

| Papel                  | E-mail                        | O que enxerga                                     |
| ---------------------- | ----------------------------- | ------------------------------------------------- |
| Aluno                  | maria.souza@aluno.ifrj.edu.br | Estágios, horas e documentos próprios             |
| Coordenador de Estágio | ana.correia@ifrj.edu.br       | Estágios da координа, fichas e pareceres da COIEE |
| Coordenador de Curso   | carla.menezes@ifrj.edu.br     | Documentos dos alunos do próprio curso            |
| Administrador          | felipe.andrade@ifrj.edu.br    | Usuários, convênios, matrículas e solicitações    |
| Aluno pendente         | paula.batista@aluno.ifrj.edu.br | Apenas o aviso de aguardo da autorização        |

O campus é fixo em **Pinheiral**: não existe seletor de campus.

## O que ainda é simulado

Nada abaixo fala com a rede: tudo roda no navegador.

- **Cadastro público.** `/cadastro` faz as duas etapas em memória
  (`src/lib/services/cadastro.ts`): matrícula e e-mail conferidos no servidor,
  confirmação de senha, selects dependentes de curso, turma e período e
  cadastro pendente quando a matrícula não consta nos registros importados.
- **Autenticação e sessão.** A sessão simulada vive em um cookie httpOnly com o
  identificador do usuário (`src/lib/auth/sessao-servidor.ts`), e o layout de
  servidor aplica a guarda de papel (`src/lib/auth/guard.ts`). Não há Better
  Auth: a senha fica em memória como sal + digest SHA-256
  (`src/lib/services/credenciais.ts`), sem texto legível, e o cadastro público
  passa a valer no login.
- **E-mail de redefinição.** `/recuperar-senha` pede o link e `/conta/senha` troca
  a senha autenticada (`src/lib/services/senhas.ts`). O link vale por 1 hora, é de
  uso único e a resposta é a mesma exista ou não a conta; como não há Nodemailer, o
  link aparece na própria tela para a demonstração.
- **Persistência.** `src/lib/services/store.ts` guarda o estado em memória: ele
  se perde ao recarregar a página e vale enquanto a aba do navegador estiver
  aberta.
- **Banco de dados.** Não há Prisma nem MySQL. `src/lib/domain/types.ts` é o
  contrato que o `schema.prisma` vai reproduzir.
- **Geração de `.docx` e PDF.** Os 12 documentos do Kit de Estágio estão
  catalogados em `src/lib/fixtures/templates.ts` com seus descritores em
  `src/lib/templates/descriptors.ts`, mas a geração do arquivo final é da etapa
  do backend.
- **Assinatura digital e envio externo.** Assinaturas de componentes externos
  (supervisor, instituição) ficam registradas como pendentes, sem Nodemailer.
- **Comprovantes, convênios e matrículas.** Validações de CPF, e-mail e datas
  existem (`src/lib/domain/schemas.ts`); consulta a Receita, ao SIGAA e ao
  backend do IFRJ não existe.
- **Estatísticas.** Os dados existem para a tela, mas os cálculos e o PDF ainda
  não foram implementados.

## Estrutura

```
src/
  app/                  rotas (App Router) e tokens globais em globals.css
  components/ui/        componentes base no estilo shadcn/ui
  components/           providers, logotipo e controles de tema
  lib/domain/           tipos, situações, esquemas Zod e máscaras
  lib/fixtures/         dados de exemplo do simulador
  lib/services/         fronteira de dados: telas nunca importam fixtures
  lib/templates/        descritores dos 12 documentos do Kit
  lib/mask/  lib/format/  lib/design/
openspec/changes/frontend-website/
  proposal.md           motivate e escopo
  design.md             arquitetura e decisões fechadas
  specs/                requisitos por capacidade
  tasks.md              as 142 tasks, com o estado da implementação
Contexto/kit-estagio/   documentos-fonte do Kit (12 arquivos)
```

## Regras de negócio implementadas

- Jornada de **6 horas por dia**, excluído o horário de almoço, e **30 horas por
  semana**.
- Correção de lançamento **preserva o histórico**: o valor anterior continua
  registrado e a correção entra como novo lançamento.
- Convênio **vigente por 5 anos**, com renovação e registro de histórico.
- Documentos seguem transições controladas: rascunho → submetido → em análise →
  aprovado/indeferido, sem volta para rascunho depois de aprovado.
- Formulários são gerados por **descritores**, com limites de palavras do Kit
  (por exemplo, 400 palavras na introdução da Proposta de Atuação Pedagógica).
- Nenhuma situação usa só cor: sempre há rótulo textual.
- **Inativar não exclui**: o acesso é bloqueado na sessão, o cadastro continua
  na lista e os registros criados pela pessoa são preservados.
- Cadastro de aluno com **matrícula fora do SIGAA** exige autorização explícita
  do administrador; sem ela o cadastro é recusado.

## Pendências conhecidas

- Os documentos 03 (Convênio de Estágio) e 06 (Termo de Compromisso) estão em
  `.doc` no Kit e ainda não foram convertidos para `.docx` (tarefa 15.1).
- Identidade visual (verde, tipografia, logotipo e ícone) é provisória, até a
  aprovação da cliente.
- Os descritores dos documentos ainda passam por revisão com a cliente.

## Rotas e navegação

As telas ficam em route groups do App Router por área, com uma guarda única por
área (`src/components/layout/shell-area.tsx`):

| Área          | Route group             | Papéis exigidos                              |
| ------------- | ----------------------- | -------------------------------------------- |
| Público       | `src/app/(publico)`     | —                                            |
| Conta         | `src/app/(conta)`       | qualquer usuário autenticado                 |
| Aluno         | `src/app/(aluno)`       | `aluno`                                      |
| Coordenação   | `src/app/(coordenacao)` | `coordenador_estagio` ou `coordenador_curso` |
| Administração | `src/app/(admin)`       | `administrador`                              |
| Gestão        | `src/app/(gestao)`      | coordenação ou administrador                  |

- `/recuperar-senha` pede o link de redefinição, `/redefinir-senha` consome o link
  e `/conta/senha` troca a senha de qualquer usuário autenticado, a partir do menu
  de conta da navbar.

- `/solicitacoes` é a fila de cadastros pendentes: a coordenação e a
  administração autorizam ou recusam com motivo registrado.
- O cadastro pendente entra no sistema, mas a casca troca o conteúdo pelo aviso
  de aguardo, sem nenhum dado do sistema.

- `src/nav.ts` é o registro único de navegação: cada item declara `requiredRoles`
  e a navbar é filtrada pelo conjunto de papéis do usuário.
- O administrador satisfaz qualquer guarda de papel (§4 do design).
- A Comissão de Estágio é condição do papel de Coordenador de Estágio, não um
  quinto papel: a Ficha de Frequência só aparece para membros.
- O seletor de papel (para demonstrar as quatro áreas) só é incluído quando
  `NEXT_PUBLIC_SELIC_SELADOR_PAPEL=true`.

## Convenções

- Nenhuma tela importa `src/lib/fixtures` diretamente: passa por
  `src/lib/services`.
- Nenhuma tela escreve o layout de um documento em JSX: usa
  `src/lib/templates/descriptors.ts`.
- Comandos de validação antes de commit: `npm run typecheck`, `npm run lint` e
  `npm run test:unit`.
