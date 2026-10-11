## Purpose

Permite que os coordenadores e administradores pesquisem estágios por aluno, orientador, supervisor e instituição, apliquem filtros e acompanhem indicadores consolidados extraídos dos documentos preenchidos.

## ADDED Requirements

### Requirement: Pesquisa de estágios por filtros

O sistema SHALL permitir pesquisar estágios por aluno, orientador, supervisor e instituição, exibindo as mesmas informações que o aluno vê do próprio estágio, e SHALL exibir a quantidade de estágios de cada filtro.

#### Scenario: Pesquisa por aluno

- **WHEN** o coordenador pesquisa por nome de aluno
- **THEN** o sistema SHALL listar os estágios desse aluno com instituição, supervisor, orientador, datas e situação, e exibir o total

#### Scenario: Pesquisa por orientador

- **WHEN** o coordenador pesquisa por nome de orientador
- **THEN** o sistema SHALL listar os estágios orientados pela pessoa e exibir o total de estágios vinculados a ela

#### Scenario: Pesquisa por instituição

- **WHEN** o coordenador pesquisa por nome de instituição
- **THEN** o sistema SHALL listar os estágios realizados naquela instituição e exibir o total

#### Scenario: Pesquisa sem resultado

- **WHEN** a pesquisa não encontra estágios para o filtro informado
- **THEN** o sistema SHALL informar que não há resultados e manter os filtros visíveis para ajuste

### Requirement: Filtro de estágios concluídos

O sistema SHALL permitir filtrar os resultados de pesquisa para estágios concluídos, e o filtro SHALL poder ser combinado com os demais filtros.

#### Scenario: Aplicação do filtro de concluídos

- **WHEN** o coordenador aplica o filtro de estágios concluídos
- **THEN** o sistema SHALL exibir apenas estágios com situação concluído e SHALL informar quantos estágios foram considerados

#### Scenario: Filtro sem resultados

- **WHEN** o filtro de concluídos resulta em nenhum estágio
- **THEN** o sistema SHALL informar que não há estágios concluídos para os filtros informados

### Requirement: Consolidação por período

O sistema SHALL permitir filtrar os resultados por curso e por ano ou semestre, para comparar a distribuição dos estágios ao longo do tempo.

#### Scenario: Filtro por curso

- **WHEN** o coordenador aplica o filtro de curso
- **THEN** o sistema SHALL exibir apenas os estágios dos alunos do curso selecionado

#### Scenario: Filtro por ano e semestre

- **WHEN** o coordenador informa um ano e um semestre
- **THEN** o sistema SHALL exibir os estágios do período informado e ordená-los por data de início

### Requirement: Quantidade de horas por recorte

O sistema SHALL exibir o total de horas de estágio registrado por aluno, por curso, por turma e período e por instituição.

#### Scenario: Horas por aluno

- **WHEN** o coordenador consulta as horas de um aluno
- **THEN** o sistema SHALL exibir o total de horas registradas em todos os estágios do aluno

#### Scenario: Horas por instituição

- **WHEN** o coordenador consulta as horas de uma instituição
- **THEN** o sistema SHALL exibir o total de horas somadas de todos os estágios realizados naquela instituição

#### Scenario: Estágio sem horas lançadas

- **WHEN** um estágio não possui nenhum lançamento de horas
- **THEN** o sistema SHALL considerá-lo com zero horas no total, sem omiti-lo da contagem de estágios

### Requirement: Estágios por situação

O sistema SHALL exibir a quantidade de estágios em andamento e a quantidade de estágios concluídos.

#### Scenario: Painel de estágios por situação

- **WHEN** o coordenador abre a área de estatísticas
- **THEN** o sistema SHALL exibir as quantidades de estágios em andamento e concluídos

### Requirement: Convênios ativos e expirados

O sistema SHALL exibir a quantidade de convênios ativos e expirados.

#### Scenario: Painel de convênios

- **WHEN** o coordenador consulta os convênios nas estatísticas
- **THEN** o sistema SHALL exibir as quantidades por classificação e permitir abrir a lista de convênios correspondente

### Requirement: Documentos gerados por tipo

O sistema SHALL exibir a quantidade de documentos gerados por tipo de documento.

#### Scenario: Painel de documentos por tipo

- **WHEN** o coordenador consulta os documentos gerados
- **THEN** o sistema SHALL exibir a quantidade por tipo de documento, separando documentos em preenchimento de documentos aprovados, indeferidos e aguardando parecer

### Requirement: Aproveitamento de horas

O sistema SHALL exibir a taxa de aproveitamento de horas a partir dos requerimentos deferidos e indeferidos.

#### Scenario: Taxa de aproveitamento

- **WHEN** o coordenador consulta o aproveitamento de horas
- **THEN** o sistema SHALL exibir a quantidade de requerimentos deferidos, a de indeferidos e a proporção entre eles

### Requirement: Estágios sem parecer final

O sistema SHALL listar os estágios concluídos que possuem documentos sem parecer final e exibir o total de pendências.

#### Scenario: Estágios sem parecer final

- **WHEN** o coordenador consulta as pendências
- **THEN** o sistema SHALL listar os estágios concluídos que possuem documentos sem parecer final e o total de pendências

### Requirement: Restrição de visibilidade por papel

O sistema SHALL limitar as estatísticas e a pesquisa de estágios ao Coordenador de Estágio e ao Administrador em todo o campus, e ao Coordenador de Curso apenas aos alunos de seu curso.

#### Scenario: Estatísticas do campus

- **WHEN** o Coordenador de Estágio ou o Administrador abre as estatísticas
- **THEN** o sistema SHALL considerar todos os cursos e todos os alunos do campus

#### Scenario: Estatísticas do curso

- **WHEN** o Coordenador de Curso abre as estatísticas
- **THEN** o sistema SHALL calcular os indicadores apenas sobre os alunos de seu curso e sinalizar esse recorte no título do painel

### Requirement: Apresentação dos indicadores

O sistema SHALL apresentar os indicadores em visões de tabela e de gráfico, e cada indicador SHALL exibir o total que o originou e SHALL permitir abrir a lista dos registros que o compõem.

#### Scenario: Abrir a lista a partir do indicador

- **WHEN** o usuário seleciona um valor exibido em um indicador
- **THEN** o sistema SHALL abrir a lista dos registros que compõem aquele valor