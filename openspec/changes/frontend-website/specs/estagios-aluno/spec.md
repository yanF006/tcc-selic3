## Purpose

Permite que o aluno solicite a criação de estágios, informe os dados para a documentação inicial e acompanhe sua liberação pela coordenação, consultando histórico, documentos e horas de cada estágio.

## ADDED Requirements

### Requirement: Cadastro de estágio

O sistema SHALL permitir que o aluno solicite a criação de um estágio e informe instituição concedente, supervisor, orientador, datas previstas e os demais dados necessários ao Termo de Compromisso, ao Formulário de Liberação e ao Plano de Atividades. O sistema SHALL reaproveitar os dados já cadastrados e SHALL registrar o estágio em preparação, sem permitir ao aluno escolher sua situação.

#### Scenario: Cadastro válido

- **WHEN** o aluno preenche todos os campos obrigatórios com valores válidos
- **THEN** o sistema SHALL gravar o estágio em preparação, preencher automaticamente os três documentos iniciais e apresentar a ação de solicitar o encaminhamento para parecer e assinaturas

#### Scenario: Solicitação não autoriza o início

- **WHEN** o aluno conclui os dados da solicitação
- **THEN** o sistema SHALL informar que o estágio ainda depende de parecer favorável e confirmação das assinaturas pelo Coordenador de Estágio, mantendo os demais documentos bloqueados

#### Scenario: Instituição exigida entre convênios ativos

- **WHEN** o aluno abre o campo da instituição concedente
- **THEN** o sistema SHALL oferecer apenas convênios ativos e SHALL capturar a instituição a partir dessa seleção

#### Scenario: Campo obrigatório em branco

- **WHEN** o aluno deixa em branco um dos campos obrigatórios do estágio
- **THEN** o sistema SHALL bloquear a gravação e sinalizar o campo correspondente

### Requirement: Validação do período do estágio

O sistema SHALL exigir que a data de fim seja igual ou posterior à data de início e SHALL validar a coerência das datas em relação à situação registrada pela coordenação. As datas previstas informadas na solicitação não SHALL liberar o estágio automaticamente.

#### Scenario: Data de fim anterior à data de início

- **WHEN** o aluno informa data de fim anterior à data de início
- **THEN** o sistema SHALL recusar a gravação e sinalizar o erro nos campos de data

#### Scenario: Estágio concluído com data de fim no futuro

- **WHEN** a coordenação tenta registrar como concluído um estágio com data de fim posterior à data atual
- **THEN** o sistema SHALL recusar a gravação e sinalizar a inconsistência entre a situação e a data de fim

### Requirement: Situação do estágio

O sistema SHALL distinguir estágios em preparação, em andamento e concluídos, exibindo a situação registrada nas listas e filtros. Apenas a coordenação SHALL alterar a situação; a passagem inicial para em andamento SHALL depender de parecer favorável no Formulário de Liberação e da confirmação, pelo Coordenador de Estágio, das assinaturas dos três documentos iniciais.

#### Scenario: Liberação inicial

- **WHEN** o Coordenador de Estágio confirma as assinaturas do Termo de Compromisso, do Formulário de Liberação e do Plano de Atividades de um estágio com parecer favorável no formulário
- **THEN** o sistema SHALL colocar o estágio em andamento e liberar os demais documentos daquele estágio

#### Scenario: Tentativa de alterar situação pelo aluno

- **WHEN** o aluno tenta informar ou alterar a situação de um estágio, inclusive por uma requisição direta
- **THEN** o sistema SHALL recusar a alteração e preservar a situação registrada

#### Scenario: Marcação como concluído

- **WHEN** um coordenador com acesso ao estágio altera sua situação de em andamento para concluído
- **THEN** o sistema SHALL persistir a nova situação e SHALL tratá-lo como estágio concluído nas consultas e estatísticas

#### Scenario: Reversão de estágio concluído

- **WHEN** um coordenador com acesso ao estágio altera sua situação de concluído para em andamento em um estágio cuja liberação inicial já foi registrada
- **THEN** o sistema SHALL persistir a nova situação e remover o estágio do conjunto de concluídos

#### Scenario: Preparação não conta como andamento

- **WHEN** um estágio ainda não recebeu a liberação inicial do Coordenador de Estágio
- **THEN** o sistema SHALL identificá-lo como em preparação e não SHALL incluí-lo entre os estágios em andamento ou concluídos

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

O sistema SHALL exibir, na tela de detalhes, os dados do estágio, os três documentos iniciais obrigatórios com suas pendências de parecer e assinatura, os demais documentos conforme a liberação e o total de horas registradas.

#### Scenario: Consulta de detalhes

- **WHEN** o aluno acessa os detalhes de um estágio seu
- **THEN** o sistema SHALL exibir os dados de cadastro, os documentos vinculados com suas situações e o total de horas registradas naquele estágio

#### Scenario: Estágio em preparação

- **WHEN** o aluno acessa os detalhes de um estágio em preparação
- **THEN** o sistema SHALL apresentar os três documentos iniciais, a etapa pendente e o bloqueio dos demais documentos, em vez de solicitar uma seleção livre

### Requirement: Seleção de documentos por estágio

O sistema SHALL vincular obrigatoriamente o Termo de Compromisso, o Formulário de Liberação e o Plano de Atividades à solicitação. Após a liberação do estágio, o sistema SHALL permitir que o aluno escolha os demais documentos que seu perfil pode preencher, mantendo a escolha registrada e editável.

#### Scenario: Documentação inicial obrigatória

- **WHEN** o aluno consulta ou tenta alterar a seleção de documentos de um estágio
- **THEN** o sistema SHALL preservar o vínculo obrigatório dos três documentos iniciais e não SHALL permitir removê-los pela seleção opcional

#### Scenario: Seleção antes da liberação

- **WHEN** o aluno tenta selecionar ou registrar outro documento antes da liberação do estágio
- **THEN** o sistema SHALL recusar a operação e informar a pendência de liberação

#### Scenario: Seleção de documentos

- **WHEN** o aluno seleciona um ou mais documentos adicionais para um estágio já liberado e confirma
- **THEN** o sistema SHALL registrar a seleção e torná-la visível nos detalhes do estágio

#### Scenario: Alteração da seleção

- **WHEN** o aluno abre a seleção de um estágio liberado e adiciona ou remove um documento opcional ainda não preenchido
- **THEN** o sistema SHALL persistir a nova seleção

#### Scenario: Remoção de documento já preenchido

- **WHEN** o aluno tenta remover da seleção um documento opcional que já possui preenchimento
- **THEN** o sistema SHALL exigir confirmação explícita e, ao confirmar, SHALL inativar o documento preenchido sem apagá-lo, mantendo-o disponível para consulta do coordenador

### Requirement: Edição e exclusão de estágio pelo aluno

O sistema SHALL bloquear a edição, pelo aluno, dos dados iniciais de uma solicitação enquanto aguarda liberação, permitindo seu cancelamento. O indeferimento do Formulário de Liberação SHALL constituir exceção para correção e nova submissão. Após a liberação, o aluno SHALL poder editar apenas os dados informados depois dessa liberação, sem alterar os dados iniciais, a situação ou a conferência de assinaturas. Alterações do perfil SHALL atualizar os dados correspondentes do estágio sem exigir nova autorização.

#### Scenario: Edição pelo aluno

- **WHEN** o aluno tenta alterar os dados iniciais de um estágio sem indeferimento que autorize a correção
- **THEN** o sistema SHALL recusar a edição e preservar os dados existentes, mesmo após a liberação

#### Scenario: Correção após indeferimento

- **WHEN** o Formulário de Liberação de uma solicitação é indeferido e o aluno corrige os dados para nova submissão
- **THEN** o sistema SHALL permitir a correção como exceção ao bloqueio, atualizar os documentos iniciais correspondentes e preservar o histórico de pareceres

#### Scenario: Atualização do perfil

- **WHEN** o aluno atualiza os dados de seu perfil
- **THEN** o sistema SHALL refletir os dados correspondentes nos estágios sem invalidar a liberação nem exigir novo parecer

#### Scenario: Cancelamento antes da liberação

- **WHEN** o aluno cancela uma solicitação que ainda aguarda liberação
- **THEN** o sistema SHALL impedir sua continuidade e preservar o registro histórico do cancelamento

#### Scenario: Exclusão com histórico preservado

- **WHEN** o aluno exclui um estágio próprio
- **THEN** o sistema SHALL retirar o estágio dos processos ativos e remover os dados pessoais do aluno vinculados àquele estágio, preservando seu nome e as informações históricas do estágio sem excluir o perfil do aluno

### Requirement: Acesso do coordenador de curso aos estágios de seu curso

O sistema SHALL permitir que o Coordenador de Curso consulte, edite e exclua os estágios dos alunos de seu próprio curso, conforme as regras de autorização de exclusão.

#### Scenario: Listagem por curso

- **WHEN** o Coordenador de Curso abre a gestão de estágios
- **THEN** o sistema SHALL listar os estágios dos alunos de seu curso e não SHALL exibir estágios de alunos de outros cursos

#### Scenario: Edição de estágio de aluno do curso

- **WHEN** o Coordenador de Curso edita os dados de um estágio de um aluno de seu curso
- **THEN** o sistema SHALL persistir a alteração e registrar que a edição foi feita pelo coordenador, e não pelo aluno
