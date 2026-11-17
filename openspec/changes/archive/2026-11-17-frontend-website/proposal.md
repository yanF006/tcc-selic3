## Why

O gerenciamento dos documentos de estágio do IFRJ Campus Pinheiral em formulários no Word/papel e num livro físico de convênios gera retrabalho, perda de documentos e dificuldade para extrair estatísticas; esta mudança entrega as telas para validar o fluxo com a cliente. Com a interface parcialmente implementada, a revisão baseada em `Contexto/fluxoEstagios.md` e nas decisões da exploração redefine o início do estágio para exigir documentação inicial, parecer favorável e conferência de assinaturas antes da continuidade.

## What Changes

- Cria o projeto Next.js (App Router, TypeScript, Tailwind CSS, shadcn/ui) com o design system do SELic (verde como cor principal, temas claro e escuro, responsividade para PC e celular).
- Cria as telas de autenticação: login por e-mail e senha, cadastro do aluno em duas etapas (matrícula/senha e dados pessoais), recuperação de senha por e-mail e layouts protegidos por papel (aluno, coordenador de estágio, coordenador de curso, administrador).
- Cria a navegação por papel: navbar do aluno (Documentos, Estágio, Perfil) e as equivalentes dos demais cargos.
- Cria o cadastro e a edição dos dados do aluno com máscaras e validações (CPF, e-mail, telefone, celular, CEP com busca de endereço) e selects dependentes de curso/turma/período.
- **BREAKING**: substitui o cadastro de estágio já em andamento ou concluído por uma solicitação em preparação: o aluno informa os dados necessários e o sistema preenche automaticamente o Termo de Compromisso, o Formulário de Liberação e o Plano de Atividades. A situação passa a ser controlada pela coordenação.
- O aluno solicita o encaminhamento; apenas o Formulário de Liberação exige parecer do Coordenador de Curso entre os três documentos iniciais. Parecer desfavorável devolve o formulário para correção e nova submissão, preservando o histórico e bloqueando o envio para assinaturas.
- O parecer favorável libera o envio dos documentos iniciais por e-mail aos respectivos assinantes. O Coordenador de Estágio confirma no site as assinaturas obtidas fora do sistema; essa confirmação coloca o estágio em andamento, notifica o aluno e libera os demais documentos daquele estágio.
- Mantém histórico/lista e detalhes; bloqueia a edição dos dados iniciais pelo aluno, com exceção para correção após indeferimento, e permite cancelar a solicitação enquanto aguarda liberação. Após a liberação são editáveis os dados informados posteriormente; o perfil permanece editável e atualiza os dados correspondentes sem nova autorização. A exclusão preserva nome e histórico do estágio e remove os dados pessoais do aluno vinculados ao registro. A seleção opcional de documentos fica disponível após a liberação e não inclui a remoção dos três documentos iniciais obrigatórios.
- Cria o catálogo dos 12 documentos do Kit de Estágio, a tela de preenchimento de template (download e preenchimento, exceto a Lei de Estágio e o Regulamento), o preview do documento no navegador e o registro de horas (ficha de acompanhamento).
- Cria o fluxo de parecer e notificação: submissão do documento, parecer de usuário do sistema (aprovar/reprovar/considerações), sinalização na interface e envio por e-mail para assinantes externos com aviso ao aluno quando o e-mail estiver indisponível.
- Acrescenta observações por documento, com conteúdo, autor e data, registradas apenas pelo Coordenador de Curso ou pelo Coordenador de Estágio ao emitir parecer, ao confirmar assinaturas ou a qualquer momento, preservando as observações anteriores.
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
- `estagios-aluno`: solicitação e preparação do estágio, liberação pela coordenação, histórico, detalhes e seleção dos demais documentos após a liberação.
- `documentos-estagio`: catálogo dos 12 documentos, preenchimento automático dos três documentos iniciais, bloqueio por etapa, observações por documento, preview, download de documentos fixos e registro de horas.
- `parecer-notificacoes`: parecer do Formulário de Liberação com correção e reenvio, envio posterior para assinaturas, notificações e demais pareceres previstos no Kit.
- `gestao-coordenacao`: telas de gestão, pareceres, confirmação das assinaturas iniciais pelo Coordenador de Estágio, controle da situação e registro de observações.
- `administracao-sistema`: telas do administrador (alunos, coordenadores, administradores, templates de documento e importação de matrículas).
- `estatisticas`: pesquisa e filtragem de estágios por aluno, orientador, supervisor e instituição, com contagens e indicadores.

### Modified Capabilities

Nenhuma capability durável é modificada: as quatro capabilities do fluxo continuam sendo introduzidas nesta mudança. As specs duráveis de consulta de CEP e persistência Aiven não fazem parte desta revisão.

## Impact

- **Código**: novo app Next.js na raiz do repositório (`src/app`, `src/components`, `src/features`, `src/lib`).
- **Dependências**: next, react, typescript, tailwindcss, shadcn/ui, react-hook-form, zod.
- **Contratos**: tipos TypeScript e serviços simulados definem o contrato que as mudanças futuras (Prisma/MySQL, Better Auth, Nodemailer, docxtemplater) vão implementar; as telas não devem acoplar-se a uma tecnologia específica de backend.
- **Revisão do fluxo**: exige adequar situações de estágio, permissões de mutação, preenchimento inicial, distinção entre parecer e assinatura, histórico de observações, fixtures e testes. O fluxo de envio permanece simulado nesta entrega, inclusive o encaminhamento após aprovação.
- **Fora de escopo**: persistência real, e-mails reais, geração/assinatura de docx e pdf, integração com o SIGAA e regras de exclusão/integridade no servidor.
- **Riscos**: navegação e permissões por papel estabilizam o modelo de rotas antes da autenticação existir, exigindo rearranjo mínimo quando o backend for integrado.
