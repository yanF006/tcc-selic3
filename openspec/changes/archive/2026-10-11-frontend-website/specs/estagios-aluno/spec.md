## Purpose

Permite que o aluno cadastre, consulte, edite e exclua seus estágios, vendo o histórico com instituição, supervisor, orientador e período, e escolhendo quais documentos deseja preencher em cada estágio.

## ADDED Requirements

### Requirement: Cadastro de estágio

O sistema SHALL permitir que o aluno cadastre um estágio informando nome da instituição concedente, supervisor, orientador, data de início, data de fim e situação.

#### Scenario: Cadastro válido

- **WHEN** o aluno preenche todos os campos obrigatórios com valores válidos
- **THEN** o sistema SHALL gravar o estágio, classificá-lo conforme a situação informada e abrir a seleção de documentos daquele estágio

#### Scenario: Instituição exigida entre convênios ativos

- **WHEN** o aluno abre o campo da instituição concedente
- **THEN** o sistema SHALL oferecer apenas convênios ativos e SHALL capturar a instituição a partir dessa seleção

#### Scenario: Campo obrigatório em branco

- **WHEN** o aluno deixa em branco um dos campos obrigatórios do estágio
- **THEN** o sistema SHALL bloquear a gravação e sinalizar o campo correspondente

### Requirement: Validação do período do estágio

O sistema SHALL exigir que a data de fim seja igual ou posterior à data de início e SHALL validar a coerência das datas em relação à situação informada.

#### Scenario: Data de fim anterior à data de início

- **WHEN** o aluno informa data de fim anterior à data de início
- **THEN** o sistema SHALL recusar a gravação e sinalizar o erro nos campos de data

#### Scenario: Estágio concluído com data de fim no futuro

- **WHEN** o aluno marca o estágio como concluído e informa data de fim posterior à data atual
- **THEN** o sistema SHALL recusar a gravação e sinalizar a inconsistência entre a situação e a data de fim

### Requirement: Situação do estágio

O sistema SHALL oferecer ao aluno as situações em andamento e concluído, e o estágio SHALL ser exibido em listas e filtros conforme a situação registrada.

#### Scenario: Marcação como concluído

- **WHEN** o aluno altera a situação de um estágio de em andamento para concluído
- **THEN** o sistema SHALL persistir a nova situação e SHALL tratá-lo como estágio concluído nas consultas e estatísticas

#### Scenario: Reversão de estágio concluído

- **WHEN** o aluno altera a situação de concluído para em andamento
- **THEN** o sistema SHALL persistir a nova situação e remover o estágio do conjunto de concluídos

### Requirement: Histórico de estágios

O sistema SHALL listar os estágios do aluno com nome da instituição, supervisor, orientador, data de início e data de fim, e SHALL oferecer as ações de detalhes e de documentos preenchidos.

#### Scenario: Aluno com estágios

- **WHEN** o aluno abre a tela de Estágio
- **THEN** o sistema SHALL listar seus estágios com os campos acima e com as ações de detalhes e documentos preenchidos

#### Scenario: Aluno sem estágios

- **WHEN** o aluno não possui nenhum estágio cadastrado
- **THEN** o sistema SHALL exibir um estado vazio informando que não há estágios e offering a ação de cadastrar um novo estágio

#### Scenario: Filtro do histórico

- **WHEN** o aluno informa um texto de busca ou uma situação para filtrar o histórico
- **THEN** o sistema SHALL exibir apenas os estágios que correspondem ao filtro e informar o total de resultados

### Requirement: Detalhes do estágio

O sistema SHALL exibir, na tela de detalhes, os dados de cadastro do estágio, a lista de documentos vinculados com a situação de cada um e o total de horas registradas.

#### Scenario: Consulta de detalhes

- **WHEN** o aluno acessa os detalhes de um estágio seu
- **THEN** o sistema SHALL exibir os dados de cadastro, os documentos vinculados com suas situações e o total de horas registradas naquele estágio

#### Scenario: Estágio sem documentos vinculados

- **WHEN** o aluno acessa os detalhes de um estágio para o qual ainda não escolheu documentos
- **THEN** o sistema SHALL informar que nenhum documento foi escolhido e SHALL permitir iniciar a seleção

### Requirement: Seleção de documentos por estágio

O sistema SHALL permitir que o aluno escolha, após cadastrar o estágio, quais documentos deseja preencher naquele estágio, e a escolha SHALL ficar registrada e editável.

#### Scenario: Seleção de documentos

- **WHEN** o aluno seleciona um ou mais documentos para o estágio e confirma
- **THEN** o sistema SHALL registrar a seleção e torná-la visível nos detalhes do estágio

#### Scenario: Alteração da seleção

- **WHEN** o aluno abre a seleção de um estágio e adiciona ou remove um documento ainda não preenchido
- **THEN** o sistema SHALL persistir a nova seleção

#### Scenario: Remoção de documento já preenchido

- **WHEN** o aluno tenta remover da seleção um documento que já possui preenchimento
- **THEN** o sistema SHALL exigir confirmação explícita e, ao confirmar, SHALL inativar o documento preenchido sem apagá-lo, mantendo-o disponível para consulta do coordenador

### Requirement: Edição e exclusão de estágio pelo aluno

O sistema SHALL permitir que o aluno edite um estágio próprio e SHALL exigir autorização de cargo superior para a exclusão de um estágio.

#### Scenario: Edição pelo aluno

- **WHEN** o aluno altera os dados de um estágio próprio e salva
- **THEN** o sistema SHALL persistir as alterações e refletir a mudança no histórico e nos detalhes

#### Scenario: Solicitação de exclusão

- **WHEN** o aluno solicita a exclusão de um estágio que possui documentos preenchidos
- **THEN** o sistema SHALL exigir autorização de cargo superior, registrar a solicitação e sinalizar que a exclusão depende da autorização

#### Scenario: Exclusão autorizada

- **WHEN** a exclusão de um estágio é autorizada pelo responsável competente
- **THEN** o sistema SHALL excluir o estágio e inativar os documentos preenchidos vinculados, mantendo-os disponíveis para consulta do coordenador

### Requirement: Acesso do coordenador de curso aos estágios de seu curso

O sistema SHALL permitir que o Coordenador de Curso consulte, edite e exclua os estágios dos alunos de seu próprio curso, conforme as regras de autorização de exclusão.

#### Scenario: Listagem por curso

- **WHEN** o Coordenador de Curso abre a gestão de estágios
- **THEN** o sistema SHALL listar os estágios dos alunos de seu curso e não SHALL exibir estágios de alunos de outros cursos

#### Scenario: Edição de estágio de aluno do curso

- **WHEN** o Coordenador de Curso edita os dados de um estágio de um aluno de seu curso
- **THEN** o sistema SHALL persistir a alteração e registrar que a edição foi feita pelo coordenador, e não pelo aluno