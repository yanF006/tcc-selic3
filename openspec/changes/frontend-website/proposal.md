## Why

O SELic ainda não tem nenhuma interface: o gerenciamento dos documentos de estágio do IFRJ Campus Pinheiral é feito hoje em formulários no Word/papel e num livro físico de convênios, o que gera retrabalho, perda de documentos e impossibilidade de extrair estatísticas. A ordem definida no projeto é começar pelas telas (frontend) para validar o fluxo com a cliente antes de integrar banco e backend, e nenhuma tela existe hoje.

## What Changes

- Cria o projeto Next.js (App Router, TypeScript, Tailwind CSS, shadcn/ui) com o design system do SELic (verde como cor principal, temas claro e escuro, responsividade para PC e celular).
- Cria as telas de autenticação: login por e-mail e senha, cadastro do aluno em duas etapas (matrícula/senha e dados pessoais), recuperação de senha por e-mail e layouts protegidos por papel (aluno, coordenador de estágio, coordenador de curso, administrador).
- Cria a navegação por papel: navbar do aluno (Documentos, Estágio, Perfil) e as equivalentes dos demais cargos.
- Cria o cadastro e a edição dos dados do aluno com máscaras e validações (CPF, e-mail, telefone, celular, CEP com busca de endereço) e selects dependentes de curso/turma/período.
- Cria o CRUD de estágios do aluno (instituição, supervisor, orientador, datas, situação), o histórico/lista de estágios, a tela de detalhes e a seleção de quais documentos preencher em cada estágio.
- Cria o catálogo dos 12 documentos do Kit de Estágio, a tela de preenchimento de template (download e preenchimento, exceto a Lei de Estágio e o Regulamento), o preview do documento no navegador e o registro de horas (ficha de acompanhamento).
- Cria o fluxo de parecer e notificação: submissão do documento, parecer de usuário do sistema (aprovar/reprovar/considerações), sinalização na interface e envio por e-mail para assinantes externos com aviso ao aluno quando o e-mail estiver indisponível.
- Cria a tela de perfil (edição dos dados, matrícula imutável).
- Cria as telas dos coordenadores: gestão de convênios (ativo/expirado), cursos, turmas/períodos, orientadores e supervisores; gestão dos estágios dos alunos do curso; pareceres pendentes.
- Cria as telas do administrador: CRUD de alunos, coordenadores e administradores, gerenciamento de templates de documento e importação de matrículas.
- Cria a área de estatísticas com pesquisa de estágios por aluno, orientador, supervisor e instituição, com filtro de concluídos e contagens.
- Todas as telas consomem uma camada de dados simulada (serviços/tipos em TS com fixtures), sem Prisma, MySQL, Better Auth, Nodemailer ou geração real de docx/pdf — que ficam para changes seguintes.

## Capabilities

### New Capabilities

- `autenticacao-acesso`: login por e-mail e senha, cadastro do aluno em duas etapas, recuperação de senha, sessão e guarda de rotas e navegação por papel.
- `interface-visual`: padrão visual do sistema com verde como cor principal, temas claro e escuro com preferência do usuário, identidade visual do SELic, responsividade e navegação por teclado.
- `dados-pessoais-aluno`: preenchimento e edição dos dados pessoais do aluno com máscaras, validações, selects dependentes e busca de endereço por CEP.
- `estagios-aluno`: CRUD, listagem/histórico, detalhes e seleção de documentos por estágio na perspectiva do aluno.
- `documentos-estagio`: catálogo dos 12 documentos, tela de preenchimento de template, preview, download de documentos fixos e registro de horas.
- `parecer-notificacoes`: submissão a parecer, entrada de parecer por usuário do sistema, notificações na interface e envio para assinatura externa.
- `gestao-coordenacao`: telas de gestão dos coordenadores de estágio e de curso (convênios, cursos, turmas/períodos, orientadores, supervisores, estágios de alunos do curso e pareceres).
- `administracao-sistema`: telas do administrador (alunos, coordenadores, administradores, templates de documento e importação de matrículas).
- `estatisticas`: pesquisa e filtragem de estágios por aluno, orientador, supervisor e instituição, com contagens e indicadores.

### Modified Capabilities

Nenhuma. O projeto ainda não possui specs.

## Impact

- **Código**: novo app Next.js na raiz do repositório (`src/app`, `src/components`, `src/features`, `src/lib`).
- **Dependências**: next, react, typescript, tailwindcss, shadcn/ui, react-hook-form, zod.
- **Contratos**: tipos TypeScript e serviços simulados definem o contrato que as mudanças futuras (Prisma/MySQL, Better Auth, Nodemailer, docxtemplater) vão implementar; as telas não devem acoplar-se a uma tecnologia específica de backend.
- **Fora de escopo**: persistência real, e-mails reais, geração/assinatura de docx e pdf, integração com o SIGAA e regras de exclusão/integridade no servidor.
- **Riscos**: navegação e permissões por papel estabilizam o modelo de rotas antes da autenticação existir, exigindo rearranjo mínimo quando o backend for integrado.
