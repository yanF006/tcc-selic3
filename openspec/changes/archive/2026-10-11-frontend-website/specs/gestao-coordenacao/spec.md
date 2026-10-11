## Purpose

Reúne as telas dos Coordenadores de Estágio e de Coordenadores de Curso para gerenciar convênios, cursos, turmas, orientadores, supervisores, estágios de alunos do curso, pareceres e o acesso aos documentos preenchidos.

## ADDED Requirements

### Requirement: Permissões do Coordenador de Estágio

O sistema SHALL conceder ao Coordenador de Estágio o cadastro e a gestão de convênios, cursos, orientadores, supervisores e templates de documento, além do acesso a todos os documentos preenchidos e às estatísticas extraídas desses documentos.

#### Scenario: Acesso do Coordenador de Estágio

- **WHEN** um Coordenador de Estágio entra no sistema
- **THEN** o sistema SHALL exibir a navegação com convênios, cursos, orientadores, supervisores, templates, documentos preenchidos, estágios e estatísticas

#### Scenario: Acesso a documento preenchido

- **WHEN** o Coordenador de Estágio abre um documento preenchido de qualquer aluno
- **THEN** o sistema SHALL exibir o documento, os dados do aluno, do estágio e a situação do documento

### Requirement: Permissões do Coordenador de Curso

O sistema SHALL conceder ao Coordenador de Curso o acesso aos documentos preenchidos por alunos de seu curso, o acesso às estatísticas desses alunos, o CRUD dos estágios desses alunos e a emissão de parecer sobre os documentos que exigem sua avaliação.

#### Scenario: Restrição ao próprio curso

- **WHEN** um Coordenador de Curso consulta documentos preenchidos
- **THEN** o sistema SHALL listar apenas documentos de alunos do seu curso e não SHALL exibir documentos de alunos de outros cursos

#### Scenario: Tentativa de acesso cruzado

- **WHEN** um Coordenador de Curso tenta abrir um documento preenchido de aluno de outro curso
- **THEN** o sistema SHALL recusar o acesso sem exibir o conteúdo do documento

### Requirement: Cadastro de convênios

O sistema SHALL permitir ao Coordenador de Estágio cadastrar os convênios do livro físico, informando a instituição, os dados do convênio e a classificação entre ativo e expirado.

#### Scenario: Cadastro de convênio ativo

- **WHEN** o Coordenador de Estágio cadastra um convênio e o classifica como ativo
- **THEN** o sistema SHALL gravar o convênio como ativo e disponibilizá-lo para escolha em novos estágios

#### Scenario: Convênio expirado

- **WHEN** o Coordenador de Estágio classifica um convênio como expirado
- **THEN** o sistema SHALL mantê-lo disponível para consulta, removê-lo da lista de escolha de novos estágios e preservar os estágios já vinculados

#### Scenario: Listagem e busca de convênios

- **WHEN** o Coordenador de Estágio abre a lista de convênios
- **THEN** o sistema SHALL exibir nome, classificação e quantidade de estágios vinculados, e permitir filtrar por classificação e buscar por nome

#### Scenario: Convênio vinculado ao Campus Pinheiral

- **WHEN** o Coordenador de Estágio cadastra um convênio
- **THEN** o sistema SHALL vinculá-lo ao Campus Pinheiral sem oferecer escolha de campus, pois o sistema atende exclusivamente a esse campus

### Requirement: Vigência e classificação do convênio

O sistema SHALL registrar a data de assinatura e a vigência do convênio, que é de 5 anos conforme o template oficial, e SHALL apresentar a classificação entre ativo e expirado.

#### Scenario: Convênio dentro da vigência

- **WHEN** o Coordenador de Estágio cadastra um convênio cuja data de assinatura está dentro do período de vigência
- **THEN** o sistema SHALL classificá-lo como ativo e informar a data de término da vigência

#### Scenario: Convênio fora da vigência

- **WHEN** a data atual ultrapassa a data de término da vigência do convênio
- **THEN** o sistema SHALL classificá-lo como expirado, removê-lo da lista de escolha de novos estágios e preservar os estágios já vinculados

#### Scenario: Contagem por classificação

- **WHEN** o Coordenador de Estágio consulta a lista de convênios
- **THEN** o sistema SHALL exibir as quantidades de convênios ativos e de convênios expirados

### Requirement: Cadastro de cursos, turmas e períodos

O sistema SHALL permitir ao Coordenador de Estágio cadastrar cursos e as turmas com seus períodos, e o sistema SHALL oferecer esses registros como opções no cadastro do aluno.

#### Scenario: Cadastro de turma com período

- **WHEN** o Coordenador de Estágio cadastra uma turma com um ou mais períodos
- **THEN** o sistema SHALL gravar a turma e seus períodos e disponibilizá-los como opções de seleção

#### Scenario: Vínculo de turma a curso

- **WHEN** o Coordenador de Estágio cadastra uma turma
- **THEN** o sistema SHALL exigir a associação dela a um curso e só disponibilizará a turma para o curso vinculado

### Requirement: Cadastro de orientadores e supervisores

O sistema SHALL permitir ao Coordenador de Estágio cadastrar, editar e excluir orientadores e supervisores, e os registros SHALL ser oferecidos como opções no cadastro de estágios.

#### Scenario: Cadastro de orientador

- **WHEN** o Coordenador de Estágio cadastra um orientador
- **THEN** o sistema SHALL gravar o registro e disponibilizá-lo na seleção de orientador do estágio

#### Scenario: Exclusão de supervisor

- **WHEN** o Coordenador de Estágio exclui um supervisor
- **THEN** o sistema SHALL removê-lo das seleções de novos estágios e remover seus dados pessoais, preservando a referência em estágios e documentos já registrados

### Requirement: Regras de integridade na gestão de cadastros

O sistema SHALL impedir a exclusão de um registro que seja dependente de outros e, nesses casos, SHALL permitir sua inativação, preservando o histórico de estágios e documentos. O sistema SHALL permitir a exclusão de aluno, orientador, supervisor, coordenador e administrador, ainda que os dados pessoais possam ser removidos.

#### Scenario: Exclusão de curso com vínculos

- **WHEN** o Coordenador de Estágio tenta excluir um curso que possui alunos, turmas, estágios ou documentos vinculados
- **THEN** o sistema SHALL recusar a exclusão e oferecer a inativação do curso

#### Scenario: Convênio com estágios vinculados

- **WHEN** o Coordenador de Estágio tenta excluir um convênio que possui estágios vinculados
- **THEN** o sistema SHALL recusar a exclusão e oferecer a classificação do convênio como expirado

#### Scenario: Template com documentos gerados

- **WHEN** o administrador tenta excluir um template que possui documentos gerados a partir dele
- **THEN** o sistema SHALL recusar a exclusão e oferecer a inativação do template

#### Scenario: Inativação com histórico preservado

- **WHEN** um registro com vínculos é inativado
- **THEN** o sistema SHALL mantê-lo disponível para consulta dos registros que dependem dele e sinalizar a inatividade

#### Scenario: Exclusão de aluno

- **WHEN** o responsável exclui um aluno
- **THEN** o sistema SHALL permitir a remoção dos dados pessoais do aluno e informar que os documentos existentes permanecem para consulta da coordenação

### Requirement: Gestão de estágios dos alunos do curso

O sistema SHALL permitir ao Coordenador de Curso consultar, editar e solicitar a exclusão dos estágios dos alunos de seu curso, respeitando a exigência de autorização de cargo superior para exclusões.

#### Scenario: Consulta por filtros

- **WHEN** o Coordenador de Curso abre a gestão de estágios
- **THEN** o sistema SHALL permitir filtrar por aluno, instituição, situação e período e exibir o total de resultados

#### Scenario: Exclusão sem autorização

- **WHEN** o Coordenador de Curso solicita a exclusão de um estágio
- **THEN** o sistema SHALL exigir autorização de cargo superior antes de concluir a exclusão

### Requirement: Fila de pareceres do coordenador

O sistema SHALL disponibilizar ao Coordenador de Curso os documentos de alunos de seu curso que aguardam parecer, e SHALL permitir registrar a decisão diretamente a partir dessa fila.

#### Scenario: Fila restrita ao curso

- **WHEN** o Coordenador de Curso abre a fila de pareceres
- **THEN** o sistema SHALL listar apenas os documentos de alunos do seu curso que aguardam sua avaliação

#### Scenario: Parecer registrado pela fila

- **WHEN** o Coordenador de Curso registra a decisão a partir da fila
- **THEN** o sistema SHALL registrar o parecer, atualizar a situação do documento e removê-lo da fila de pendências

### Requirement: Fila de pareceres da Comissão de Estágio

O sistema SHALL disponibilizar ao Coordenador de Estágio, na condição de membro da Comissão de Estágio, os Requerimentos para Aproveitamento de Horas que aguardam parecer.

#### Scenario: Fila da Comissão de Estágio

- **WHEN** o Coordenador de Estágio abre a fila da Comissão de Estágio
- **THEN** o sistema SHALL listar os requerimentos aguardando parecer e o total de horas solicitado em cada um

### Requirement: Busca de documentos preenchidos

O sistema SHALL permitir que os coordenadores pesquisem documentos preenchidos por aluno, orientador, supervisor e instituição, exibindo o total de resultados de cada pesquisa.

#### Scenario: Pesquisa por aluno

- **WHEN** o Coordenador de Estágio pesquisa por nome de aluno
- **THEN** o sistema SHALL exibir os documentos preenchidos desse aluno com o tipo de documento, a situação e o estágio associado

#### Scenario: Pesquisa sem resultado

- **WHEN** a pesquisa não encontra documentos
- **THEN** o sistema SHALL informar que não há resultados para o filtro informado