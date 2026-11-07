## Context

Ver `proposal.md` para a motivação e `specs/` para os contratos observáveis. Esta mudança é transversal, altera o modelo de dados e introduz autenticação persistente; portanto, exige design técnico.

O estado atual relevante é:

- `prisma/schema.prisma` possui somente `Usuario` e `MatriculaImportada`. Papéis e dados pessoais são JSON; vínculos acadêmicos não têm FKs.
- `src/lib/db/persistencia.ts` hidrata arrays globais, tem TTL e recuperação e insere fixtures quando encontra tabelas vazias. Sua gravação de usuário atualiza por ID antes de tentar criar.
- `src/lib/services/store.ts` mantém o restante do domínio em memória e gera IDs por contador local. Cadastros públicos usam mapas locais para prévias e credenciais; solicitações de acesso também são locais.
- O cookie `selic-sessao` contém diretamente o ID do usuário. `sessao-servidor.ts`, serviços simulados e contexto de cliente coexistem; nenhum deles equivale a uma sessão persistente validada.
- `types.ts` e os serviços já representam estados de preparação, parecer, assinaturas conferidas e liberação que são mais detalhados que os diagramas acadêmicos. Templates enviados guardam conteúdo base64 na memória. Envios externos hoje podem ser marcados como enviados apenas pela existência de e-mail.
- A aplicação usa Next.js 16.3.8, Prisma 7.10 e adapter MariaDB/MySQL, com backend integrado na Vercel. Better Auth e Nodemailer ainda não são dependências instaladas.
- Na leitura atual da change `corrigir-hidratacao-e-carregamento-banco`, a tarefa 6.1 foi concluída com evidência de Production e egress dinâmico permitido pelo Aiven. A tarefa 6.2 continua parcialmente verificada, sobretudo para recuperação no mesmo processo e consistência entre instâncias. Esses fatos substituem o diagnóstico operacional anterior, sem considerar o restante automaticamente concluído.

Esta revisão adota as decisões confirmadas: um cargo por usuário, cadastro sem prévia persistida, fluxos padrão do Better Auth, Kit de Estágio fixo e adiamento de notificações gerais e histórico genérico de alterações.

Foram consultados os guias locais de autenticação, Server Actions e cache em `node_modules/next/dist/docs/01-app/02-guides/`, a documentação oficial de banco, e-mail/senha, Prisma e integração Next.js do Better Auth e seu código atual de signup, reset e adapter Prisma. Essa evidência confirma o caminho técnico proposto, mas não substitui testes na versão que será fixada: o projeto ainda não possui a dependência instalada.

## Goals / Non-Goals

**Goals:**

- Manter as telas consumindo contratos de domínio, com persistência e autorização nos serviços de servidor.
- Remover a dependência do processo que atendeu a requisição para identidade, credenciais, pendências e arquivos recebidos; formulários incompletos permanecem somente na memória do navegador.
- Aplicar invariantes no MySQL e transações por operação de negócio, não por chamada isolada de gravação.
- Permitir entregas verificáveis por bloco sem combinar dados reais com fixtures no mesmo domínio em operação.
- Preservar registros existentes e tornar as decisões de migração, implantação e recuperação executáveis.

**Non-Goals:**

- Criar servidor independente, Redis, microsserviços ou sincronização entre caches de processo.
- Converter herança UML literalmente em uma tabela para cada cargo ou gerar SQL automaticamente a partir dos diagramas.
- Redesenhar a interface, remover aprovação de cadastro ou alterar o fluxo atual de liberação de estágio.
- Criar tabela de prévia, associação de vários cargos, mecanismo próprio de redefinição de senha, fila própria de e-mails de autenticação, editor/publicação administrativa de templates, notificações gerais ou trilha genérica de toda alteração.
- Implementar geração DOCX/PDF, preview real desses formatos, envio de anexos ou integração oficial com SIGAA nesta entrega. O estado persistido deve permitir a integração posterior sem simular o sucesso dessas operações.

## Decisions

### 1. Serviços assíncronos com repositórios de persistência

Manter `src/lib/services/` como fronteira dos casos de uso. Separar consultas, mapeadores e operações de banco em módulos `server-only` sob `src/lib/db/`; os serviços coordenam autorização, validação e transações. Não introduzir um repositório genérico ou uma camada HTTP interna entre Server Components e serviços.

```text
Server Components / Server Actions / Route Handlers
                        |
                        v
          Servicos: autorizacao + caso de uso
                        |
                        v
         Repositorios + mapeadores + transacoes
                        |
                        v
             Prisma 7 --> MySQL/Aiven
```

- Preservar DTOs serializáveis, datas de domínio e `Pagina<T>`; funções hoje síncronas que consultam estado passam a assíncronas, com adequação explícita dos consumidores.
- Repositórios recebem `PrismaClient` ou `TransactionClient`; dentro de uma transação nenhum serviço subordinado usa o cliente global por fora dela.
- Cliente e pool podem ser reutilizados por processo. Dados de negócio, listas, senhas e autorizações não podem ser armazenados em globais reutilizadas entre requisições.
- Modo sem banco mantém um adapter de simulação separado, explicitamente identificado. A seleção é feita no ponto de composição: banco configurado sempre seleciona persistência; falha não troca de adapter. Testes de integração selecionam persistência explicitamente, sem a guarda atual que desativa banco indiscriminadamente sob `NODE_ENV=test`.
- Os blocos são incrementais de desenvolvimento e validação. A implantação pública da nova arquitetura ocorre após todos os serviços envolvidos estarem integrados; não publicar um bloco com leituras de domínio ainda direcionadas ao simulador como se fossem persistentes.

**Alternativas:** prolongar a ponte por hidratação mantém os problemas de snapshots e escrita parcial; reescrever as telas acoplando-as ao Prisma aumenta a mudança e expõe detalhes de armazenamento. Ambas foram rejeitadas.

### 2. Modelo relacional com JSON restrito a conteúdo variável

Preservar a tabela física `usuarios` e os IDs existentes. Usar `Usuario` também como modelo de usuário do Better Auth por mapeamento de nomes; não criar uma segunda identidade independente para a mesma pessoa. Adicionar os campos essenciais de autenticação, incluindo verificação de e-mail, imagem opcional e atualização. Mapear `name` para `nome` e `createdAt` para `criadoEm` na configuração de autenticação.

Para o signup padrão conseguir inserir a identidade antes de completar o domínio na mesma transação, definir valores iniciais seguros para campos obrigatórios que o provedor não preenche: cargo aluno, situação pendente e Campus Pinheiral. Matrícula e vínculos ainda não definidos são nulos até a conclusão transacional. Esses valores não autorizam acesso nem aceitam cargo/situação fornecidos pelo cliente; a transação precisa completar os dados e decidir ativo/pendente antes do commit. Atribuições administrativas são explícitas no caso de uso autorizado.

Modelo-alvo lógico, a traduzir em migrações sem sobrescrever a migração inicial:

| Grupo | Modelos e relações principais |
| --- | --- |
| Identidade | `Usuario` com campo obrigatório `papel` de valor único; `DadosPessoaisAluno` 0..1 por usuário; curso do coordenador em `Usuario.cursoId`; membro da comissão como condição exclusiva do coordenador de estágio |
| Autenticação | `AuthAccount`, `AuthSession`, `AuthVerification`, conforme schema exigido pela versão fixada de Better Auth; conta de credencial vinculada ao mesmo `Usuario.id` |
| Acadêmico | `Curso`, `Turma`, `Periodo`, `TurmaPeriodo`; `DadosPessoaisAluno` contém FKs para curso, turma e período, contatos e endereço |
| Acesso | `MatriculaImportada` preservada em `matriculas`; `SolicitacaoAcesso` com usuário único, curso da solicitação, situação, motivo, decisão, responsável e datas; `ImportacaoMatriculas` e `ItemImportacaoMatricula` para resultados de lotes consultáveis |
| Institucional | `InstituicaoConcedente`, `ResponsavelInstituicao`, `Convenio` vinculado à instituição, `RenovacaoConvenio` para renovações do domínio; `Pessoa` e seu papel de orientador/supervisor, preservando o contrato atual de seleção |
| Estágio | `Estagio` com aluno, convênio, pessoas, datas, situação e campos de responsável/data de encaminhamento, liberação, cancelamento e exclusão; `EstagioTemplate` para seleção de documentos do catálogo fixo |
| Documental | `DocumentoPreenchido` com identificador da definição fixa, checksum e snapshot do descritor utilizado, vínculos, valores e situação; `Arquivo` para anexos/documentos recebidos. Catálogo e arquivos oficiais são mantidos no repositório, sem tabelas de publicação de templates |
| Acompanhamento | `LancamentoHoras` imutável, correções vinculadas ao original e sequência de correção; `SubmissaoDocumento`, `Parecer`, `ObservacaoDocumento`, `SolicitacaoExclusaoEstagio` com solicitante e decisor |
| Comunicação documental | `PedidoEnvioDocumento` e `EnvioExterno` para pedidos e tentativas documentais. E-mails de senha usam o callback de transporte da autenticação, sem tabela própria de mensagens |

São 29 modelos lógicos nomeados nesta revisão, incluindo os três auxiliares antes sem nome definitivo (lote, item de importação e renovação). Não entram no modelo-alvo `UsuarioPapel`, `PreviaCadastro`, `RedefinicaoSenha`, `MensagemEmail`, `Notificacao`, `EventoEstagio`, `TemplateDocumento` ou `VersaoTemplate`.

Escolhas de representação:

- Cada usuário tem exatamente um `papel`, com valor entre aluno, coordenador de curso, coordenador de estágio e administrador. Adequar `Usuario`, DTOs, formulários, guardas e serviços para valor escalar; não manter uma lista de um elemento como contrato definitivo. Alteração de cargo remove condições incompatíveis, inclusive membro da comissão fora da coordenação de estágio. A função externa de `Pessoa` não é outro cargo de usuário nem cria login.
- Matrícula canônica fica em `Usuario.matricula`, opcional e única. Uma matrícula registrada para autorizar cadastro continua independente de uma conta. `MatriculaImportada.curso` mantém o texto recebido, com associação acadêmica apenas quando houver correspondência válida.
- Dados pessoais deixam de ser o local de armazenamento de referências acadêmicas em JSON. Contatos e dados pessoais têm campos explícitos; endereço pode continuar como objeto JSON validado. E-mail e nome canônicos vêm de `Usuario`, sem outra fonte editável concorrente.
- Valores de formulários e snapshot da definição fixa utilizada continuam em JSON, validados no servidor. Relações, situações, atores, datas e campos usados em recortes têm colunas próprias. O snapshot identifica a definição do preenchimento; não é um editor nem uma tabela de versões administráveis.
- `SolicitacaoAcesso` referencia a conta, sem depender de localizar usuário pelo e-mail, que pode ser alterado. A listagem monta seu DTO a partir de relações; não manter cópia integral desnecessária dos dados pessoais na solicitação.
- `DocumentoPreenchido` e `EstagioTemplate` usam chaves do manifesto fixo do Kit. Validar a chave contra o manifesto ao criar vínculos; os demais vínculos de entidades persistidas usam FKs. Documento salvo guarda checksum e snapshot da definição para reabrir com os mesmos campos, sem buscar a versão mais recente. Mudança futura do acervo é atualização do desenvolvedor com compatibilidade explícita, não publicação administrativa.
- Datas civis usam `DATE`; instantes de evento usam UTC com precisão de milissegundos. Durações são armazenadas como minutos inteiros e convertidas para horas no DTO. Preservar a regra atual de cálculo e arredondamento; não somar ponto flutuante no banco.
- FKs de histórico usam `RESTRICT` por padrão. Cascata é limitada a dependentes técnicos descartáveis, como sessões e vínculos de autenticação de uma conta efetivamente removível. Ações de exclusão do domínio são explícitas e transacionais.
- Índices cobrem usuário por e-mail/matrícula/papel/situação/curso, filas por situação/curso/data/ID, estágio por aluno/situação/período e vínculos institucionais, documentos por estágio/definição/situação e horas por estágio/data.

**Alternativas:** armazenar todo o estado em um único JSON facilitaria o transporte mas impediria garantias relacionais, filtros e concorrência adequada. Normalizar cada campo de documento em linhas próprias aumentaria complexidade sem benefício para formulários variáveis. O modelo híbrido concentra relações e invariantes em colunas.

### 3. IDs globais, criação explícita e garantias finais no banco

Usar UUIDs gerados criptograficamente para novos registros de todos os domínios e configurar geração compatível no Better Auth. Colunas de ID continuam strings compatíveis com os IDs legados; não renumerar contas existentes.

- Criação usa `create`, nunca o padrão `updateMany` seguido de `create` nem `upsert` por ID para cadastros públicos/administrativos.
- Edição é uma operação distinta com autorização e alvo existente. Conflito de ID não autoriza atualizar o registro encontrado.
- Normalizar e-mail por `trim().toLowerCase()` em todas as entradas, incluindo autenticação e edição. Inspecionar colisões antes de normalizar registros existentes. Não remover pontos, sufixos ou outros componentes do e-mail.
- Matrícula fica aparada e validada pelo contrato atual de onze dígitos. Ausência real é `NULL`, nunca string vazia para contornar unicidade. O exemplo antigo de dez dígitos na spec de frontend não muda a validação vigente nem autoriza truncar registros na migração.
- Manter índices únicos para e-mail e matrícula opcional em `usuarios`; MySQL permite múltiplos `NULL`. `AuthAccount` tem unicidade de provedor/identidade e um vínculo de credencial por usuário. Schema, tokens e expirações de autenticação seguem o contrato do Better Auth, sem tabelas paralelas do domínio.
- Traduzir conflito Prisma/MySQL para erro de negócio por campo; registro não encontrado, validação e indisponibilidade possuem tratamentos separados. O wrapper atual que converte toda exceção em `BancoIndisponivelError` não será reaproveitado para conflitos.

**Alternativas:** reservas em `Map` ou mutex local só coordenam um processo; consulta antes da escrita sem índice único permite corrida. Permanecem úteis apenas como validação antecipada, nunca como garantia final.

### 4. Fluxos padrão do Better Auth com uma identidade de usuário

Fixar versões compatíveis de `better-auth` e adapter Prisma, preservando Prisma 7 e provider MySQL. Gerar o schema de autenticação em ambiente de desenvolvimento e revisar o resultado; somente migrações Prisma versionadas alteram os ambientes. Ativar suporte transacional do adapter (`transaction: true`) e testar com o driver utilizado.

Login, cookies, sessões e logout são do Better Auth. Montar a integração Next.js em `/api/auth/[...all]`, em runtime Node.js, com propagação de cookies por Route Handler ou plugin `nextCookies` quando chamado de Server Action. Não emitir cookies a partir de Server Components.

Usar os métodos padrão `signUpEmail`, `signInEmail`, `signOut`, `changePassword`, `requestPasswordReset` e `resetPassword`. A biblioteca controla hashing, schema de credencial, sessão, geração/validação/consumo de tokens e expiração. Não criar/resetar hashes de senha por escrita direta em `AuthAccount`, não reimplementar esses endpoints e não manter os módulos simulados de credencial/reset como caminho real.

O cadastro ainda precisa obedecer às regras do SELic. O handler público de autenticação não expõe signup irrestrito: somente a ação de conclusão do formulário completo chama o método padrão de signup no servidor, com os dados autorizados. Desativar auto-login de signup e envio de verificação de e-mail nessa operação; a aprovação de matrícula não é verificação de e-mail, e não será introduzida uma segunda confirmação obrigatória.

A atomicidade com o domínio usa composição do adapter, não um signup próprio: dentro de uma transação Prisma externa, construir uma instância de autenticação restrita ao cadastro, com o adapter apontando ao `TransactionClient` recebido e transações internas desativadas. Chamar `signUpEmail` diretamente em processo, sem HTTP; gravar dados pessoais, matrícula/cargo/situação e solicitação com o mesmo cliente antes do commit. A instância pública normal usa o cliente principal e `transaction: true`. Nunca trocar o cliente de uma instância global durante uma requisição.

O adapter Prisma consultado aceita um cliente fornecido e só abre `$transaction` quando configurado para isso. O caminho proposto exige um teste de integração inicial com a versão fixada, demonstrando rollback também de usuário e credencial quando a gravação do domínio falha. Não presumir que duas chamadas independentes ou um hook `after` compartilhem a transação: hooks posteriores podem executar após commit. A instância restrita não possui hooks de efeitos externos ou emissão de cookies.

Com `autoSignIn: false`, o signup padrão pode retornar uma resposta sintética para e-mail existente. O serviço consulta conflitos antes e confirma pelo ID retornado que uma nova identidade e sua credencial foram realmente criadas no cliente transacional antes de anexar dados de domínio. Resposta genérica não autoriza vincular perfil ou matrícula a uma conta preexistente. Falha ou resultado sintético provoca rollback e erro de cadastro; o índice único fecha a corrida restante.

Política de sessão:

- Sessões no MySQL, sem armazenamento secundário nem cookie cache de usuário/autorização. Validade inicial de oito horas, coerente com o cookie atual; renovação nunca torna uma sessão já revogada válida.
- `usuarioDaRequisicao()` valida a sessão e consulta conta, situação, cargo único e curso atuais. Checar situação antes da criação de sessão pelo hook de sessão da biblioteca; pendentes e inativos não recebem sessão. Mensagem de aguardo deve depender da conferência válida das credenciais, sem divulgar situação por consulta pública de e-mail.
- Inativação, exclusão de conta e redefinição de senha revogam sessões persistidas. Alteração de papel/curso é observada na próxima requisição porque não vem de claims antigos no cliente.
- A migração invalida o cookie antigo; ninguém é autenticado somente pelo valor de `selic-sessao` após o corte. Exigir novo login é uma consequência técnica da substituição, não migração de sessão insegura.
- Cargo, matrícula, situação e vínculos são controlados pelo servidor e não são campos livremente aceitos dos endpoints genéricos. Em signup público, o servidor força cargo aluno. Bloquear rotas genéricas de alteração que contornem o perfil e a política de e-mail; os endpoints padrão de senha permanecem disponíveis com as verificações da biblioteca.
- Preservar autorização por ação: a checagem genérica de administrador não substitui a exigência específica de coordenador de estágio em `confirmarAssinaturas`, já presente no fluxo atual. Consultas do campus e operações administrativas continuam seguindo suas permissões próprias.

**Alternativas:** manter cookie de ID não permite validação/revogação; identidade Better Auth separada duplica conta/e-mail; signup em transação independente seguido do perfil pode deixar conta órfã. Escrever credenciais manualmente ou desenvolver reset próprio contrariaria a simplificação aprovada. Escolheu-se usar a biblioteca e compor o signup padrão com a transação de domínio.

### 5. Duas etapas visuais, sem prévia persistida

Manter o formulário como um único estado React com duas etapas. A primeira valida formato, senha/confirmação e consulta disponibilidade de matrícula/e-mail no servidor; a consulta não persiste senha, hash, token, conta ou solicitação e não reserva dados. A resposta não contém identificador de prévia. Dados digitados ficam apenas na memória do formulário, não em URL, cookie, localStorage ou sessionStorage.

Ao concluir a segunda etapa:

1. Enviar matrícula, e-mail, senha, confirmação e todos os dados pessoais na mesma requisição HTTPS. Validar tudo no servidor, inclusive quando a primeira consulta foi omitida ou o cliente alterou os dados depois dela.
2. Na transação de cadastro, revalidar unicidade e opções acadêmicas e consultar se a matrícula está atualmente registrada. O resultado inicial da consulta não determina a situação final.
3. Chamar o signup padrão pelo adapter transacional da decisão anterior; completar cargo aluno, matrícula, situação, dados pessoais e, se necessária, `SolicitacaoAcesso` pendente com o mesmo cliente.
4. Confirmar tudo conjuntamente e responder o resultado. Não criar sessão de signup; conta ativa pode entrar pelo login padrão e conta pendente recebe a orientação de aguardo.
5. Em falha de validação ou gravação, manter o formulário aberto enquanto a página permanecer montada. Em reenvio após sucesso, unicidade de e-mail/matrícula impede outra conta e preserva a credencial e a solicitação existentes.

Recarregar ou fechar a página descarta o preenchimento e exige recomeçar. Reiniciar apenas o servidor não descarta os dados ainda na memória do navegador; uma nova requisição completa pode concluir em outra instância, observadas as referências de Server Action do deployment. Nunca tratar a inexistência de prévia como erro, porque a arquitetura não possui prévias. Não há rotina de limpeza ou reserva de matrícula para cadastro abandonado.

**Alternativas:** `Map` depende da instância; tabela ou token de prévia adiciona expiração, consumo e limpeza; conta criada na primeira etapa gera identidades incompletas. Perder o preenchimento ao recarregar é a contrapartida aceita para eliminar essa infraestrutura.

### 6. Senhas e entrega SMTP pelos fluxos padrão

Configurar recuperação por e-mail no Better Auth com `sendResetPassword` usando Nodemailer, expiração inicial de sessenta minutos, `revokeSessionsOnPasswordReset: true`, verificações no banco e sem armazenamento secundário. Usar os endpoints padrão para pedido, resgate e troca autenticada de senha. Senha e confirmação são validadas na interface/ação; consumo e alteração de credencial ficam com a biblioteca e o adapter transacional.

- O callback recebe o link emitido pela biblioteca e envia pela configuração SMTP do ambiente. A origem canônica e os redirecionamentos permitidos são configurados, não derivados de host arbitrário. Não registrar senha ou token em logs, não devolver o link em resposta pública e não manter uma segunda tabela de tokens.
- Usar `after()`/integração de background suportada pela biblioteca e pela Vercel para executar o callback sem revelar existência de conta pelo resultado público do SMTP. Aguardar o transporte dentro do trabalho registrado e capturar falhas com logs redigidos; não disparar uma Promise sem vínculo ao ciclo de vida da plataforma. A integração preserva a resposta genérica para e-mail existente ou ausente.
- Não criar `MensagemEmail`, outbox, payload SMTP cifrado, comando de reprocessamento ou chave de criptografia para mensagens. Uma falha é diagnosticada e o titular pode solicitar novamente pelo fluxo padrão, respeitando seus limites. A confirmação pública é de solicitação, não comprovação de entrega; aceitação SMTP não é confirmação de leitura.
- Contas criadas pela administração e contas legadas sem credencial usam o mesmo pedido/reset para estabelecer a primeira senha. O código atual consultado da biblioteca cria a credencial quando ela ainda não existe; testar essa capacidade na versão fixada. Não atribuir senha temporária de demonstração nem ativar conta pendente ao estabelecer senha.
- O adapter normal usa transações para consumo de token, alteração/criação da credencial e revogação de sessões. Testar falha de escrita e resgates simultâneos com MySQL; não considerar a transação habilitada somente porque o banco suporta transações. Na versão fixada, o `delete` do adapter Prisma pode devolver o registro mesmo com zero linhas afetadas quando duas transações concorrentes apagam a mesma verificação; o reset usa isolamento `Serializable` para que o segundo resgate falhe por conflito de serialização, tratado como tentativa rejeitada e nunca como sucesso.
- Alteração de e-mail passa pelo fluxo padrão de mudança de e-mail com confirmação do titular e sem exposição de conflitos da outra conta. Dados de perfil não alteram o e-mail por escrita direta: a identidade canônica atualiza contatos apresentados no DTO. Não reimplementar consumo/invalidação de token para adicionar políticas diferentes das oferecidas pelo provedor.

Os únicos ajustes próprios são configuração do transporte, integração da interface e regras de acesso do domínio. O antigo `senhas.ts` passa a delegar ao provedor; não mantém seu mapa nem outro endpoint de reset com regras divergentes.

**Alternativas:** tokens próprios e fila durável de e-mails acrescentam schema, reprocessamento e manutenção sem necessidade para a entrega aprovada. Em contrapartida, esta entrega não garante reenvio automático após interrupção do processo; o titular pode pedir um novo link.

### 7. Transações curtas e coordenação de concorrência no MySQL

Usar InnoDB, índices únicos, FKs e transações interativas curtas. As leituras de validação que decidem mutações são refeitas dentro da transação. Signup padrão executa seu hash dentro da transação externa, antes de escrever a identidade; medir esse custo e ajustar o timeout com margem, sem implementar hash alternativo para movê-lo. Evitar bloqueios de agregados antes dessa etapa e manter SMTP e transferência de arquivo fora das transações de negócio.

| Operação | Unidade atômica e coordenação |
| --- | --- |
| Cadastro público | Signup padrão no cliente transacional + cargo aluno/matrícula/situação + dados pessoais + solicitação quando exigida; unicidade fecha corridas entre formulários independentes |
| Cadastro administrativo | Matrícula eventualmente criada + usuário compatível com o modelo do provedor + cargo/dados; pedido padrão de estabelecimento de senha ocorre depois do commit e sua falha de entrega não desfaz a conta |
| Aprovação/recusa | Bloqueio da solicitação pendente + revalidação do autor + decisão condicional + matrícula quando exigida + situação da conta; não criar outro usuário nem exigir notificação |
| Criação de estágio | Bloqueio do aluno para verificar sobreposição de períodos + estágio + seleção obrigatória + três documentos; validar opções ativas dentro da transação |
| Encaminhamento/parecer | Bloqueio do estágio/documento, identificação da submissão vigente + transição + parecer e pedido de envio quando aplicável |
| Conferência/liberação | Bloqueio do estágio e documentos iniciais + parecer vigente + três conferências + observações + situação e responsável/data da liberação |
| Horas/correções | Bloqueio do estágio + leitura dos lançamentos efetivos + validação diária/semanal + acréscimo imutável com sequência; serializar também mudanças de situação do estágio |
| Exclusão | Solicitação/decisão e efeito de exclusão + inativação documental + limpeza de dados pessoais e responsável/data; revogação de acesso quando conta excluída |

Bloqueios de linha usam consultas parametrizadas e ordem consistente: conta/aluno, solicitação ou estágio, documentos em ordem de ID e dependentes. Revalidar status e contagem afetada; um mutex JavaScript não é garantia distribuída. Repetir apenas transações abortadas explicitamente por deadlock/conflito de serialização, com limite curto; nunca repetir automaticamente uma operação cujo commit ficou incerto por perda de conexão. Para cadastro com resultado incerto, orientar login ou recuperação de acesso; reenvio não pode sobrescrever conta e a unicidade impede duplicação. Outros comandos validam a situação atual antes de repetir efeitos.

Para correções de horas, `corrigeId` aponta sempre ao lançamento original; a sequência por original é atribuída sob o bloqueio do estágio. Somar somente a última versão efetiva de cada original, não original mais correções. Não alterar o significado da semana ou a regra de arredondamento de `chaveSemana`/cálculo atual nesta migração.

**Alternativas:** transação por registro não protege a operação de negócio; isolamento sem bloqueio do agregado permite duas leituras aprovarem o mesmo limite. Bloquear a tabela inteira reduziria concorrência de alunos independentes.

### 8. Consultas atuais e autorização junto aos dados

Usar consultas ao primário MySQL, sem réplica defasada, TTL global ou cache persistente de dados privados. Deduplicação restrita a uma renderização pode ser usada onde não atravesse uma mutação; após escrever, reler com o cliente atual.

- Compor o predicado de autorização e filtros uma vez, aplicando-o tanto em `findMany` quanto em `count` e indicadores. Não aceitar `Usuario`, cargo ou curso fornecido pelo cliente como prova de acesso.
- Ordenação explícita e desempate por ID: usuários por nome/ID; pendências por criação descendente/ID; demais listas pelo critério atual com desempate. Listas com total e página usam a mesma transação de leitura/snapshot, evitando que uma escrita intermediária produza total incompatível naquela resposta.
- Buscar e paginar no banco, com limites de página explícitos. Dados necessários para cálculos complexos são projetados pelo recorte completo autorizado, nunca limitados silenciosamente aos primeiros registros.
- Indicadores de horas usam a mesma projeção de lançamentos efetivos das telas; filtragem de curso/situação respeita estágio cancelado/excluído e vínculo histórico conforme os contratos atuais.
- Rotas privadas são dinâmicas e respostas privadas não são armazenadas por CDN. Não introduzir `use cache`/`unstable_cache` para identidade, filas ou dados mutáveis nesta entrega. `revalidatePath`/`refresh` após commit atualizam a UI; não substituem consultar o banco. Cliente precisa iniciar nova requisição para ver alterações de outra instância, sem requisito de atualização em tempo real.
- Manter loading/error boundaries e mensagem segura, distinguindo banco indisponível de conflito de negócio. `reset()` e atualização de rota fazem nova tentativa; envio pendente não permite duplo clique.
- Pendências de cadastro, parecer e conferência são consultas de situações dos próprios registros. Remover central, sino/contagem de não lidas, endpoints de marcação de leitura e efeitos de criação de notificações do modo persistente. Totais de fila são de processos aguardando ação, não de mensagens lidas/não lidas.

**Alternativas:** carregar tudo na inicialização e filtrar no cliente perpetua cortes e snapshots; cache distribuído exigiria invalidação e infraestrutura sem necessidade para esta etapa.

### 9. Kit fixo no repositório e arquivos recebidos no MySQL

O catálogo fixo e seus descritores ficam em módulos versionados no repositório, com chaves estáveis e checksum. Arquivos oficiais ficam empacotados na aplicação, como no download atual, com inclusão explícita no tracing. Não há tabela `TemplateDocumento`/`VersaoTemplate`, editor, formulário de upload de template ou endpoint de publicação, mesmo para administrador.

Ao criar documento preenchido, copiar a definição utilizada para um snapshot JSON e registrar seu checksum junto aos valores. Abrir um documento existente usa essa definição, não uma substituição silenciosa pelo manifesto atual. Isso preserva preenchimentos sem implementar gerenciamento administrativo de versões. Atualização futura do kit é alteração de código/acervo com teste de compatibilidade; arquivos antigos necessários a registros existentes devem continuar identificáveis no pacote ou ser preservados como arquivo durável.

Para documentos recebidos/anexos exigidos pelos fluxos mantidos, usar `Arquivo` com nome saneado, MIME, tamanho, checksum, autor, criação e conteúdo binário `LONGBLOB`. Vínculo ao documento e gravação do arquivo confirmam conjuntamente. Metadados são separados das consultas que carregam o conteúdo; não armazenar base64 como texto nem devolver binários em listagens.

- Downloads passam por Route Handler autenticado, validando acesso ao recurso/documento e entregando apenas o binário necessário. Documento privado nunca recebe URL pública permanente.
- Não gravar uploads no filesystem da Vercel. Arquivos oficiais estáticos já existentes podem continuar empacotados como recursos imutáveis identificados por caminho/checksum; a preparação explícita registra seu catálogo. Arquivos dinâmicos ficam no banco.
- Usar limite técnico inicial de quatro MiB por arquivo binário em upload via Route Handler e validar o tamanho antes de materializar o corpo inteiro. Não transportar arquivo base64 desse tamanho em Server Action: o guia local informa limite padrão de um MB, além da expansão base64. A UI apresenta o limite e erro de tamanho. Se o acervo real exigir uploads maiores, revisar o limite e transporte antes da entrega desse caso, sem aceitar arquivo parcialmente gravado.
- Não confundir upload de documento recebido com edição de template: validar tipos permitidos para o documento e manter o acervo fixo intacto. Documentos recebidos ficam identificados como recebidos, não como gerados pelo sistema. Referências não resolvidas produzem indisponibilidade explícita.

**Alternativas:** manter tabelas/editor de versões para um acervo fixo adiciona gestão desnecessária; usar apenas o descritor mais recente modifica documentos antigos. Snapshot por preenchimento tem alguma duplicação, mas reduz a infraestrutura e conserva o contrato. Para anexos dinâmicos, object storage privado pode ser adotado depois; MySQL mantém a durabilidade com a infraestrutura já escolhida, ao custo de backups maiores.

### 10. Comunicação documental sem sucesso fictício

Separar pedido de envio e tentativa de transporte. `PedidoEnvioDocumento` registra intenção e bloqueio por parecer/integração; `EnvioExterno` mantém tentativas com estados como pendente, enviado, falha ou resultado incerto, usando timestamps próprios para pedido e confirmação. Adequar DTOs e consumidores que hoje só admitem `enviado | falha`.

Até a entrega de geração e transporte de anexos, pedidos sem integração disponível são registrados como indisponíveis/pendentes, nunca como enviados pela simples presença do e-mail. Parecer favorável pode liberar o pedido documental, mas SMTP de recuperação de senha não equivale à implementação de envio documental. Assinaturas continuam externas e somente a conferência autorizada produz liberação.

**Alternativa rejeitada:** preservar o sucesso simulado de `enviarParaAssinaturas` após integrar o banco transformaria um dado fictício temporário em evidência persistente falsa.

### 11. Retenção, remoção de dados pessoais e histórico

Usar inativação nos registros com dependências protegidas; impedir novos vínculos com inativos e preservar FKs para consulta histórica. Exclusão de conta com histórico mantém uma identidade técnica inativa/anônima, remove credenciais e sessões e limpa dados pessoais nas tabelas e conteúdo documental que os duplicaram; exclusão sem histórico pode ser física dentro da transação.

Snapshots históricos são mínimos e justificados: nome/curso quando exigidos no histórico de estágio, estado e atores de decisões, sem copiar endereço/CPF indiscriminadamente. A exclusão específica de estágio conserva o nome histórico permitido e os dados do processo, remove os dados pessoais daquele contexto e não exclui o perfil do aluno.

Mapear fontes de dados pessoais pela definição salva com o documento para limpar `DocumentoPreenchido.valores`, solicitações e anexos pertinentes, não somente `DadosPessoaisAluno`. Se um anexo privado não puder ser saneado, remover seu conteúdo e manter apenas o registro técnico de remoção; não deixá-lo acessível como cópia dos dados apagados. Aplicar regra equivalente a orientador/supervisor. Backups têm acesso restrito e restaurações devem reaplicar um registro mínimo de remoções posteriores ao ponto restaurado antes de reabrir consultas.

Não criar `EventoEstagio` nem painel de auditoria genérica. Encaminhamento, liberação, cancelamento e exclusão guardam seus responsáveis/datas no estágio ou na solicitação específica. Pareceres, submissões, observações, renovações de convênio, resultados de importação e correções de horas permanecem registros funcionais específicos, não uma captura de toda edição de campo. Correções e decisões anteriores exigidas pelo processo não são apagadas para reduzir tabelas.

**Alternativas:** cascata geral destrói histórico; anonimizar apenas `usuarios` mantém cópias pessoais em documentos; conservar snapshots integrais indefinidamente conflita com as regras de remoção do projeto.

### 12. Conciliação das changes e contratos existentes

- `frontend-website` é referência dos fluxos mantidos, com exceções explicitamente aprovadas nesta change: cargo único, formulário sem prévia, catálogo fixo e adiamento de notificações e trilha genérica. Adequar navegação e endpoints correspondentes na implementação, sem copiar requisitos adiados para o backend. Preparação/liberação, aprovação de acesso e permissões específicas permanecem conforme os contratos mantidos. Não reinterpretar multiplicidades transcritas como autorização para alterar comportamento.
- `corrigir-hidratacao-e-carregamento-banco`: preservar diagnóstico, limites de espera, recuperação, ausência de fallback com banco configurado, estados de UI e listagem completa. O mecanismo de TTL/hidratação é substituído por consultas, com contrato mais forte de leitura após commit. Reaproveitar evidências remotas já registradas e produzir evidências novas para os cenários ainda faltantes, sem marcar a outra change por inferência.
- `impedir-cadastro-matricula-duplicada`: preservar matrícula registrada/vinculada, consulta antecipada, revalidação final, índice único e ausência de efeitos residuais. A nova arquitetura recebe o formulário inteiro na conclusão e não depende de prévia ou reserva local. Há um único proprietário técnico para a migração de unicidade: esta implementação verifica histórico de migrações e índice existente; se já entregue pela change específica, reutiliza-o; se ausente, cria uma única migração aqui. Não produzir dois SQLs concorrentes com o mesmo objetivo.
- As deltas atuais usam `ADDED` porque esses requisitos ainda não estão nas specs duráveis. Antes de sincronizar/arquivar esta change, reavaliar o inventário principal: requisitos que outra change já tenha promovido passam a deltas `MODIFIED` com conteúdo completo e mesmo nome, preservando cenários compatíveis. Essa reconciliação documental exigirá seu próprio escopo de atualização; não arquivar nem modificar changes relacionadas automaticamente.

## Risks / Trade-offs

- **Signup padrão compondo uma transação externa:** adapter/configuração incompatível pode gravar fora dela ou retornar usuário sintético → fixar versões, isolar a instância restrita e testar rollback real antes do restante da integração; nunca aceitar resposta sintética como nova conta.
- **Aumento das consultas e conexões serverless:** cada requisição lê dados atuais → projeções pequenas, índices, consultas agrupadas e pool limitado; medir sob concorrência antes de ajustar limites. Não resolver com cache que esconda revogação ou novas pendências.
- **Tempo de transação e deadlocks:** vários efeitos no mesmo agregado e hash padrão do signup dentro da transação → medir duração, evitar locks antecipados, manter SMTP fora, definir ordem de locks e repetir apenas aborts confirmados.
- **Consumo concorrente de token no Prisma/MariaDB:** o `delete` do adapter pode devolver registro antigo após outro resgate apagar a mesma linha → usar isolamento `Serializable` no reset e rejeitar/retentar conflitos de serialização; teste concorrente obrigatório.
- **Migração de dados não normalizados:** JSON ou vínculos antigos podem não mapear → relatório de pré-inspeção, migração ensaiada em cópia, interrupção para conflitos reais, sem escolha automática de conta.
- **Contas antigas com vários cargos:** reduzir lista a escalar pode remover privilégio ou elevar acesso por precedência → decidir explicitamente o cargo dessas contas antes da conversão, sem escolher o primeiro, o mais privilegiado ou duplicar contas automaticamente.
- **Credenciais e solicitações antigas somente em memória:** SQL não recupera o que nunca foi persistido → estabelecer nova senha; reconstruir solicitação somente para conta pendente com dados verificáveis e decisão registrada de migração, sem presumir históricos inexistentes.
- **Binários no MySQL:** aumenta tamanho do banco e dos backups → limite explícito, seleção de metadados nas listas e downloads dedicados; revisar object storage se volume justificar depois.
- **SMTP pode falhar após emissão do token:** não há fila própria com reenvio automático → log redigido, confirmação pública de solicitação e possibilidade de pedir outro link pelos mecanismos da biblioteca; não prometer entrega garantida ou exatamente uma vez.
- **Perda do formulário ao recarregar:** eliminação da prévia persistida descarta dados incompletos → explicar o comportamento no cadastro e preservar estado apenas enquanto o formulário estiver aberto, sem persistir senha no navegador.
- **Definição fixa alterada pelo desenvolvedor:** documento antigo poderia abrir com campos diferentes → snapshot/checksum no documento salvo e teste de reabertura após atualização do catálogo.
- **Rollback para simulador após novas escritas:** versão antiga não entende todo o domínio novo → ponto de corte com escrita suspensa e preferência por correção adiante; restauração só com reconciliação das escritas posteriores.
- **TLS atual sem validação de cadeia:** o adapter hoje usa `rejectUnauthorized: false` → configurar CA do serviço quando necessária e validação de certificado/hostname no runtime e ferramentas operacionais; testar com o endpoint real, sem enfraquecer TLS como correção automática de conexão.

## Migration Plan

### A. Preparação e ensaio isolado

1. Inventariar consumidores de `obterEstado`, credenciais, prévias simuladas, listas de cargos, notificações, edição de templates, helpers síncronos e arquivos; associar fluxos mantidos à persistência e identificar entradas adiadas a retirar da interface/endpoints. Fixar versões de Better Auth e testar signup padrão no adapter transacional, reset padrão e estabelecimento de senha sem credencial anterior, com rollback e concorrência no MySQL.
2. Inspecionar schema/migrações existentes, versão MySQL, charset/collation, FKs planejadas, duplicidades, cargos e referências do JSON. O destino de implantação é exclusivamente `selic`; desenvolvimento, Preview e testes usam bancos dedicados entre si. Contas com vários cargos, cargo ausente ou inválido exigem decisão explícita antes de converter.
3. Gerar backup SQL com snapshot consistente, registrar versão e checksum e restaurar em banco isolado. Não publicar arquivo de backup no Git nem anexar credenciais às evidências. Repetir backup antes de cada aplicação/transformação subsequente no ambiente servido aos usuários.
4. Criar migrações aditivas por blocos e transformação de dados versionada, preservar `usuarios`/`matriculas` e IDs legados. Migrar dados pessoais para sua relação e cargo válido único para `Usuario.papel`; retirar `papeis` depois da conversão validada. Manter `dadosPessoais` JSON apenas até a carga relacional explícita de referências acadêmicas, que pertence à etapa 13.3; a migração de retirada dessa coluna não pode anteceder a transformação. Não implementar escrita dupla contínua nem tabelas dos recursos adiados.
5. Mapear cursos/turmas/períodos legados somente por registros de referência verificados; não importar um universo inteiro de estágios/documentos de demonstração para satisfazer FKs. Registros de referência originados nas fixtures que já identificam vínculos reais exigem carga explícita e rastreável, com preservação de ID e sem sobrescrita de registros existentes.
6. Preservar valores de preenchimentos verificáveis e construir referência/snapshot das definições efetivamente utilizadas; não substituir pelo kit atual se não houver correspondência. Inventariar eventuais dados persistidos de funcionalidades adiadas antes de removê-los, sem descarte automático. Validar contagens, relações, cargos, situações e hashes antes/depois. Duplicidade, referência impossível ou dados insuficientes interrompem a migração para resolução explícita. Confirmar o índice de matrícula uma única vez.

### B. Entregas de implementação e verificação

1. **Fundação e contas:** repositórios, IDs, erros, cargo único, schema de autenticação, formulário de duas etapas sem prévia, signup padrão transacional, aprovações, senha e sessão padrão. Cadastros acadêmicos necessários já devem existir no banco para validar esses fluxos; o CRUD completo entra no bloco seguinte.
2. **Cadastros de apoio:** CRUD e importação, vínculos, registros institucionais, inativação/remoção e documentos recebidos duráveis. Preparar catálogo fixo e retirar navegação/endpoints de editor/publicação de templates.
3. **Fluxo de estágio:** criação/documentos iniciais com definição fixa identificada, submissões, pareceres, conferência, horas, exclusões, consultas e estatísticas; filas por situação e pedidos documentais sem sucesso simulado. Retirar central de notificações e trilha genérica, conservando registros funcionais.
4. **Remoção da ponte:** nenhuma leitura/escrita do modo persistente usa `EstadoSimulado`; eliminar hidratação/auto-seed como caminho real e manter simulação apenas atrás do adapter explícito. Verificar inclusive helpers indiretos de nomes, totais e permissões.
5. **Testes:** unitários para regras puras; integração com MySQL para índices, FKs, signup/reset padrão, tokens de uso único, locks, rollback, arquivos e concorrência; E2E contra dois processos apontando ao mesmo banco isolado. Reiniciar servidor entre consulta antecipada e conclusão com o navegador mantendo o formulário; recarregar o navegador deve reiniciar o preenchimento sem criar registros. Testar formulário final direto/adulterado, cargo único e ausência de escalada via signup, rejeição de resposta sintética, novas tentativas de recuperação após falha de SMTP e reabertura após atualização do acervo. Duas abas no mesmo processo não comprovam duas instâncias.
6. Executar typecheck, lint, unitários, integração MySQL, E2E e build com as configurações adequadas de simulação e persistência, além de validação estrita do OpenSpec. As suítes que hoje injetam cookie de ID precisam autenticar de verdade no modo persistente. Verificar falha e recuperação no mesmo PID no ensaio controlado.

### C. Corte e validação operacional

1. Preparar Preview com banco isolado e SMTP de teste/caixa de verificação; confirmar efetivamente as variáveis e criar deployment após alterações de configuração. Usar `DATABASE_URL`, origem/segredo Better Auth, CA TLS quando necessária e parâmetros SMTP por ambiente, sem chave ou infraestrutura de payload de mensagens própria; não compartilhar credenciais de teste com Production.
2. Confirmar acessibilidade Vercel/Aiven e logs redigidos, incluindo indisponibilidade e nova tentativa. Evidência existente de egress público dinâmico permanece válida para o ambiente em que foi coletada; o Preview novo deve comprovar seu próprio destino real.
3. Antes do corte em Production, suspender escritas na versão antiga e bloquear acessos de mutação pelos aliases antigos. Gerar/restaurar o backup final, aplicar as migrações versionadas via `db:deploy`, executar transformação e carga explícita e verificar invariantes. Não rodar `db:push`, reset ou seed de demonstração no banco real.
4. Preparar o primeiro administrador com cargo único por comando operacional controlado e estabelecimento de senha pelo provedor; nunca reabilitar automaticamente contas de demonstração. Para contas legadas, usar o fluxo padrão para estabelecer senha; para pendentes sem solicitação persistida, migrar somente a partir de dados verificáveis, mantendo o estado pendente.
5. Implantar a aplicação completa, remover aceitação do cookie antigo e testar contas de verificação autorizadas, pendências, aprovação, login, arquivos, kit fixo e consultas. Conferir que funcionalidades adiadas não estão acessíveis por navegação ou requisição direta. Só reabrir escrita depois dos critérios do bloco de contas e das invariantes do domínio mantido passarem.
6. Registrar versão de aplicação/banco, destino sanitizado e evidências de dados entre instâncias, falha/recuperação, reinício e ausência de demonstração implícita. Onde a plataforma não permitir comprovar o mesmo processo, registrar a limitação e juntar o ensaio de mesmo PID, sem alegar uma correlação remota inexistente.

### Recuperação

Antes de reabrir escritas, falha no corte permite manter manutenção, restaurar o backup verificado e reativar a versão compatível de referência. Migrações MySQL com DDL não são consideradas uma única transação reversível: registrar cada etapa aplicada e retomar ou restaurar conforme o ponto atingido.

Depois de aceitar novas escritas, preferir correção adiante mantendo schema e dados. Voltar ao simulador anterior não é rollback seguro. Se restauração for necessária, suspender escrita, capturar o estado posterior, reconciliar contas e operações aceitas desde o backup, reaplicar remoções de dados pessoais e somente então reabrir acesso. Não apagar histórico de migrações nem editar uma migração já aplicada para esconder falha.

## Open Questions

- Quais serão o domínio/remetente SMTP e os valores operacionais de conexão de cada ambiente? O transporte SMTP, a origem canônica e as variáveis necessárias já estão definidos; esses valores podem ser fornecidos no preparo da implantação.
- Qual será o local de guarda restrita e a janela operacional para os backups SQL e o corte? O procedimento de backup/restauração e o bloqueio de escrita já fazem parte do plano; agendamento e destino operacional não alteram o modelo nem as tarefas técnicas.
