# SELic — Sistema de Gestão de Estágio

Frontend demonstrável do Sistema de Gestão de Estágio do IFRJ Campus Pinheiral.
O desenvolvimento segue OpenSpec/SDD: validar as telas e os contratos de domínio
primeiro, integrar banco de dados e backend definitivo depois.

## Tecnologias

- Next.js 16, App Router, React 19 e TypeScript em modo estrito.
- Tailwind CSS 4, componentes shadcn/ui sobre Radix UI e `next-themes`.
- React Hook Form, Zod, máscaras próprias e formatação pt-BR.
- Vitest/Testing Library para regras e componentes; Playwright para fluxos.
- Server Components para leitura e Server Actions para mutações no simulador.

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
estado existente. `PLAYWRIGHT_BASE_URL` permite apontar para outro servidor.

Para validar o build compilado, execute `npm run build` e depois
`PLAYWRIGHT_SERVER_COMMAND="npm run start" npm run test:e2e`. Isso evita a
compilação de rotas durante os testes. O fluxo do seletor de papel usa o servidor
de desenvolvimento com sua flag específica.

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
src/lib/mask/            máscaras controladas
src/lib/format/          datas, números e horas pt-BR
openspec/changes/frontend-website/  proposta, design, specs e tarefas
Contexto/kit-estagio/     documentos-fonte do Kit
```

As telas acessam os serviços; não importam fixtures diretamente. Papéis são um
conjunto, a navegação vem de `src/nav.ts` e o administrador satisfaz as guardas
de papel. As operações de estágio e documento também conferem o vínculo do
registro ao aluno, curso ou campus.

## Funcionalidades disponíveis

- Login, cadastro público em duas etapas, fila de autorização, recuperação e
  troca de senha simuladas.
- Perfil com máscaras, validação e matrícula imutável; busca de CEP simulada.
- Gestão administrativa de usuários e lançamento/listagem de matrículas.
- Cadastro, histórico, detalhes, edição, seleção de documentos e solicitação
  de exclusão de estágio. A exclusão solicitada aguarda autorização superior.
- Gestão de estágios com recorte por curso e autoria da edição registrada.
- Catálogo dos 12 documentos, formulários dirigidos por descritor, rascunhos,
  identificação automática somente leitura e aviso de dados ausentes.
- Limites de palavras, escalas de avaliação e conceito global calculado.
- Lançamentos de horas: até 6 h por dia e 30 h por semana, com opção de descontar
  1 h de almoço. Múltiplos lançamentos por data respeitam a soma diária.
- Correções imutáveis: cada correção substitui a contribuição de seu original
  nos totais, mantendo todos os registros no histórico.
- Submissão inicial a parecer, com recusa de campos e comprovantes pendentes.
  O Plano de Atividades não exige parecer; o Relatório Semestral exige parecer
  externo do orientador. As filas e o ciclo completo ainda estão pendentes.
- Downloads fixos do Kit e geração de arquivos **demonstrativos** em DOCX/PDF.
  O download usa o último preenchimento salvo ou submetido.
- Exclusão de usuários remove dados pessoais do cadastro e mantém referências
  necessárias aos documentos, estágios e pareceres históricos.

## O que é simulado e o que ainda falta

### Simulação prevista nesta entrega

- **Persistência:** `src/lib/services/store.ts` mantém dados na memória do
  processo do servidor, compartilhados entre usuários atendidos pela mesma
  instância. Recarregar a página ou fazer logout não limpa os registros;
  reiniciar o processo restaura as fixtures. Não há persistência em banco.
- **Preview Vercel:** instâncias podem ter estados diferentes. A publicação
  serve à revisão visual e de navegação; escrita é verificada localmente.
- **Autenticação:** o cookie HTTP-only contém o identificador do usuário. As
  credenciais ficam em memória como sal e digest SHA-256; Better Auth ainda não
  está integrado.
- **CEP e matrícula:** dados de demonstração, sem consulta oficial ao SIGAA ou
  a um serviço externo de endereço. A importação por arquivo ainda não tem UI.
- **E-mail:** recuperação mostra um link de demonstração. Não há envio real,
  Nodemailer ou integração com assinantes externos.
- **Documentos:** DOCX/PDF demonstrativos contêm valores do preenchimento, mas
  não reproduzem o layout oficial. Geração final com Docxtemplater é futura.

### Próximos incrementos planejados

O estado detalhado e os critérios de aceitação estão em
`openspec/changes/frontend-website/tasks.md`. Permanecem, entre outros:

- Registro da Ficha de Frequência recebida já assinada (8.12).
- Preview do documento preenchido e página de impressão integrada (8.13).
- Filas de parecer, decisões, central de notificações e histórico de envios.
- Gestão completa de convênios, cursos, turmas, orientadores e supervisores.
- Gerenciamento/versionamento de templates e importação de matrículas por arquivo.
- Estatísticas, auditoria de acessibilidade/responsividade e revisão com a cliente.

Prisma/MySQL, Better Auth, Nodemailer, geração final e integração oficial com
SIGAA pertencem às próximas mudanças. Os arquivos legados do Convênio e do
Termo de Compromisso já foram convertidos para DOCX; os originais permanecem
no histórico. A marca oficial do SELic já está incorporada.

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
