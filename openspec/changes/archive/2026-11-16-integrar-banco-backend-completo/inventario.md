# Inventário de integração — tarefa 1.1

Levantamento do código em 2026-11-06. Este documento registra os consumidores a migrar; não comprova implementação dos serviços persistentes.

## 1. Estado global e destinos

As referências diretas ao store foram verificadas em `src/` por imports de `./store` e `@/lib/services/store`; os consumidores indiretos foram associados pelas importações dos serviços nas rotas, componentes e outros serviços. Os arquivos de teste são preparação de simulação, não evidência de persistência real.

| Origem em `src/lib/services/` | Estado ou dependência atual | Destino e tarefas |
| --- | --- | --- |
| `store.ts` | Todos os arrays de `EstadoSimulado`, fixtures e contador `novoId` | Adapter explícito de simulação; UUIDs; nenhuma leitura real do store (3.1–3.2, 12.5) |
| `cadastro.ts` | `previas` com senha em memória; usuários, matrículas e solicitações; `definirSenha` e ponte de persistência | Primeira etapa somente consulta; conclusão recebe formulário inteiro e usa signup transacional, dados pessoais e solicitação (1.4–1.5, 5.1–5.5) |
| `credenciais.ts` | Mapa de credenciais, hashes e bootstrap de contas de desenvolvimento | Métodos padrão Better Auth no modo real; separar preparação de simulação (1.3–1.6, 4.1–4.5) |
| `senhas.ts` | Mapa de links, `linkValido`, redefinição e troca por credencial local | Pedido/reset/troca padrão, sem tabela ou mapa paralelo (4.4–4.5) |
| `sessao.ts` | `sessaoAtual`, consultas de usuário, papéis, notificações e resets | Sessões persistidas; cargo escalar; eliminar notificações gerais, mantendo consultas de pendências (3.3, 4.1–4.3, 12.4–12.5) |
| `administracao.ts` | Usuários/matrículas hidratados; solicitações locais; decisões com restauração de arrays em erro | Consultas atuais, CRUD e decisão transacional ligada à conta por ID (6.1–6.5, 7.4, 11.1) |
| `aluno.ts` | Perfil no usuário hidratado; `moverCredencial` por e-mail; sincronização posterior dos documentos | Dados pessoais relacionados; e-mail canônico via provedor; preservar correções de endereço/documentos (4.6, 8.2) |
| `catalogo.ts` | Cursos, turmas, períodos, pessoas, convênios; `registrarConvenio` usa notificação como histórico | Cadastros persistentes, opções válidas e renovação específica, sem depender da central de notificações para manter dados do convênio (7.1–7.3) |
| `cadastros.ts` | CRUD dos catálogos, vínculos e inativação nos arrays | Casos de uso/repositórios relacionados e restrições de exclusão (7.1–7.3, 11.1) |
| `templates.ts` | Versões, descritores e conteúdo base64 em memória; gestão/publicação | Catálogo fixo e definição salva no preenchimento; retirar editor/publicação (8.1–8.4) |
| `documentos.ts` | Templates, usuários, estágios, valores, pareceres, envios e notificações; dependências de `templates`/`estagios` | Documento persistido com definição/checksum, submissão, parecer, observações e autorização; retirar efeitos de notificação (8.1–8.2, 9.2–9.5, 10.3–10.4) |
| `estagios.ts` | Estágios, usuários, documentos e exclusões; consultas síncronas de horas e permissões | Agregado transacional, relações de aluno/curso/campus, seleção e exclusão (9.1–9.2, 10.3, 11.2–11.3) |
| `fluxo-estagio.ts` | Preparação/submissão/conferência por alteração de objetos; envio simulado por existência de e-mail | Operações por agregado com cliente transacional; conferência com responsável/data; pedidos sem envio fictício (9.1, 9.3–9.5, 10.4) |
| `lancamentos.ts` | Consulta e escrita dos lançamentos locais; total diário/semanal e correções | Minutos e histórico imutável, validação sob bloqueio do estágio (10.1–10.2) |
| `frequencia.ts` | Aluno/estágio/documento e registros de horas/avaliação | Recebimento autorizado e documento/lançamentos persistidos (8.3, 10.3) |
| `observacoes.ts` | Usuário/documento, observação acrescentada ao array e autorização síncrona | Observações anexadas com autor/data e recorte autorizado (9.4) |
| `estatisticas.ts` | Conjunto local de usuários/estágios/documentos/horas | Consultas completas autorizadas e cálculo compartilhado de horas efetivas (12.1–12.2) |

`src/lib/db/persistencia.ts` também importa o store diretamente: não basta trocar os serviços deixando a ponte como fonte intermediária. `prisma.ts` hoje desliga persistência sob `NODE_ENV=test`; a nova suíte de integração precisa de seleção explícita, não de mocks que transformem simulação em suposta prova de MySQL.

Os serviços `endereco.ts`, `viacep-servidor.ts` e `requisicao-cep.ts` realizam consulta de CEP; não são armazenamento do domínio. `paginacao.ts` contém helpers puros; no modo real, filtros/totais/paginação devem considerar o banco completo. `erros.ts` mantém apresentação segura, distinguindo conflito/validação de indisponibilidade.

## 2. Helpers síncronos e dependências indiretas

| Funções atuais | Adequação necessária |
| --- | --- |
| `sessao`, `usuarioAtual`, `estaAutenticado`, `papeisAtuais`, `temPapel`, `membroComissaoEstagio`, `rotuloSessao`, `sessao.usuarioPorId` | Resolver identidade atual na fronteira de requisição; substituir cargo em lista por escalar e não usar `sessaoAtual` no servidor persistente |
| `notificacoesDoUsuario`, `notificar`, `marcarNotificacoesLidas` | Retirar do caminho real e da interface; totais de parecer/solicitações vêm de situações de negócio |
| `estagios.lancamentosDoEstagio`, `lancamentos.historicoDoDia`, `documentos.cursoDoDocumento` | Consultar repositório de modo assíncrono ou receber projeção autorizada já consultada; não ler arrays globais |
| `podeConsultarEstagio`, `podeAcrescentarObservacao`, `podeDecidirSolicitacao` | Separar política pura da resolução atual de relações/autor; manter checks nas ações e nas operações transacionais |
| `descritorDaVersao`, `descritorDoDocumento`, `validarValores`, `valoresDigitadosPermitidos` | Receber definição fixa/snapshot explícito; não recuperar versão por store; propagar alteração a documentos, estágios e validação de endereços |
| `limparPrevias`, `reiniciarCredenciais`, `senhas.limparLinks`, `store.reiniciarEstado` | Preparação antiga de simulação; não criar equivalentes de estado local no modo persistente |
| `classificacaoConvenio`, `somarAnos`, `contarPalavras`, `recorteDeEstatisticas`, `exigirGestaoCadastros` | Preservar regras puras com entradas atuais e cargo escalar; não precisam virar consulta apenas por hoje serem síncronas |

Dependências a preservar: perfil → sincronização de valores documentais sem invalidar parecer/liberação; catálogo → opções Zod do cadastro/perfil; documento → definição salva → valores permitidos; estágio → documentos iniciais → encaminhamento/parecer → conferência; horas → originais/correções → totais/estatísticas. Essas chamadas devem compartilhar o cliente transacional quando participarem da mesma mutação.

## 3. Fronteiras de servidor e consumidores de interface

Os caminhos abaixo são relativos a `src/`; as páginas e ações dentro de cada grupo integram o mesmo fluxo.

| Entrada/consumidor | Dependências atuais e destino |
| --- | --- |
| `app/(publico)/cadastro/{page.tsx,formulario-cadastro.tsx,acoes.ts}` | Catálogos e `cadastro.ts`; remover referência de prévia e enviar formulário inteiro, conservando duas etapas visuais |
| `app/(publico)/acoes/sessao.ts`, páginas de login, recuperação e redefinição; `app/(publico)/acoes/senha.ts` | Sessão e senha simuladas; delegar aos métodos padrão e apresentar resultados seguros |
| `lib/auth/{sessao-servidor.ts,guard.ts,sessao-contexto.tsx,permissions.ts}`, `app/page.tsx` e layouts de áreas | Cookie de ID, usuário hidratado e arrays de cargos; resolver sessão real/cargo atual. A exceção antiga de pendente atravessar a guarda passa a aviso público sem sessão de área protegida |
| `components/layout/{shell-area.tsx,navbar.tsx,seletor-papel.tsx}`, `nav.ts` | Shell lê `obterEstado().notificacoes` diretamente e conta filas de parecer; retirar central de notificações e seletor de identidade do modo real, preservar filas e navegação autorizada |
| `app/(admin)/admin/usuarios/`, `features/admin/usuarios/{tabela-usuarios.tsx,perfil-usuario.tsx}` | Cadastro/listagem/perfil, `usuario.papeis` e payload com lista; consumir cargo único e resultados persistentes paginados |
| `app/(admin)/admin/matriculas/`, `features/admin/matriculas/tabela-matriculas.tsx` | Importação/lançamento e consulta; persistir registros e resultado de lote com distinção entre matrícula válida e ocupada |
| `app/(gestao)/solicitacoes/`, `features/gestao/tabela-solicitacoes.tsx` | Lista e decisão; consultar todas as pendências autorizadas, decisão atômica e erro de concorrência |
| `app/(aluno)/perfil/` | Atualização de dados/e-mail e sincronização documental; preservar matrícula imutável e usar identidade canônica |
| `app/(aluno)/estagio/`, `app/(coordenacao)/coordenacao/estagios/` | Consultas, mutações e painel de fluxo; converter helpers dependentes de memória, proteger agregados e recortes |
| `app/(catalogo)/documentos/{page.tsx,acoes.ts,[templateId]/page.tsx}`, `components/documentos/` | Catálogo, preenchimento, parecer/observações e envios; definições fixas e snapshots, relações persistidas e filas |
| `app/(catalogo)/documentos/[templateId]/{baixar,baixar-preenchido}/route.ts`, `app/(impressao)/documentos/[templateId]/imprimir/page.tsx` | Arquivos oficiais, preenchimentos e impressão; preservar autorização e distinguir persistência de geração DOCX/PDF ainda fora desta entrega |
| `app/(coordenacao)/coordenacao/{documentos,frequencia,estatisticas}/` | Filas, ficha recebida e indicadores; recortes de cargo/curso e conjunto persistido completo |
| `app/(coordenacao)/coordenacao/cadastros/`, `app/(admin)/admin/convenios/`, `components/gestao/cadastros.tsx` | CRUD institucional/acadêmico e convênios; consumir relações e inativação do banco |
| `app/(coordenacao)/coordenacao/templates/`, `components/gestao/templates.tsx`, entrada correspondente em `nav.ts` | Adiados: retirar editor, publicação/upload administrativo e rotas de mutação; não confundir com recebimento de documento assinado |
| `app/(conta)/conta/notificacoes/acoes.ts`, sino/leitura em `navbar.tsx` | Adiados: retirar ações e UI de notificações; não retirar resultados ou pendências dos processos |
| `app/(conta)/conta/senha/` | Troca autenticada pelo provedor, sem mapa de credenciais |
| `lib/domain/{types.ts,usuario.ts,schemas.ts,selecoes.ts}` e fixtures | Contratos, cargo escalar, relações e validação; fixtures reais não viram seed automático. Listas de cargos permitidos numa rota ou em `papeisPreenchimento` de documento não significam múltiplos cargos de uma conta e podem continuar listas |
| `lib/templates/`, `lib/fixtures/templates.ts`, `next.config.ts` | Identificação/descritores do Kit e tracing dos arquivos; consolidar manifesto fixo e preservar leitura pela definição salva |

## 4. Testes e critérios de verificação

- `vitest.config.mts` usa JSDOM e `vitest.setup.ts`, com testes em `src/`: manter essa preparação de unitários separada da integração Node/MySQL. Existem testes que chamam resets e manipulam o store diretamente; não usá-los para comprovar restrições/rollback do banco.
- Testes de `lib/services/` e `lib/db/persistencia.test.ts` devem migrar segundo as responsabilidades acima. Asserções de `papeis: [...]`, prévia, versões e notificações precisam refletir o novo escopo; regras de parecer, correção e endereços continuam necessárias.
- `e2e/cadastro.spec.ts`, `solicitacoes.spec.ts`, `usuarios.spec.ts`, `senhas.spec.ts`, `acesso.spec.ts`, `dados-pessoais.spec.ts` e `matriculas-importacao.spec.ts` cobrem contas. Cadastro positivo precisa de matrícula livre preparada no banco de teste.
- `e2e/estagios.spec.ts`, `fluxo-estagio.spec.ts`, `lancamentos-horas.spec.ts`, `ficha-frequencia.spec.ts`, `documentos*.spec.ts`, `estatisticas.spec.ts` e `cadastros-gestao.spec.ts` cobrem o domínio mantido. `templates.spec.ts` deve verificar o catálogo fixo e ausência de publicação administrativa, não exigir funcionalidades adiadas.
- `e2e/usuarios.spec.ts` e `e2e/banco-indisponivel.spec.ts` injetam `selic-sessao` em cenários existentes: no modo persistente devem autenticar pela biblioteca ou demonstrar ausência de acesso, nunca aceitar ID arbitrário como sessão válida.
- `playwright.config.ts` atual sobe um único servidor. A prova de duas instâncias requer dois processos identificados, banco de teste compartilhado e requisições dirigidas a cada processo; registrar reinício de servidor separadamente de recarregamento do navegador.
- Confirmar nas regressões de navegação/acessibilidade/formulários a retirada de editor, central/sino e seletor de identidade do caminho real; arrays de permissões de rota continuam conjuntos de cargos aceitos, não cargos acumulados do usuário.

## 5. Dependências de execução encontradas

A próxima tarefa (1.2) requer MySQL exclusivo de testes. A verificação de executáveis desta sessão não encontrou `docker`, `podman`, `mysql`, `mysqld` ou `mariadbd` no `PATH`. Também não foram encontradas variáveis de banco de testes (`TEST_DATABASE_URL`, `DATABASE_URL_TEST`, `INTEGRATION_DATABASE_URL`) no ambiente, inclusive após carregar a configuração local por dotenv. Não foi localizado arquivo de provisionamento de integração/Compose no projeto. Não foram exibidos valores de credenciais nem usada a conexão da aplicação como destino de teste.

Portanto, o teste de leitura/escrita/limpeza da tarefa 1.2 ainda não pode ser executado. É necessário disponibilizar MySQL de testes ou autorizar a preparação da infraestrutura local. SMTP pode ser capturado por transporte de teste; não é necessário fornecer uma conta SMTP de produção para os ensaios locais.
