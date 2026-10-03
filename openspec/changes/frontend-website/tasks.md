## 1. Fundação do projeto

- [x] 1.1 Inicializar o Git com `.gitignore` e fazer o primeiro commit de `Contexto/` e `openspec/` — verificação: `git status` limpo e `git log --oneline` com um commit
- [x] 1.2 Criar o app com create-next-app em TypeScript, App Router e Tailwind na raiz do repositório — verificação: `npm run dev` sobe e `npm run build` conclui sem erro
- [x] 1.3 Inicializar shadcn/ui e adicionar os componentes base (button, input, label, select, checkbox, textarea, dialog, table, badge, tabs, toast, form, card) — verificação: página de laboratório renderiza todos os componentes sem erro de console
- [x] 1.4 Configurar Vitest, Testing Library e Playwright com os scripts `test:unit`, `test:e2e`, `lint` e `typecheck` — verificação: `npm run test:unit` executa um teste de exemplo e `npm run typecheck` passa
- [x] 1.5 Configurar ESLint e Prettier conforme o padrão do Next.js — verificação: `npm run lint` passa sem aviso
- [x] 1.6 Criar a estrutura `src/app`, `src/components/ui`, `src/features`, `src/lib/domain`, `src/lib/services`, `src/lib/mask`, `src/lib/auth` e `src/lib/fixtures` — verificação: `ls src/lib` mostra todos os diretórios
- [x] 1.7 Escrever o README com setup, comandos e a lista do que ainda é simulado — verificação: um leitor novo consegue rodar e testar o projeto seguindo só o README

## 2. Tokens, temas e identidade visual

- [x] 2.1 Criar arquivo único de tokens com a rampa de verde como cor principal e as variáveis semânticas de fundo, texto, borda, foco e estado, nos dois temas — verificação: os componentes base renderizam com o verde aplicado e contraste de texto sobre fundo medido em 4,5:1 ou mais nos dois temas
- [x] 2.2 Instalar next-themes com atributo por classe e injetar o script antiflash no layout raiz — verificação: com tema escuro salvo, a primeira renderização da página já sai escura, sem piscar o tema claro
- [x] 2.3 Criar o controle de alternância de tema com as opções claro, escuro e sistema — verificação: alternar o tema muda todas as telas sem recarregar a página
- [x] 2.4 Implementar a preferência de tema com persistência entre sessões e acompanhamento da preferência do sistema — verificação: teste unitário da preferência e teste E2E de persistência após logout e novo login
- [x] 2.5 Isolar o preview de documento em um escopo de tokens de impressão com fundo claro e texto escuro — verificação: preview aberto em tema escuro continua claro e a impressão sai sem áreas escuras de fundo
- [x] 2.6 Criar o item de logotipo do SELic com variante por tema e o ícone do navegador, e implementar a navegação recolhida em tela estreita — verificação: logotipo legível nos dois temas e navegação acessível por botão abaixo de 640 px
- [x] 2.7 Centralizar em `lib/domain/status` os rótulos, variantes de cor e ícones de cada situação de documento e de estágio, sempre com rótulo textual — verificação: teste unitário garantindo que toda situação tem rótulo, cor e ícone

## 3. Domínio e camada de dados simulada

- [x] 3.1 Tipar os agregados de domínio: usuário e papéis, aluno, curso, turma, período, convênio, estágio, documento, template, parecer, notificação e lançamento de horas — verificação: `npm run typecheck` passa
- [x] 3.2 Criar fixtures realistas com pelo menos dois cursos, turmas e períodos, convênios ativos e expirados, orientadores, supervisores, estágios em andamento e concluídos e documentos em todas as situações — verificação: script de validação de fixtures executa sem referência quebrada
- [x] 3.3 Implementar um módulo de serviço por agregado com funções assíncronas, busca, filtro e paginação — verificação: testes unitários chamando cada serviço e conferindo o retorno
- [x] 3.4 Implementar mutações em memória de criar, editar, excluir e inativar com duração da sessão do navegador — verificação: teste E2E de criar, editar e inativar um registro
- [x] 3.5 Definir as transições válidas de situação de documento e de estágio em `lib/domain/status` — verificação: teste unitário das transições aceitas e recusadas
- [x] 3.6 Escrever as máscaras puras de CPF, RG, celular, telefone, CEP e data — verificação: testes unitários com valores válidos, inválidos e colagem de texto
- [x] 3.7 Escrever os esquemas Zod reutilizáveis de CPF com dígito verificador, e-mail, telefone, intervalo de datas e campos condicionais — verificação: testes unitários de cada esquema
- [x] 3.8 Implementar a formatação pt-BR de datas, números e moeda com fuso America/Sao_Paulo — verificação: testes unitários dos formatos gerados

## 4. Shell, sessão simulada e navegação por papel

- [x] 4.1 Criar os layouts de route group para público, aluno, coordenação e administração, com guarda única lendo a sessão do cookie — verificação: acesso sem sessão a `/documentos` redireciona para `/login`
- [x] 4.2 Criar o registro `nav.ts` com `requiredRoles` e filtrar a navegação pelo conjunto de papéis do usuário — verificação: teste unitário do filtro para cada papel
- [x] 4.3 Montar a navbar do aluno com logotipo e os itens Documentos, Estágio e Perfil — verificação: aluno autenticado não vê nenhum item administrativo
- [x] 4.4 Derivar a navbar dos demais cargos do mesmo registro — verificação: coordenador de curso não vê itens de administração nem de estágio
- [x] 4.5 Criar as páginas de acesso não autorizado e de não encontrado sem expor dados — verificação: coordenador de curso acessando rota de admin recebe aviso e a resposta não contém dados do sistema
- [x] 4.6 Implementar a sessão simulada em cookie, o hook de sessão e o logout descartando as credenciais — verificação: teste E2E de logout seguido de recarga voltando para o login
- [x] 4.7 Criar o seletor de papel atrás de flag de ambiente — verificação: com a flag desligada o seletor não aparece e o build de produção não o inclui
- [x] 4.8 Implementar a matriz de autorização em que o administrador satisfaz qualquer exigência de papel — verificação: teste unitário da matriz para os quatro papéis

## 5. Autenticação, cadastro e recuperação de senha

- [x] 5.1 Criar a tela de login com validação de e-mail e senha e mensagem de erro genérica — verificação: e-mail inexistente e senha incorreta exibem exatamente a mesma mensagem
- [x] 5.2 Criar a primeira etapa do cadastro com matrícula, e-mail, senha e confirmação — verificação: confirmação divergente bloqueia o avanço com erro no campo
- [x] 5.3 Validar unicidade de e-mail no cadastro sem revelar dados da conta existente — verificação: teste E2E de recusa com e-mail já cadastrado
- [x] 5.4 Verificar a matrícula contra as matrículas registradas e sinalizar cadastro pendente — verificação: matrícula inexistente gera estado pendente e mensagem de aguardo de autorização
- [x] 5.5 Criar a segunda etapa do cadastro com os dados pessoais e selects dependentes de curso, turma e período — verificação: trocar o curso limpa turma e período e exige nova seleção
- [x] 5.6 Criar a fila de autorização de cadastro pendente para coordenadores e administrador, com decisão e motivo — verificação: teste E2E de autorização liberando o acesso e de recusa mantendo o cadastro inativo
- [x] 5.7 Bloquear o acesso de cadastro pendente a áreas autenticadas — verificação: teste E2E de aluno pendente em `/documentos` vendo aviso e nenhum dado do sistema
- [x] 5.8 Implementar a recuperação de senha com pedido, confirmação genérica e link de uso único — verificação: e-mail inexistente recebe a mesma confirmação e o link reutilizado é recusado
- [x] 5.9 Implementar a troca de senha autenticada exigindo a senha atual — verificação: teste E2E de senha atual incorreta mantendo a senha anterior
- [x] 5.10 Adaptar login e cadastro ao celular com navegação recolhida, sem rolagem horizontal e sem perder o preenchimento ao redimensionar — verificação: teste E2E de viewport móvel, de ausência de rolagem horizontal e de resize com formulário preenchido

## 6. Dados pessoais do aluno

- [x] 6.1 Criar o componente de campo com máscara como adaptador controlado sobre React Hook Form — verificação: digitar onze dígitos no celular exibe o valor formatado e letras são recusadas
- [x] 6.2 Validar CPF com dígito verificador ao sair do campo, recusando dígitos repetidos — verificação: testes unitários da validação e teste E2E de campo inválido
- [x] 6.3 Validar e-mail, telefone e celular conforme DDD e dez ou onze dígitos — verificação: testes unitários de formato válido e inválido
- [x] 6.4 Implementar a busca de endereço por CEP preenchendo logradouro, bairro, cidade e estado e mantendo os campos editáveis — verificação: teste E2E de CEP válido preenchendo os campos e de CEP inválido mantendo o formulário em branco
- [x] 6.5 Restringir curso, turma e período às opções cadastradas, sem digitação livre — verificação: teste E2E tentando valor não cadastrado e sendo recusado
- [x] 6.6 Criar a tela de perfil com edição de todos os dados e as mesmas validações do cadastro — verificação: teste E2E salvando alteração válida e recusando alteração inválida
- [x] 6.7 Exibir a matrícula em modo somente leitura e impedir sua alteração — verificação: teste E2E tentando editar a matrícula e confirmando que o valor original permanece
- [x] 6.8 Garantir que dados pessoais não sejam gravados fora da sessão — verificação: teste automatizado de varredura falhando se algum dado do aluno aparecer em armazenamento do navegador

## 7. Estágios do aluno

- [ ] 7.1 Criar o formulário de cadastro de estágio com instituição a partir de convênios ativos, supervisor, orientador, datas e situação — verificação: teste E2E de cadastro válido abrindo a seleção de documentos
- [ ] 7.2 Impedir a escolha de convênio expirado e avisar quando não há convênio ativo — verificação: teste E2E da mensagem de indisponibilidade
- [ ] 7.3 Validar o período do estágio e a coerência entre situação e data de fim — verificação: testes unitários de data final anterior à inicial e de concluído com data futura
- [ ] 7.4 Montar o histórico de estágios com busca, filtro por situação e total de resultados — verificação: teste E2E filtrando e conferindo o total
- [ ] 7.5 Criar o estado vazio do histórico com ação de cadastrar estágio — verificação: aluno sem estágios vê a mensagem e a ação
- [ ] 7.6 Montar a tela de detalhes com dados do estágio, documentos com situação e total de horas — verificação: teste E2E conferindo os três blocos
- [ ] 7.7 Criar o estado vazio de detalhes orientando iniciar a seleção de documentos — verificação: estágio sem documentos exibe a orientação
- [ ] 7.8 Implementar a seleção de documentos por estágio com persistência — verificação: teste E2E adicionando documentos e reabrindo a seleção
- [ ] 7.9 Exigir confirmação para remover documento preenchido e inativá-lo sem apagar — verificação: teste E2E do documento sumindo da seleção e continuando visível ao coordenador
- [ ] 7.10 Implementar a edição de estágio e o pedido de exclusão com autorização de cargo superior — verificação: teste E2E da exclusão registrada como aguardando autorização
- [ ] 7.11 Restringir a gestão de estágios do coordenador de curso aos alunos do seu curso e registrar a autoria da edição — verificação: teste E2E sem estágios de outro curso e com autoria exibida

## 8. Documentos, template, preview e horas

- [ ] 8.1 Tipar o descritor de template e o descritor de campo com origem, máscara, validação, parecer, assinaturas e classificação de trecho como campo, fixo ou instrução — verificação: `npm run typecheck` passa
- [ ] 8.2 Escrever os doze descritores a partir dos arquivos de `Contexto/kit-estagio`, incluindo a grade de 80 linhas da Ficha de Acompanhamento, a tabela mensal da Ficha de Frequência e os limites de palavras da Proposta de Atuação Pedagógica — verificação: revisão documento a documento contra cada arquivo do Kit com a cliente
- [ ] 8.3 Montar o catálogo indicando documento preenchível e documento apenas para download — verificação: teste E2E da distinção no catálogo
- [ ] 8.4 Implementar o download da Lei de Estágio e do Regulamento sem abrir formulário — verificação: teste E2E confirmando o download e a ausência de formulário
- [ ] 8.5 Criar o renderizador de formulário dirigido pelo descritor cobrindo todos os tipos de campo observados no Kit — verificação: página de laboratório renderizando um formulário para cada tipo de campo
- [ ] 8.6 Resolver o preenchimento automático de origem aluno e estágio em modo somente leitura — verificação: teste E2E dos campos automáticos não editáveis
- [ ] 8.7 Avisar pendência quando o dado de origem não existe no cadastro e orientar completar o cadastro — verificação: teste E2E de aluno sem endereço informado
- [ ] 8.8 Preencher a duração em horas do Termo de Compromisso com o total do estágio mantendo o valor ajustável — verificação: teste E2E do campo calculado e editável
- [ ] 8.9 Implementar gravação, reabertura e listagem dos documentos preenchidos por estágio — verificação: teste E2E de salvar, reabrir e localizar na lista
- [ ] 8.10 Exigir a indicação do estágio nos documentos vinculados, como o Termo Aditivo — verificação: teste E2E de submissão sem estágio recusada
- [ ] 8.11 Aplicar as permissões de preenchimento por perfil vindas do descritor — verificação: teste E2E de aluno recusado na Ficha de Frequência e no Convênio
- [ ] 8.12 Criar o registro da Ficha de Frequência já assinada, com lançamento de horas e das avaliações — verificação: teste E2E do registro associado ao estágio
- [ ] 8.13 Montar a página de impressão do preview, com a folha isolada em tokens de impressão e sem a interface ao redor — verificação: inspeção visual nos dois temas com a cliente e impressão sem áreas escuras (o isolamento em si é o 2.5)
- [ ] 8.14 Implementar o download em docx e pdf devolvendo arquivo de demonstração nesta entrega — verificação: teste E2E do download concluído
- [ ] 8.15 Recusar o download quando houver campo obrigatório pendente — verificação: teste E2E da recusa com a lista de pendências
- [ ] 8.16 Implementar o limite de palavras por seção com contador visível durante a digitação — verificação: teste E2E bloqueando a gravação acima do limite
- [ ] 8.17 Implementar a escala numérica de zero a dez com faixas e a escala qualitativa da autoavaliação, com conceito global — verificação: testes unitários do enquadramento de cada nota em sua faixa
- [ ] 8.18 Listar os comprovantes do Requerimento para Aproveitamento de Horas e bloquear a submissão com item pendente — verificação: teste E2E da recusa indicando os itens pendentes
- [ ] 8.19 Registrar horas aplicando os limites de seis horas por dia e trinta por semana, com desligamento do intervalo de almoço — verificação: testes unitários dos limites e teste E2E de lançamento excedente recusado
- [ ] 8.20 Manter o lançamento imutável e corrigir por lançamento de correção sem apagar o original — verificação: teste E2E do histórico com original e correção identificados
- [ ] 8.21 Exibir o total acumulado e a lista de lançamentos do estágio — verificação: teste E2E do total após correções

## 9. Parecer e notificações

- [ ] 9.1 Ler o metadado de parecer do descritor e identificar os documentos com parecer interno e externo — verificação: testes unitários da matriz de parecer dos doze documentos
- [ ] 9.2 Implementar a submissão a parecer validando o documento completo — verificação: teste E2E de recusa com campo pendente e de sucesso com documento completo
- [ ] 9.3 Recusar a submissão em documento que não exige parecer — verificação: teste E2E do aviso de que o documento não está sujeito a parecer
- [ ] 9.4 Aplicar as transições de situação do documento, de rascunho a submetido, em análise, aprovado e indeferido — verificação: testes unitários das transições permitidas e recusadas
- [ ] 9.5 Criar a fila de parecer do coordenador de curso restrita ao curso — verificação: teste E2E sem itens de outros cursos
- [ ] 9.6 Registrar o parecer com decisão e considerações e exibi-lo ao aluno — verificação: teste E2E do parecer visível para o aluno
- [ ] 9.7 Exigir a escolha entre aprovar e indeferir e permitir parecer sem considerações — verificação: teste E2E de decisão ausente recusada
- [ ] 9.8 Criar a fila da Comissão de Estágio exibindo o total de horas solicitado — verificação: teste E2E da fila com o total do requerimento
- [ ] 9.9 Sinalizar pendências na navegação e criar a central de notificações — verificação: teste E2E do contador de pendências por papel
- [ ] 9.10 Implementar o envio para responsável externo com registro de autor, data e destinatário — verificação: teste E2E do histórico de envios
- [ ] 9.11 Notificar o aluno quando o e-mail do responsável externo estiver indisponível — verificação: teste E2E do aviso ao aluno
- [ ] 9.12 Reenviar preservando o histórico e registrar falha permitindo nova tentativa — verificação: testes unitários do registro de envio com falha e do reenvio

## 10. Coordenação de estágio e de curso

- [ ] 10.1 Montar a listagem e a busca de documentos preenchidos por aluno, orientador, supervisor e instituição com total — verificação: teste E2E da pesquisa e do estado sem resultado
- [ ] 10.2 Cadastrar convênio com vigência de cinco anos e classificação automática por vencimento — verificação: testes unitários do cálculo de vigência
- [ ] 10.3 Listar convênios com classificação, contagem de estágios vinculados e contagem por classificação — verificação: teste E2E da listagem
- [ ] 10.4 Inativar convênio com estágio vinculado em vez de excluir — verificação: teste E2E da recusa de exclusão e do convênio preservado
- [ ] 10.5 Implementar o cadastro de cursos, turmas e períodos com vínculo obrigatório de curso — verificação: teste E2E do CRUD e da turma oferecida apenas ao curso vinculado
- [ ] 10.6 Implementar o cadastro e a exclusão de orientadores e supervisores com remoção de dados pessoais — verificação: teste E2E da exclusão com estágios preservados
- [ ] 10.7 Gerenciar os estágios dos alunos do curso com edição registrada em nome do coordenador — verificação: teste E2E da edição e da autoria
- [ ] 10.8 Conectar as filas de parecer do coordenador de curso e da comissão às telas de gestão — verificação: teste E2E navigating das telas de gestão até o parecer
- [ ] 10.9 Aplicar as regras de integridade recusando exclusão com vínculos e oferecendo inativação para curso, convênio, turma e template — verificação: quatro testes E2E de recusa com opção de inativação
- [ ] 10.10 Excluir aluno, orientador, supervisor e administrador com remoção de dados pessoais e preservação dos documentos — verificação: teste E2E da exclusão mantendo os documentos visíveis à coordenação
- [ ] 10.11 Dar ao coordenador de estágio acesso a todos os documentos preenchidos do campus — verificação: teste E2E de documento de aluno de qualquer curso visível

## 11. Administração do sistema

- [x] 11.1 Cadastrar, editar e excluir alunos pela administração, registrando automaticamente a matrícula informada quando ela ainda não consta e liberando o acesso — verificação: testes E2E de cadastro com matrícula nova e com matrícula já registrada, sem duplicar o registro
- [x] 11.2 Cadastrar coordenadores de estágio, coordenadores de curso e administradores com papel obrigatório e curso vinculado — verificação: testes E2E do CRUD e da recusa sem papel
- [x] 11.3 Listar usuários com filtro por papel, situação e curso, busca, perfil completo e inativação sem exclusão — verificação: teste E2E dos filtros, do perfil completo e da inativação bloqueando o acesso
- [ ] 11.4 Gerenciar templates com cadastro de nova versão, campos de preenchimento e histórico de versões — verificação: teste E2E do versioning com a versão vigente indicada
- [ ] 11.5 Recusar arquivo de template fora do formato docx e inativar template preservando os documentos gerados — verificação: testes E2E da recusa e da inativação
- [ ] 11.6 Manter a versão usada por documentos já preenchidos sem reaplicar os campos da nova versão — verificação: teste E2E de reabertura de documento com versão anterior
- [x] 11.7 Lançar matrícula válida pela tela de Matrículas, com dez dígitos, nome e curso, recusando duplicatas — verificação: teste E2E do lançamento e da recusa de matrícula duplicada
- [ ] 11.10 Exibir a importação de matrículas por arquivo com as válidas, as rejeitadas e as ignoradas com o motivo — verificação: teste E2E do relatório de importação com matrícula duplicada
- [x] 11.8 Avisar que o registro é manual enquanto não houver acesso oficial ao SIGAA — verificação: inspeção visual do aviso na tela de Matrículas
- [x] 11.9 Listar as matrículas registradas com busca por nome, matrícula ou curso, filtro por origem e o total — verificação: teste E2E da listagem

## 12. Estatísticas

- [ ] 12.1 Implementar a pesquisa de estágios por aluno, orientador, supervisor e instituição com o total de cada filtro — verificação: testes E2E dos quatro filtros e do estado sem resultado
- [ ] 12.2 Filtrar estágios concluídos combinado com os demais filtros — verificação: teste E2E do filtro combinado
- [ ] 12.3 Filtrar por curso e por ano e semestre com ordenação por data de início — verificação: teste E2E dos filtros e da ordenação
- [ ] 12.4 Calcular totais de horas por aluno, curso, turma e instituição, contando zero para estágio sem lançamento — verificação: testes unitários do cálculo
- [ ] 12.5 Montar os painéis de estágios em andamento e concluídos e de convênios ativos e expirados — verificação: teste E2E dos painéis
- [ ] 12.6 Exibir a quantidade de documentos gerados por tipo e por situação — verificação: teste E2E do painel de documentos
- [ ] 12.7 Calcular a taxa de aproveitamento de horas com deferidos e indeferidos — verificação: testes unitários do cálculo da proporção
- [ ] 12.8 Listar estágios concluídos sem parecer final e o total de pendências — verificação: teste E2E da lista de pendências
- [ ] 12.9 Aplicar o recorte por papel, do campus para o curso, sinalizando o recorte no título do painel — verificação: teste E2E dos dois recortes
- [ ] 12.10 Abrir a lista de registros a partir do valor exibido no indicador — verificação: teste E2E da navegação do indicador para a lista

## 13. Responsividade e acessibilidade

- [ ] 13.1 Auditar todas as telas em 360, 768 e 1440 pixels sem rolagem horizontal indevida — verificação: registro de revisão visual sem pendências
- [ ] 13.2 Garantir navegação recolhida e ações principais acessíveis no celular em todas as áreas — verificação: teste E2E de viewport móvel percorrendo as áreas do aluno
- [ ] 13.3 Garantir foco visível e ordem de tabulação em formulários e diálogos — verificação: teste E2E de navegação por teclado em login, cadastro de estágio e parecer
- [ ] 13.4 Associar rótulos e mensagens de erro aos respectivos campos — verificação: testes unitários de associação de rótulo e erro por campo
- [ ] 13.5 Fechar diálogos com escape devolvendo o foco ao elemento de origem — verificação: teste E2E do retorno de foco
- [ ] 13.6 Conferir contraste em ambos os temas para erro, foco e situação de documento — verificação: medição de contraste registrada sem valor abaixo de 4,5:1

## 14. Testes de fluxo

- [x] 14.1 Escrever o teste E2E do cadastro em duas etapas para matrícula válida e inválida — verificação: `npm run test:e2e` passa
- [ ] 14.2 Escrever o teste E2E do ciclo de estágio com seleção de documentos e limite de horas — verificação: `npm run test:e2e` passa
- [ ] 14.3 Escrever o teste E2E do ciclo de parecer, da submissão à decisão e à notificação — verificação: `npm run test:e2e` passa
- [ ] 14.4 Ampliar a suíte unitária para cobrir máscaras, esquemas Zod, descritores, situações e limites de horas — verificação: `npm run test:unit` passa cobrindo todas as regras de domínio

## 15. Pendências do Kit de Estágio

- [ ] 15.1 Converter o Convênio e o Termo de Compromisso de `.doc` para `.docx` fora do sistema e versionar o resultado — verificação: os dois arquivos `.docx` existem e foram conferidos contra os originais
- [ ] 15.2 Separar o arquivo que contém o Formulário de Liberação e o Plano de Atividades em dois `.docx` independentes — verificação: cada arquivo contém apenas o seu documento e os descritores correspondentes apontam para arquivos distintos
- [ ] 15.3 Remover do template da Proposta de Atuação Pedagógica a menção ao curso Licenciatura em Computação e conferir a genericidade de todos os templates — verificação: nenhum template cita curso específico e a cliente confirma a genericidade
- [ ] 15.4 Ajustar o cadastro e o descritor do convênio para o Campus Pinheiral, sem escolha de campus — verificação: formulário sem seletor de campus e descritor sem referência aos demais campi
- [ ] 15.5 Revisar os doze descritores com a cliente, documento a documento, contra os arquivos do Kit — verificação: ata de revisão sem itens pendentes

## 16. Validação final

- [ ] 16.1 Revisar responsividade e acessibilidade com a cliente e corrigir o que for apontado — verificação: lista de problemas zerada
- [ ] 16.2 Remover o seletor de papel e os dados de desenvolvimento da entrega — verificação: busca por resíduos sem resultado e build de produção limpo
- [ ] 16.3 Revisar o README com o que ainda é simulado e o que depende de backend — verificação: README lista persistência, e-mail e geração de documentos como pendentes
- [ ] 16.4 Rodar lint, typecheck, testes unitários, testes E2E e build — verificação: todos os comandos passam
- [ ] 16.5 Publicar o Preview na Vercel para validação das telas — verificação: endereço acessível e testado pela cliente