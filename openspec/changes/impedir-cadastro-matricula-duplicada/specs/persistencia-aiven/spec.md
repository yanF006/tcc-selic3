## ADDED Requirements

### Requirement: Matrícula vinculada a uma única conta

O sistema SHALL permitir que cada matrícula não vazia esteja vinculada a no máximo uma conta de usuário, independentemente do e-mail e da situação dessa conta. Contas sem matrícula SHALL continuar permitidas.

#### Scenario: Outro e-mail para a mesma matrícula

- **WHEN** uma conta já possui a matrícula informada e outra pessoa tenta cadastrar essa matrícula com e-mail diferente
- **THEN** o sistema SHALL recusar o novo cadastro sem alterar a conta existente

#### Scenario: Conta pendente ou inativa já vinculada

- **WHEN** a matrícula informada pertence a uma conta pendente ou inativa
- **THEN** o sistema SHALL recusar a criação de outra conta para essa matrícula

#### Scenario: Contas que não possuem matrícula

- **WHEN** contas de gestão não possuem matrícula
- **THEN** o sistema SHALL permitir sua coexistência sem tratá-las como contas com matrícula duplicada

### Requirement: Revalidação da matrícula nas duas etapas do cadastro

O sistema SHALL verificar se a matrícula está vinculada a uma conta antes de liberar a segunda etapa e novamente ao concluir o cadastro. Quando a persistência estiver configurada, a verificação SHALL considerar os registros atuais do banco, inclusive os criados por outros processos. Uma rejeição SHALL apresentar uma mensagem compreensível, sem expor os dados da conta existente.

#### Scenario: Matrícula ocupada na primeira etapa

- **WHEN** o aluno envia a primeira etapa com uma matrícula já vinculada
- **THEN** o sistema SHALL apresentar erro associado à matrícula e impedir o avanço

#### Scenario: Matrícula ocupada entre as etapas

- **WHEN** a matrícula estava livre na primeira etapa e outra conta passa a usá-la antes da conclusão
- **THEN** o sistema SHALL recusar a conclusão e informar o conflito

#### Scenario: Matrícula ocupada em outro processo

- **WHEN** outra instância da aplicação cria uma conta para a matrícula após a hidratação do processo atual
- **THEN** o sistema SHALL detectar o vínculo atual e recusar o novo cadastro

#### Scenario: Matrícula importada e ainda livre

- **WHEN** a matrícula está no registro de matrículas válidas e ainda não pertence a nenhuma conta
- **THEN** o sistema SHALL permitir concluir o cadastro ativo após as demais validações

#### Scenario: Matrícula livre ainda não registrada

- **WHEN** a matrícula não consta no registro de matrículas válidas e não pertence a nenhuma conta
- **THEN** o sistema SHALL permitir o cadastro pendente e sua solicitação de autorização após as demais validações

#### Scenario: Falha ao verificar o banco configurado

- **WHEN** o banco está configurado e sua indisponibilidade impede verificar ou persistir o vínculo da matrícula
- **THEN** o sistema SHALL informar que o cadastro não pôde prosseguir e não confirmar uma nova conta somente em memória

### Requirement: Rejeição consistente de cadastros concorrentes

O sistema SHALL garantir a unicidade da matrícula mesmo quando requisições simultâneas passam pelas verificações iniciais. Um cadastro rejeitado por conflito de unicidade SHALL retornar uma falha de negócio compreensível e não deixar usuário, credencial ou solicitação de acesso do cadastro rejeitado no estado da aplicação.

#### Scenario: Duas conclusões simultâneas com e-mails diferentes

- **WHEN** dois cadastros tentam concluir simultaneamente para uma matrícula inicialmente livre
- **THEN** no máximo uma conta SHALL ser criada e a outra tentativa SHALL ser recusada sem registros residuais do cadastro rejeitado

### Requirement: Preservação de contas existentes na adequação de unicidade

O sistema SHALL preservar as contas existentes ao introduzir a garantia de unicidade. Duplicidades anteriores SHALL ser identificadas para decisão explícita antes da aplicação dessa garantia, sem excluir ou desvincular contas automaticamente.

#### Scenario: Duplicidades anteriores à correção

- **WHEN** existem duas ou mais contas para uma mesma matrícula antes da adequação
- **THEN** a aplicação da restrição SHALL ser interrompida até a resolução explícita do conflito, mantendo os registros existentes
