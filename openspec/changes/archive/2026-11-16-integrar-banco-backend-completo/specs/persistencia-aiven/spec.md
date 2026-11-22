## MODIFIED Requirements

### Requirement: Conexão e Persistência no Aiven MySQL

O sistema SHALL conectar-se ao banco de dados MySQL hospedado no Aiven utilizando Prisma 7 e driver adapter com suporte a TLS. Com `DATABASE_URL` configurada, o banco dedicado `selic` SHALL ser a fonte da verdade para contas com cargo único e seus vínculos, matrículas, solicitações de acesso, cadastros de apoio e registros do fluxo de estágio mantidos nesta entrega. As operações SHALL persistir seus resultados e as consultas SHALL recuperar os registros atuais sem depender da hidratação global do estado em memória. Definições e arquivos do Kit de Estágio SHALL permanecer fixos e identificáveis, sem exigir gestão administrativa de versões. Sem banco configurado, o modo simulado SHALL permanecer explícito e separado da operação persistente.

#### Scenario: Hidratação e Persistência de Usuários e Matrículas
- **WHEN** a aplicação inicia com `DATABASE_URL` configurada apontando para um banco dedicado (`selic`)
- **THEN** o sistema SHALL consultar usuários e matrículas persistidos e gravar suas mutações no banco, preservando os registros entre execuções sem exigir um snapshot global em memória

#### Scenario: Persistência do domínio mantido
- **WHEN** uma operação válida cria ou altera um cadastro de apoio, solicitação ou registro do fluxo de estágio
- **THEN** o sistema SHALL gravar o resultado no banco e disponibilizá-lo a consultas autorizadas após reinício ou em outra instância

#### Scenario: Simulação sem banco configurado
- **WHEN** a aplicação inicia sem `DATABASE_URL`
- **THEN** o sistema SHALL operar no modo de simulação explicitamente identificado, sem confundir seus resultados com dados reais persistidos

## ADDED Requirements

### Requirement: Identidade única e criação sem sobrescrita

Registros criados independentemente em diferentes processos SHALL receber identidades distintas. Uma operação de criação SHALL NOT atualizar um registro existente por coincidência de identificador. Atualizações SHALL exigir um registro alvo existente e autorização para alterá-lo; conflito de identidade na criação SHALL produzir erro sem alterar o registro anterior.

#### Scenario: Cadastros simultâneos em instâncias diferentes
- **WHEN** duas instâncias criam contas distintas com e-mails e matrículas livres
- **THEN** ambas as contas SHALL permanecer persistidas com identidades distintas e acessíveis na listagem administrativa

#### Scenario: Identificador em conflito na criação
- **WHEN** uma tentativa de criação apresenta identificador já utilizado
- **THEN** o sistema SHALL recusar a criação sem substituir nome, e-mail, matrícula ou dados do registro existente

#### Scenario: Atualização de registro inexistente
- **WHEN** uma operação de edição aponta para um registro que não existe
- **THEN** o sistema SHALL informar a ausência sem criar outro registro como efeito implícito da edição

### Requirement: Matrícula vinculada a uma única conta

O sistema SHALL permitir que cada matrícula não vazia esteja vinculada a no máximo uma conta de usuário, independentemente do e-mail e da situação dessa conta. Contas sem matrícula SHALL continuar permitidas. E-mails normalizados SHALL identificar no máximo uma conta. Essas garantias SHALL valer também para cadastro administrativo, edição e operações concorrentes em diferentes processos.

#### Scenario: Outro e-mail para a mesma matrícula
- **WHEN** uma conta ativa, pendente ou inativa já possui a matrícula informada e outra pessoa tenta cadastrar essa matrícula com e-mail diferente
- **THEN** o sistema SHALL recusar o novo cadastro sem alterar a conta existente

#### Scenario: Contas que não possuem matrícula
- **WHEN** contas de gestão não possuem matrícula
- **THEN** o sistema SHALL permitir sua coexistência sem tratá-las como contas com matrícula duplicada

#### Scenario: E-mail duplicado com variação de caixa e espaços
- **WHEN** uma criação ou edição tenta usar e-mail já vinculado a outra conta após normalização de caixa e espaços externos
- **THEN** o sistema SHALL recusar o conflito sem modificar a outra conta

### Requirement: Revalidação da matrícula nas duas etapas do cadastro

O sistema SHALL verificar se a matrícula está vinculada a uma conta na consulta antecipada da primeira etapa e novamente ao receber todos os dados na conclusão única do cadastro. A consulta antecipada SHALL NOT reservar a matrícula, criar prévia persistida ou autorizar a conclusão sem nova validação. Com banco configurado, a verificação SHALL considerar seus registros atuais, inclusive os criados por outros processos, e SHALL NOT tomar o registro de matrícula importada como prova de que já existe conta. A rejeição SHALL informar o conflito sem expor dados da conta existente.

#### Scenario: Matrícula ocupada na primeira etapa
- **WHEN** o aluno envia a primeira etapa com uma matrícula já vinculada
- **THEN** o sistema SHALL apresentar erro associado à matrícula e impedir o avanço

#### Scenario: Matrícula ocupada entre as etapas
- **WHEN** outra instância vincula a matrícula livre após a primeira etapa e antes da conclusão
- **THEN** o sistema SHALL recusar a conclusão sem criar conta, credencial ou solicitação residual

#### Scenario: Conclusão sem consulta antecipada confiável
- **WHEN** uma requisição envia o formulário completo diretamente ou modifica a matrícula após a consulta inicial
- **THEN** o sistema SHALL validar a matrícula e os demais dados atuais no servidor, sem confiar em uma confirmação anterior enviada pelo cliente

#### Scenario: Matrícula livre consultada por duas pessoas
- **WHEN** duas pessoas consultam a mesma matrícula livre na primeira etapa
- **THEN** a consulta SHALL NOT criar reserva ou conta para nenhuma delas e a disputa na conclusão SHALL ser resolvida pela garantia persistente de unicidade

#### Scenario: Matrícula importada e ainda livre
- **WHEN** uma matrícula registrada ainda não pertence a nenhuma conta e os demais dados são válidos
- **THEN** o sistema SHALL permitir o cadastro ativo, distinguindo registro de matrícula de vínculo com conta

#### Scenario: Matrícula livre ainda não registrada
- **WHEN** a matrícula não consta no registro de matrículas válidas e não pertence a nenhuma conta
- **THEN** o sistema SHALL permitir o cadastro pendente e sua solicitação de autorização após as demais validações

### Requirement: Rejeição consistente de cadastros concorrentes

O sistema SHALL garantir unicidade e conclusão indivisível do cadastro mesmo quando requisições simultâneas passam pelas verificações iniciais. Conta de aluno com cargo único, credencial e solicitação obrigatória SHALL ser publicadas como um único resultado de negócio após o envio completo do formulário, sem depender de uma prévia persistida. Um cadastro rejeitado por conflito ou falha SHALL retornar erro compreensível sem deixar registros parciais nem alterar contas existentes.

#### Scenario: Duas conclusões simultâneas com e-mails diferentes
- **WHEN** dois cadastros tentam concluir simultaneamente para uma matrícula inicialmente livre
- **THEN** no máximo uma conta SHALL ser criada e a outra tentativa SHALL ser recusada sem registros residuais

#### Scenario: Reenvio do formulário concluído
- **WHEN** o mesmo formulário completo é enviado novamente após a criação da conta
- **THEN** o sistema SHALL impedir duplicação por e-mail ou matrícula e preservar a conta, a credencial e a solicitação existentes

#### Scenario: Falha após preparar a conta
- **WHEN** a operação não consegue persistir a credencial ou a solicitação obrigatória de um novo cadastro
- **THEN** o sistema SHALL rejeitar a conclusão sem deixar conta nova isolada, credencial isolada ou solicitação sem sua conta

### Requirement: Falha de conexão não pode virar sucesso com fixtures

Quando o banco estiver configurado e uma leitura ou escrita falhar por indisponibilidade, o sistema SHALL informar erro controlado e recuperável, sem retornar fixtures, snapshot expirado ou lista vazia como sucesso. Uma tentativa posterior SHALL poder recuperar a operação sem exigir reinício. Operações em andamento SHALL ter estado pendente e SHALL NOT anunciar sucesso antes de sua confirmação persistente.

#### Scenario: Falha ao consultar pendências
- **WHEN** o banco configurado fica indisponível durante a consulta de solicitações
- **THEN** a tela SHALL mostrar indisponibilidade e ação de nova tentativa, sem substituir os registros por solicitações de demonstração ou por uma lista vazia

#### Scenario: Recuperação sem reiniciar o processo
- **WHEN** o banco volta a responder após falha e o usuário tenta novamente
- **THEN** o sistema SHALL consultar os dados reais e substituir o estado de erro pelo resultado atual sem reinício

#### Scenario: Falha ao gravar cadastro
- **WHEN** a persistência de um cadastro não é confirmada por indisponibilidade
- **THEN** o sistema SHALL informar que a operação não foi confirmada, sem publicar sucesso somente com dados em memória

### Requirement: Leituras refletem dados atuais entre instâncias

Após a confirmação de uma mutação, uma nova consulta iniciada em qualquer instância SHALL considerar o estado persistido atualizado, sem aguardar expiração de um snapshot global do processo. Requisições já em andamento SHALL NOT ser apresentadas como prova de que a alteração posterior foi perdida. Busca, filtros, totais e paginação SHALL considerar todo o conjunto autorizado, com ordenação determinística e desempate estável.

#### Scenario: Cadastro feito em outra instância
- **WHEN** uma conta é criada e confirmada em outra instância e o administrador inicia nova consulta
- **THEN** a conta SHALL estar acessível na listagem e na busca, sem depender de reinício ou cooldown de hidratação

#### Scenario: Listagem repetida sem mutações
- **WHEN** a mesma consulta paginada é repetida em instâncias diferentes sem alterações concorrentes nos registros
- **THEN** o sistema SHALL manter resultados e totais equivalentes sem alternar dados locais de cada processo

#### Scenario: Busca além da primeira página
- **WHEN** o usuário busca um registro autorizado fora da primeira página
- **THEN** o sistema SHALL encontrá-lo e informar o total correspondente ao conjunto completo filtrado

### Requirement: Diagnóstico e limites de tempo da conexão

O sistema SHALL limitar o tempo de conexão e de aquisição para sinalizar indisponibilidade durante o carregamento. Falhas SHALL preservar código, estado SQL e causa encadeada para diagnóstico sem expor senha, usuário de banco ou URL completa em logs, respostas ou interface. Erros de conflito e validação SHALL permanecer distinguíveis da indisponibilidade.

#### Scenario: Banco inacessível
- **WHEN** a conexão não é concluída dentro dos limites configurados
- **THEN** o sistema SHALL encerrar a tentativa em tempo limitado, registrar a causa redigida e apresentar erro recuperável sem detalhes internos

#### Scenario: Conflito de unicidade
- **WHEN** o banco rejeita um cadastro por e-mail ou matrícula já vinculada
- **THEN** o sistema SHALL apresentar o conflito de negócio compreensível em vez de afirmar que o banco está indisponível
