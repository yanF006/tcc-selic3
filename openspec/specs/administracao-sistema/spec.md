# Administração do sistema

## Purpose

Define as telas do Administrador para cadastro e gestão de alunos, coordenadores de estágio, coordenadores de curso, administradores e importação de matrículas do SIGAA, com alterações duráveis e visíveis em qualquer instância.

## Requirements

### Requirement: Privilégio do administrador

O sistema SHALL conceder ao Administrador acesso a todas as áreas do sistema, incluindo as áreas de aluno, coordenação e gestão de usuários.

#### Scenario: Navegação do administrador

- **WHEN** um administrador entra no sistema
- **THEN** o sistema SHALL exibir a navegação com todas as áreas disponíveis

#### Scenario: Acesso a qualquer área

- **WHEN** o administrador abre a área de qualquer outro papel
- **THEN** o sistema SHALL exibir o conteúdo da área solicitada

### Requirement: Cadastro de alunos pelo administrador

O sistema SHALL permitir ao administrador cadastrar, editar e excluir alunos, informando os mesmos dados do cadastro do próprio aluno. Quando a matrícula informada ainda não constar do registro, o sistema SHALL registrá-la e criar a conta ativa como uma única operação, respeitando a vinculação de cada matrícula a no máximo uma conta. O titular SHALL estabelecer a própria senha pelo fluxo de definição de senha, sem senha de demonstração.

#### Scenario: Cadastro de aluno pelo administrador

- **WHEN** o administrador cadastra um aluno com matrícula, e-mail e dados pessoais válidos
- **THEN** o sistema SHALL gravar o cadastro, disponibilizar o perfil em qualquer instância e oferecer ao titular o estabelecimento de senha

#### Scenario: Matrícula registrada no cadastro do aluno

- **WHEN** o administrador cadastra um aluno cuja matrícula ainda não está registrada
- **THEN** o sistema SHALL registrar a matrícula com a origem do cadastro de administrador e liberar o acesso do aluno

#### Scenario: Matrícula já registrada

- **WHEN** o administrador cadastra um aluno com matrícula registrada e ainda sem conta vinculada
- **THEN** o sistema SHALL manter o registro existente sem duplicá-lo e liberar o acesso do aluno

#### Scenario: Matrícula já vinculada a outra conta

- **WHEN** o administrador cadastra um aluno com matrícula já vinculada a outra conta
- **THEN** o sistema SHALL recusar o cadastro sem criar conta nem alterar a conta existente

#### Scenario: E-mail já utilizado

- **WHEN** o administrador cadastra um aluno com e-mail já usado por outro usuário
- **THEN** o sistema SHALL recusar o cadastro e sinalizar que o e-mail já está em uso

#### Scenario: Falha no cadastro administrativo

- **WHEN** ocorre falha ao persistir parte do cadastro que criaria matrícula e conta
- **THEN** o sistema SHALL informar a falha sem deixar matrícula ou conta nova resultante de uma operação parcialmente aplicada

### Requirement: Cadastro dos demais cargos pelo administrador

O sistema SHALL permitir ao administrador cadastrar, editar e excluir coordenadores de estágio, coordenadores de curso e administradores, informando nome, e-mail, um único cargo, curso, quando aplicável, e situação do cadastro. Formulários e perfis SHALL apresentar um único cargo, sem seleção múltipla. Alterações de cargo ou curso SHALL valer nas requisições protegidas seguintes, em qualquer instância.

#### Scenario: Cadastro de coordenador de curso

- **WHEN** o administrador cadastra um coordenador de curso informando o curso
- **THEN** o sistema SHALL gravar o cadastro com o cargo de Coordenador de Curso vinculado ao curso informado

#### Scenario: Cadastro de administrador

- **WHEN** o administrador cadastra outro administrador
- **THEN** o sistema SHALL gravar o cadastro com o cargo de Administrador e permitir que esse usuário acesse todas as áreas

#### Scenario: Cadastro sem cargo definido

- **WHEN** o administrador inicia o cadastro de um usuário de coordenação sem informar o cargo
- **THEN** o sistema SHALL exigir a escolha do cargo antes de concluir o cadastro

#### Scenario: Alteração de cargo ou curso

- **WHEN** a administração conclui uma alteração autorizada de cargo ou curso de uma conta
- **THEN** as requisições protegidas seguintes SHALL aplicar o cargo e o vínculo atualizados, sem acumular permissões anteriores

#### Scenario: Exclusão de coordenador ou administrador

- **WHEN** o administrador exclui um coordenador ou administrador
- **THEN** o sistema SHALL permitir a remoção dos dados pessoais e encerrar o acesso do usuário

### Requirement: Gestão de usuários por situação

O sistema SHALL permitir ao administrador listar usuários por cargo, por situação e por curso, buscá-los por nome, e-mail ou matrícula, abrir o perfil completo de um cadastro e inativá-lo sem excluí-lo.

#### Scenario: Lista por papel

- **WHEN** o administrador abre a gestão de usuários
- **THEN** o sistema SHALL listar os usuários e permitir filtrar por cargo, por situação e por curso, exibindo o total de resultados

#### Scenario: Filtro por curso

- **WHEN** o administrador filtra a lista por um curso
- **THEN** o sistema SHALL mostrar somente os cadastros cujo curso efetivo corresponde ao filtro, contando o vínculo do aluno e o do coordenador de curso

#### Scenario: Perfil completo do cadastro

- **WHEN** o administrador abre o perfil completo de um cadastro
- **THEN** o sistema SHALL exibir situação, cargo, matrícula, curso, turma, período, contato e endereço registrados

#### Scenario: Inativação de cadastro

- **WHEN** o administrador inativa o cadastro de um usuário
- **THEN** o sistema SHALL bloquear o acesso do usuário e preservar os registros que ele criou

### Requirement: Importação de matrículas do SIGAA

O sistema SHALL permitir ao administrador registrar matrículas de aluno, enquanto não houver integração formal com o SIGAA, por arquivo CSV ou lançamento manual. Cada registro SHALL guardar matrícula, nome, curso, origem e data, mantendo distinto o registro que autoriza o cadastro do vínculo da matrícula com uma conta. Uma matrícula já registrada SHALL NOT ser duplicada, inclusive em operações concorrentes.

#### Scenario: Importação por arquivo

- **WHEN** o administrador envia um arquivo com matrículas e o sistema processa a importação
- **THEN** o sistema SHALL gravar as matrículas válidas e informar as aceitas, as ignoradas e as rejeitadas com o motivo

#### Scenario: Lançamento manual de matrícula

- **WHEN** o administrador lança uma matrícula de onze dígitos, com nome e curso
- **THEN** o sistema SHALL gravar a matrícula como válida e registrar a origem do lançamento

#### Scenario: Matrícula duplicada

- **WHEN** a importação ou o lançamento manual contém uma matrícula já registrada, inclusive em duas operações simultâneas
- **THEN** o sistema SHALL manter um único registro, sem sobrescrevê-lo, e informar a matrícula como ignorada

#### Scenario: Matrícula registrada mas ainda sem conta

- **WHEN** uma matrícula é registrada e um aluno inicia o cadastro em outra instância
- **THEN** o sistema SHALL identificá-la como registrada e permitir seu uso enquanto não existir conta vinculada

#### Scenario: Registro de matrícula sem integração com o SIGAA

- **WHEN** o administrador importa ou lança matrículas
- **THEN** o sistema SHALL informar que o registro é manual e temporário, pois não há acesso oficial ao SIGAA, e que a matrícula registrada é a que libera o cadastro do aluno

#### Scenario: Consulta de matrículas importadas

- **WHEN** o administrador abre a lista de matrículas
- **THEN** o sistema SHALL exibir as matrículas registradas com a origem do registro e o total importado
