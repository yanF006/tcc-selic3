## Context

Estado atual e restrições que moldam a abordagem. A motivação está em `proposal.md` e os requisitos em `specs/`.

- O planejamento original antecedeu o código. Na revisão do fluxo, a interface já está parcialmente implementada e versionada; `src/lib/services/estagios.ts` ainda cria estágios diretamente em andamento ou concluídos, e os formulários permitem seleção livre de documentos.
- O projeto será implantado na Vercel, com MySQL no Aiven, Prisma, Better Auth, Nodemailer e docxtemplater previstos no `Contexto/visaoGeral.md` (§15, §17), mas a ordem definida em `Contexto/desenvolvimento.md` é telas primeiro, banco e backend depois.
- Os 9 arquivos de `specs/` definem o contrato desta entrega de frontend. A revisão do início do estágio está concentrada em `estagios-aluno`, `documentos-estagio`, `parecer-notificacoes` e `gestao-coordenacao`.
- Os 12 documentos do Kit de Estágio estão em `Contexto/kit-estagio`: 2 PDFs de download, 8 `.docx` e 2 arquivos `.doc` legados (Convênio e Termo de Compromisso), que precisam ser convertidos fora do sistema antes do cadastro (§7.4).
- O único insumo visual inicial era a regra "verde como cor principal" (§16). A marca oficial chegou depois, em `Assets/selic-logo.svg`; continuam sem definição o valor oficial do verde, a tipografia e o ícone do navegador.
- A camada de persistência será substituída depois, mas as telas não podem depender de nada específico do simulador.
- `Contexto/fluxoEstagios.md` e as decisões confirmadas na exploração definem a revisão: três documentos iniciais preenchidos automaticamente, parecer somente no Formulário de Liberação, envio para assinaturas após aprovação e liberação pelo Coordenador de Estágio. As observações têm autor e data e também podem ser acrescentadas fora dessas ações.

## Goals / Non-Goals

**Goals:**

- Entregar todas as telas das 9 capabilities de `specs/` navegáveis e demonstráveis para a cliente, sem backend.
- Fixar o modelo de rotas e permissões agora, de modo que a troca por Better Auth não renomeie URLs nem reescreva a navegação.
- Congelar o contrato de dados (tipos + assinaturas de serviço) que o Prisma vai implementar depois, sem que as telas mudem.
- Tornar os formulários de documento dirigidos por dados, para que os templates do Kit sejam configuração e não código.
- Separar a preparação da solicitação da autorização para iniciar o estágio, aplicando os mesmos bloqueios na interface e nas mutações dos serviços.
- Entregar os temas claro e escuro e a paleta na mesma entrega, já que mexer em tokens depois é retrabalho caro.

**Non-Goals:**

- Persistência, autenticação real, envio real de e-mail e geração real de docx/pdf (ver `proposal.md`).
- Interface de administração da autorização de matrícula: a decisão é uma fila simples, não um workflow configurável.
- Editor visual de template (arrastar e soltar campos). O admin gerencia o descritor de campos por formulário, não um construtor WYSIWYG.
- Conversão de `.doc` legado para `.docx`: segue fora do sistema (§7.4).
- Página pública institucional e internacionalização: o sistema é de uso exclusivo do IFRJ, em um único idioma.
- Layout de impressão de relatórios agregados; a impressão vai ser apenas o preview de documento.

## Decisions

### D1. Rotas por role group, com guarda única em layout compartilhado

As telas ficam em route groups do App Router por domínio de acesso (`(publico)`, `(aluno)`, `(coordenacao)`, `(admin)`), e cada group tem um único layout que resolve a sessão e executa a guarda de papel. Os prefixos `/admin` e `/coordenacao` representam áreas funcionais compartilhadas, não um papel exclusivo; os route groups em si não entram na URL.

- **Alternativa:** uma URL por cargo (`/coordenador-curso/...`, `/coordenador-estagio/...`). Rejeitada porque duplica as áreas compartilhadas e amarra a navegação ao papel.
- **Alternativa:** um layout por papel replicando a guarda. Rejeitada por duplicação.
- **Efeito colateral:** o administrador acessa todas as áreas (§4). Essa guarda de navegação não substitui as regras de autoria das ações: observações exigem papel de coordenação, e a liberação inicial exige papel de Coordenador de Estágio, mesmo quando a área é acessível ao administrador.

### D2. Registro único de navegação alimentado por permissões

Um `nav.ts` declara os itens com `requiredRoles`, `icone` e `grupo`, e o layout filtra a lista por papel. Os requisitos de navegação por papel (`autenticacao-acesso`) e de interface (`interface-visual`) passam a ter uma única fonte, sem menu duplicado por layout.

A navbar mostra até quatro itens na linha principal e agrupa os demais em um menu por área (Gestão, Administração), com o rótulo da área como gatilho. O agrupamento é decisão de apresentação, não de permissão: o item continua no mesmo registro de `nav.ts`, então a guarda de papel e a contagem de permissões não mudam. No celular, a linha principal e os menus dão lugar a um painel acionado por botão.

- **Alternativa:** menu com todos os itens para todos os papéis. Rejeitada porque alonga a linha principal e esconde o que muda entre papéis.
- **Alternativa:** itens sem ícone. Rejeitada porque a lista de áreas é longa e o ícone dá varredura visual sem custos de tradução.

- **Alternativa:** menus escritos à mão em cada layout. Rejeitada porque divergem entre si e ninguém detecta a divergência.

### D3. Sessão simulada em cookie, papéis como conjunto, com seletor de papel

Sem autenticação, é preciso navegar as quatro áreas para validar com a cliente. A sessão simulada fica em cookie (não em contexto React) para que layouts de servidor e componentes de cliente leiam o mesmo estado, e `roles` é um conjunto, e não um valor único. Um seletor de papel no cabeçalho, atrás de flag de ambiente, troca a sessão para demonstrar cada área.

- **Alternativa:** sessão só em contexto do cliente. Rejeitada porque a guarda em layout de servidor não enxergaria o estado.
- **Alternativa:** um build por papel. Rejeitada porque impede validar navegação entre áreas na mesma sessão.
- **Consequência:** `roles` como conjunto já aceita multi-papel; se a cliente confirmar que um usuário pode acumular cargos, nenhum requisito precisa mudar.

### D4. Camada de serviço tipada sobre fixtures, sem biblioteca de dados

Cada agregado tem um módulo em `src/lib/services` com funções assíncronas e os tipos de domínio. A implementação atual lê fixtures e mantém as mutações em memória no processo do servidor. Telas importam apenas o serviço, nunca as fixtures. Sem React Query e sem MSW: ainda não há rede para cachear nem servidor para simular.

- **Alternativa:** Prisma agora. Rejeitada porque contraria a ordem do projeto e a configuração do Aiven ainda é informação de conexão, não esquema.
- **Alternativa:** MSW para simular HTTP desde já. Rejeitada porque resolve um problema que só existe quando houver servidor.
- **Efeito colateral:** os tipos viram o contrato a ser reproduzido pelo `schema.prisma`; a mudança de backend troca implementação, não assinatura.
- **Consequência:** como o estado mora na memória do processo, o Preview da Vercel não é confiável para verificar escrita — cada instância tem a sua cópia e o que foi lançado em uma instância não aparece na seguinte. O Preview serve para revisão visual e de navegação; o teste de escrita acontece em `npm run test:e2e`, que roda contra um servidor único.

### D5. Formulários de documento dirigidos por descritor de template

Cada template é um descritor: identidade do documento, se é preenchível ou só download, responsável e tipo de parecer, assinaturas exigidas, e a lista de campos. Cada campo declara `key`, `label`, `type`, `required`, máscara, regra de validação, e a **origem do valor** (`aluno`, `estagio`, `literal`, `digitado`). A tela de preenchimento renderiza o formulário a partir do descritor e resolve a origem do valor no preenchimento automático.

- **Alternativa:** um formulário escrito à mão por documento. Rejeitada em definitivo: a §7.4 prevê que os templates mudem com o tempo, e cada versão nova exigiria código novo em 12 lugares.
- **Evidência no Kit:** os descritores são escritos a partir dos 8 `.docx` já disponíveis. Os tipos de campo observados são texto, número, data, select, caixa de marcação, área de texto, tabela (frequência mensal e carga horária) e grade de linhas (a Ficha de Acompanhamento tem 80 linhas numeradas com data, entrada, saída, duração e rubrica), mais vídeo demonstrativo de avaliação na Proposta de Atuação Pedagógica.
- **Consequência:** os `.doc` legados entram como descritor apenas depois da conversão externa; nada no código depende do formato original.
- **Consequência:** o requisito "Quem pode preencher cada documento" e o de parecer viram metadados do descritor, o que elimina tabelas de permissão paralelas.

### D6. Preview como componente com contrato estável, renderização simulada nesta entrega

`DocumentPreview` desenha a folha do documento em fundo claro, com os tokens de impressão forçados, e recebe o conteúdo já pronto como `children`. O isolamento é entregue por 2.5; quem desenha o conteúdo é o preenchimento dirigido pelo descritor (8.5), na página de impressão dedicada (8.13). A troca por renderização client-side do docx feito com docxtemplater acontece na mudança de backend e não altera a assinatura do componente nem das rotas.

- **Alternativa:** integrar docxtemplater agora. Rejeitada porque anteciparia um requisito de geração que o `proposal.md` tirou do escopo, e porque dois dos doze documentos ainda precisam de conversão externa para existirem como `.docx`.
- **Consequência:** o download de docx/pdf responde pela mesma interface de serviço e, nesta entrega, devolve um arquivo de demonstração. A interface é a definitiva; só a implementação é provisória.

### D7. Máscaras e validação em um único lugar por tipo de campo

Máscaras são funções puras tipadas em `lib/masks` (CPF, RG, celular, telefone, CEP, data) aplicadas como adaptador controlado sobre o React Hook Form, e as regras de validação são `z.refine` reutilizadas na tela de cadastro, no perfil e nos formulários derivados do descritor. Como a §17 exige as mesmas validações no frontend e no backend, os esquemas Zod são escritos uma vez e podrán ser reutilizados no servidor.

- **Alternativa:** biblioteca de máscara pronta. Adiciona dependência para um conjunto pequeno e fixo de máscaras.
- **Alternativa:** máscaras só por `onChange` com regex soltos por campo. Rejeitada porque duplica a regra e erra em colagem de valores.

### D8. Temas por variáveis CSS com `next-themes` e estratégia por classe

A paleta sai de variáveis CSS semânticas já usadas pelo shadcn/ui, com uma rampa de verde em `--primary`. `next-themes` aplica a classe `dark` no `<html>` e entrega as três opções do requisito de preferência (claro, escuro, sistema), com persistência e sem piscada na abertura. A área de preview de documento recebe um escopo de tokens de impressão para ficar sempre em fundo claro com texto escuro; ao imprimir, a interface é ocultada por `.sem-impressao` e a folha sai com a margem de um A4, porque a impressão do sistema é apenas o documento.

- **Alternativa:** só `prefers-color-scheme`. Rejeitada porque não oferece a escolha manual exigida pelo requisito de preferência.
- **Alternativa:** `localStorage` manual. Rejeitada porque perde o acompanhamento do sistema e exige trabalho extra para evitar a piscada.
- **Risco residual:** o valor exato do verde e a tipografia não vieram do IFRJ; ficam em tokens centralizados para troca em um arquivo quando chegarem.

### D9. Rótulos e cores de situação centralizados

Um módulo `lib/domain/status` mapeia cada situação de documento e de estágio para rótulo em português, variante de cor e ícone. O rótulo textual acompanha sempre a cor, atendendo ao requisito de contraste de `interface-visual`.

### D10. Formatação pt-BR sem framework de internacionalização

Datas em dd/mm/aaaa, números e moeda por `Intl` com `pt-BR` e fuso `America/Sao_Paulo`. Sem biblioteca de i18n: o sistema tem um idioma e um campus.

### D11. Testes nos pontos de decisão, não em cada tela

Testes unitários com Vitest para máscaras, esquemas Zod, descritores, rótulos, transições e bloqueios de liberação. Os fluxos ponta a ponta com Playwright cobrem cadastro em duas etapas, solicitação de estágio com os três documentos iniciais, parecer favorável ou desfavorável, envio posterior, conferência das assinaturas, notificação e desbloqueio; também cobrem observações e as tentativas diretas de contornar etapas. O restante das telas é validado por revisão manual com a cliente.

- **Alternativa:** E2E de todos os requisitos. Rejeitada por custo desproporcional a uma entrega de frontend com dados simulados.
- **Alternativa:** só revisão manual. Rejeitada porque parte dos requisitos é regra pura (CPF, máscaras, transições de situação), que é barata de testar e cara de revalidar a cada ajuste visual.

### D12. Decisões de domínio assumidas, a validar com a cliente

Heranças do `Contexto/visaoGeral.md` onde ele é omissivo, escolhendo o comportamento mais conservador:

| Tema | Decisão assumida |
|---|---|
| Instituição do estágio | Selecionada entre convênios ativos; convênio expirado não recebe estágios novos (§11 implica vínculo obrigatório). |
| Horas do estágio | Só podem ser lançadas dentro do período do estágio; múltiplos lançamentos por data são permitidos. |
| Estágio concluído | Não aceita data de fim futura. |
| Criação de estágio | Decidido na exploração: o aluno solicita a criação e informa os dados; o estágio permanece em preparação até a liberação inicial pelo Coordenador de Estágio. |
| Situação do estágio | Decidido na exploração: o aluno não informa nem altera a situação; coordenadores controlam andamento e conclusão, sem contornar a liberação inicial. |
| Documentação inicial | Decidido na exploração: Termo de Compromisso, Formulário de Liberação e Plano de Atividades são obrigatórios e preenchidos automaticamente a partir da solicitação. |
| Parecer inicial e envio | Decidido na exploração: somente o Formulário de Liberação exige parecer entre os três documentos; o pedido do aluno encaminha o formulário e o parecer favorável libera o envio solicitado para assinaturas. |
| Indeferimento inicial | Decidido na exploração: devolve o formulário para correção e nova submissão, preservando o histórico e bloqueando os envios para assinaturas e os demais documentos. |
| Confirmação das assinaturas | Decidido na exploração: o Coordenador de Estágio confirma no site as assinaturas obtidas fora do sistema; o estágio entra em andamento, o aluno é notificado e os demais documentos são liberados. |
| Observações por documento | Decidido na exploração: as duas coordenações podem acrescentar observações com autor e data a qualquer momento, inclusive durante o parecer e a confirmação das assinaturas. |
| Edição inicial e indeferimento | Decidido na implementação: os dados iniciais ficam bloqueados para o aluno; o indeferimento é exceção que permite correção e nova submissão. Dados informados após a liberação são editáveis conforme as regras de cada documento. |
| Perfil e liberação | Decidido na implementação: alterações do perfil atualizam os dados correspondentes do estágio sem novo parecer ou autorização. |
| Cancelamento e exclusão pelo aluno | Decidido na implementação: enquanto aguarda liberação, pode cancelar a solicitação; a exclusão preserva nome e informações históricas do estágio, removendo os dados pessoais do aluno daquele registro, sem excluir seu perfil. |
| Documento em preenchimento | Fica como rascunho; parecer exige submissão explícita. |
| Múltiplos convênios do mesmo aluno | Cada estágio referencia um convênio; nada impede o mesmo aluno estagiar na mesma instituição em períodos distintos. |
| Ficha de Frequência e Avaliação | Aluno não preenche, porque o template só admite RH ou chefe imediato da concedente; o Coordenador de Estágio registra o documento já assinado e lança os valores. |
| Correção de horas | Lançamento é imutável e a correção entra como lançamento de correção, porque a Ficha de Acompanhamento proíbe rasura. |
| Carga horária do estágio | O total realizado vem dos lançamentos após a liberação; a duração prevista do Termo de Compromisso é informada na solicitação e alimenta o documento inicial, sem depender de horas já realizadas. |
| Formulário de Liberação e Plano de Atividades | Decidido com a cliente: viram dois arquivos `.docx` independentes, porque §7.4 exige que sejam templates separados. |
| Genericidade dos templates | Decidido com a cliente: todos os templates são genéricos, inclusive a Proposta de Atuação Pedagógica, cuja menção ao curso Licenciatura em Computação é removida do cabeçalho. |
| Matrícula do cadastro público | Só libera o acesso se já estiver registrada no sistema; matrícula sem registro gera cadastro pendente, como nas §7.4 do `Contexto/visaoGeral.md`. |
| Autorização de cadastro pendente | Autorizar também registra a matrícula como válida, porque é a conferência que o gestor acabou de fazer; não existe segunda etapa de registro. |
| Matrícula fora do registro | O cadastro do aluno pelo administrador registra a matrícula informada quando ela ainda não consta, com origem `cadastro_administrador`, e libera o acesso na mesma operação. A tela de Matrículas continua existindo para registrar antes; a autorização avulsa por checkbox foi descartada. |
| Registro de matrícula sem SIGAA | Enquanto não houver integração, o registro é manual (lançamento por matrícula), com a importação por arquivo mantida como caminho previsto e não entregue nesta fatia. |
| Abrangência do convênio | Decidido com a cliente: o convênio vale apenas para o Campus Pinheiral, então o cadastro não oferece escolha de campus, apesar da cláusula do template mencionar todos os campi do IFRJ. |

### D13. Preparação como situação inicial, pendências derivadas dos documentos

Adicionar `em_preparacao` às situações de estágio, mantendo `em_andamento` e `concluido`. As etapas internas da preparação são apresentadas a partir dos documentos e registros: dados pendentes, aguardando parecer, correção solicitada, aguardando assinaturas e aguardando conferência. Não criar uma situação de estágio para cada pendência documental evita duplicar o estado do parecer e dos envios.

```text
em_preparacao
      |
      v
dados completos + pedido do aluno
      |
      v
parecer no Formulario de Liberacao <---------+
      |                                     |
      +--> indeferido --> correcao e reenvio -+
      |
      +--> aprovado
              |
              v
      envio para assinaturas
              |
              v
      Coordenador de Estagio confirma
      as assinaturas dos tres documentos
              |
              v
em_andamento <--> concluido
             coordenacao
```

- **Alternativa:** inferir andamento pela data de início ou pelo salvamento do cadastro. Rejeitada porque essas informações não comprovam a regularização documental.
- As transições de conclusão e reabertura exigem coordenador com acesso ao estágio e registro de autoria. A edição genérica não aceita uma situação inicial escolhida pelo aluno nem substitui a conferência.
- Listas e filtros incluem a preparação; os indicadores existentes de andamento e conclusão não contam solicitações ainda não liberadas nessas situações.

### D14. Solicitação reúne dados e gera três documentos obrigatórios

O formulário inicial coleta os dados faltantes exigidos pelos descritores dos três documentos e reutiliza os dados do aluno e dos cadastros de convênio, supervisor e orientador. Ao salvar os dados necessários, o serviço prepara os três registros de documento para a mesma solicitação, mantendo identidade e versão de template próprias. Reabrir a solicitação reutiliza os registros ativos, sem duplicá-los.

- Os três templates são vinculados automaticamente e não podem ser removidos pela seleção opcional. A seleção dos demais documentos fica disponível após a liberação.
- O aluno não edita os dados iniciais após concluir a solicitação, salvo para corrigir um indeferimento. Durante a espera pode cancelar a solicitação. A edição de dados do perfil é independente e não reinicia a autorização; a edição de dados registrados depois da liberação respeita as regras dos documentos e dos lançamentos de horas.
- Os dados compartilhados alimentam os três preenchimentos; campos específicos continuam definidos pelos respectivos descritores. A duração prevista do Termo é coletada antes do início e não é calculada a partir de lançamentos ainda inexistentes.
- **Alternativa:** manter três formulários independentes como ponto de entrada. Rejeitada porque obriga o aluno a selecionar os documentos iniciais e repetir dados que a solicitação já conhece.

### D15. Parecer, envio e conferência são registros distintos

O pedido de encaminhamento do aluno registra a intenção de envio e submete o Formulário de Liberação à fila do Coordenador de Curso. O Termo de Compromisso e o Plano de Atividades têm parecer `nenhum`; seus assinantes continuam descritos nos metadados de assinatura. Os pareceres dos demais documentos do Kit permanecem conforme a matriz existente.

O parecer favorável executa o envio solicitado aos respectivos assinantes pela interface de serviço de e-mail, simulada nesta entrega. O histórico de envio preserva sucessos, falhas, destinatários e tentativas. Um envio não comprova assinatura. O indeferimento permite reabrir o formulário e submetê-lo novamente, preservando pareceres e observações e mantendo os bloqueios até nova aprovação. Nos demais documentos sujeitos a parecer, mantém-se o padrão anterior de reabertura e reenvio após indeferimento.

A conferência registra, para cada documento inicial, a confirmação pelo Coordenador de Estágio e a data. A mutação de liberação exige parecer favorável no formulário e a conferência completa dos três documentos; então altera a situação, libera os demais documentos daquele estágio e notifica o aluno. A confirmação no site é o registro da conferência das assinaturas físicas.

A data de assinatura a constar no documento é preenchida fora do sistema. Em particular, `termoCompromissoData`, no Termo Aditivo, é um trecho fixo com espaço em branco, sem input ou obrigatoriedade de preenchimento na aplicação. A conferência não solicita esse valor; sua data de registro continua sendo somente a data da ação no site. Os previews e arquivos de demonstração preservam os trechos fixos e os espaços de preenchimento externo.

- **Alternativa:** marcar o estágio como válido quando o e-mail é enviado ou quando o formulário é aprovado. Rejeitada porque ambos antecedem a confirmação das assinaturas.
- Todos os pontos de entrada que criam, salvam ou selecionam documentos adicionais e registram horas verificam a liberação no serviço, além de apresentar o bloqueio na interface. O acesso ao catálogo e aos PDFs fixos não depende dessa liberação.
- A mesma regra vale para requisições diretas, sem permitir que a edição genérica de situação, outro estágio liberado ou um perfil que apenas consulta a área contorne a conferência.

### D16. Observações como histórico por documento, independente das decisões

Representar cada acréscimo de observação com documento, conteúdo, autor e data. As ações de parecer e de conferência permitem incluir observações no documento correspondente, e a ação independente de acrescentar observação usa o mesmo histórico. Uma observação nova preserva as anteriores e não dispara transição de parecer, assinatura ou estágio.

- O Coordenador de Curso escreve em documentos de alunos de seu curso; o Coordenador de Estágio escreve em documentos do campus. A autorização de escrita exige um desses papéis e acesso ao documento, sem derivá-la apenas da permissão genérica de preencher ou consultar.
- O histórico pode receber observações fora das ações principais, inclusive em documentos sem parecer e em estágios concluídos. Isso não reabre o preenchimento do documento.
- **Alternativa:** um único campo livre sobrescrito pelas duas coordenações, ou usar somente `consideracoes` do parecer. Rejeitada porque perde autoria dos acréscimos e não atende documentos sem parecer ou comentários feitos depois da decisão.

## Risks / Trade-offs

- **Autenticação ainda simulada** → layouts resolvem o cookie e aplicam as guardas; Server Actions e serviços verificam o vínculo do registro ao usuário, curso ou campus. As páginas de servidor consultam serviços e entregam às telas somente os dados autorizados; nenhuma tela importa fixtures diretamente. Better Auth e persistência serão integrados na mudança de backend.
- **As fixtures podem divergir do modelo real** → os tipos de serviço são o contrato; o `schema.prisma` futuro é gerado a partir deles, e as fixtures entram na revisão da cliente para validar volume e variety antes do backend.
- **Formulário genérico é menos refinado que um formulário por documento** → os tipos de campo cobrem os padrões dos documentos do Kit (texto, número, data, select, caixa de marcação, área de texto); os descritores ficam em uma pasta só e são lidos com a cliente documento a documento.
- **O seletor de papel e a sessão simulada são uma brecha se vazarem para produção** → ficam atrás de flag de ambiente e o `README` registra que devem ser removidos antes da entrega final; o teste E2E depende deles, então a remoção é um passo explícito da lista de tarefas.
- **O preview simulado pode não refletir a paginação final do docx** → o componente é o contrato estável; a substituição interna não muda rotas, serviços nem testes.
- **Entrega grande demais (86 requisitos, 9 capabilities) para uma única passagem de revisão** → as tarefas são fatiadas por capability, com marco demonstrável ao fim do fluxo do aluno e revisão parcial antes das áreas de coordenação e administração.
- **Tokens de cor provisórios podem vazar para produção** → a rampa de verde fica isolada em um arquivo de tokens, com a troca por valor oficial como tarefa única.
- **Dois documentos do Kit estão em `.doc` legado** → a conversão para `.docx` fica fora do sistema, conforme §7.4, e entra como tarefa antes do cadastro dos templates; até lá, esses dois descritores são cadastrados sem arquivo anexado, com o campo de download sinalizado como pendente.
- **Bloqueio aplicado somente à seleção visual** → centralizar a verificação de liberação nos serviços e testar abertura direta, salvamento, seleção, envio antecipado e lançamento de horas.
- **Confusão entre parecer favorável e assinatura obtida** → manter os registros distintos e liberar apenas após a conferência do Coordenador de Estágio.
- **Fixtures e testes do fluxo antigo continuam passando** → revisar a matriz de parecer do Termo, representar estágios em preparação e reabrir as tarefas cujos critérios foram substituídos; as evidências anteriores permanecem identificadas como históricas.
- **Os templates do Kit contêm conteúdo que não deve chegar ao documento final** (o lorem ipsum e as instruções de preenchimento da Proposta de Atuação Pedagógica, o rótulo "Relatório Semestral de Estágio 2019" no nome do arquivo e o curso "Licenciatura em Computação" no cabeçalho) → o descritor marca cada trecho do template como `campo`, `fixo` ou `instrucao`, e a remoção de instruções é responsabilidade do gerador futuro, não do formulário.

## Migration Plan

Não há sistema em produção, então "migração" aqui é a sequência de entrega:

1. `git init`, `.gitignore` e primeiro commit de `Contexto/` e `openspec/` antes de qualquer scaffold, para que a evolução da especificação fique versionada junto do código.
2. `create-next-app` (App Router, TypeScript, Tailwind) e `init` do shadcn/ui, commitando o baseline.
3. Preparar o Kit fora do sistema antes de cadastrar os templates: converter os dois arquivos `.doc` para `.docx`, separar o Formulário de Liberação e o Plano de Atividades em dois arquivos, remover do template da Proposta de Atuação Pedagógica a menção ao curso, e então registrar os 12 descritores de campo a partir dos arquivos resultantes.
4. Ordem de fatias: tokens e temas → shell de navegação e guarda de papel → fluxo do aluno (cadastro, perfil, estágios, documentos, pareceres) → coordenação → administração → estatísticas. Cada fatia é revisável com a cliente e mergeável isoladamente.
5. Publicar cada fatia como Preview da Vercel para a validação das telas. Não há variáveis de ambiente com segredo nesta entrega, porque não há servidor nem banco.
6. Rollback é republicar o Preview anterior: como os dados são fixtures em memória, não há migração de dados nem risco de perder informação. Se algum dia houver URL pública, cada papel acessa pelo seu próprio login.
7. Antes de abrir a mudança de backend, congelar os tipos de `lib/services` e o descritor de campo como contrato, para que Prisma e Better Auth implementem o que a tela já consome.

Adequação da interface já implementada ao fluxo redefinido:

1. Atualizar os contratos com preparação, conferência de assinaturas, pedido de encaminhamento e observações; revisar a matriz para que o Termo não exija parecer.
2. Atualizar fixtures com solicitações em preparação e com estágios liberados cuja documentação inicial e conferência sejam coerentes. A situação antiga de andamento, isoladamente, não é evidência de assinatura conferida.
3. Adaptar a entrada de dados e a preparação automática dos três documentos, o pedido do aluno e a correção após indeferimento.
4. Conectar aprovação ao envio solicitado e implementar a conferência, a liberação e a notificação, com os bloqueios de serviço e de interface.
5. Acrescentar o histórico de observações nas ações principais e na ação independente; revalidar os fluxos e o preview com a cliente.
6. Fazer rollback da demonstração republicando o preview anterior e restaurando fixtures compatíveis; uma eventual migração de estágios reais exige conferência dos documentos e não pode presumir assinaturas a partir da situação legada.

## Open Questions

Itens que não mudam a abordagem nem as specs e podem ser respondidos depois:

- **Valor oficial do verde, tipografia e ícone do navegador do IFRJ** → tokens centralizados; troca em um arquivo. A marca oficial já chegou (`Assets/selic-logo.svg`) e é a mesma nos dois temas, então o que falta é derivar dela o ícone do navegador. Enquanto isso, os requisitos de identidade visual e de contraste seguem atendidos com a rampa provisória e com o ícone provisório.
- **Se um mesmo usuário pode acumular papéis** (por exemplo, coordenador de estágio e de curso) → o modelo já é um conjunto de papéis, então a resposta afirmativa é aditiva e não altera requisito.
- **Se o sistema deve ter página pública institucional** → nenhuma spec cobre isso; adicionar é uma capability nova, sem impacto no que foi entregue.
- **Nível de acessibilidade a declarar (ex.: WCAG AA)** → os requisitos já pedem teclado, foco visível e contraste; declarar o nível é um registro, não uma mudança de código.
- **Se o Relatório Semestral continua vigente** → o corpo do arquivo está datado de 2026, apesar do nome indicar 2019, então o texto do documento é que manda; é um dado do descritor, ajustável sem tocar em código.
