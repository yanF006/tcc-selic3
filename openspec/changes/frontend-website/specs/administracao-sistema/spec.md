## Purpose

Define as telas do Administrador para cadastro e gestão de alunos, coordenadores de estágio, coordenadores de curso, administradores, templates de documento e importação de matrículas do SIGAA.

## ADDED Requirements

### Requirement: Privilégio do administrador

O sistema SHALL conceder ao Administrador acesso a todas as áreas do sistema, incluindo as áreas de aluno, coordenação e gestão de usuários.

#### Scenario: Navegação do administrador

- **WHEN** um administrador entra no sistema
- **THEN** o sistema SHALL exibir a navegação com todas as áreas disponíveis

#### Scenario: Acesso a qualquer área

- **WHEN** o administrador abre a área de qualquer outro papel
- **THEN** o sistema SHALL exibir o conteúdo da área solicitada

### Requirement: Cadastro de alunos pelo administrador

O sistema SHALL permitir ao administrador cadastrar, editar e excluir alunos, informando os mesmos dados do cadastro do próprio aluno.

#### Scenario: Cadastro de aluno pelo administrador

- **WHEN** o administrador cadastra um aluno com matrícula, e-mail e dados pessoais válidos
- **THEN** o sistema SHALL gravar o cadastro e disponibilizar o acesso ao aluno

#### Scenario: Autorização de matrícula não registrada

- **WHEN** o administrador cadastra um aluno cuja matrícula não está registrada no sistema
- **THEN** o sistema SHALL permitir o cadastro mediante autorização explícita do administrador e registrar essa autorização

#### Scenario: E-mail já utilizado

- **WHEN** o administrador cadastra um aluno com e-mail já usado por outro usuário
- **THEN** o sistema SHALL recusar o cadastro e sinalizar que o e-mail já está em uso

### Requirement: Cadastro dos demais cargos pelo administrador

O sistema SHALL permitir ao administrador cadastrar, editar e excluir coordenadores de estágio, coordenadores de curso e administradores, informando nome, e-mail, curso, quando aplicável, e situação do cadastro.

#### Scenario: Cadastro de coordenador de curso

- **WHEN** o administrador cadastra um coordenador de curso informando o curso
- **THEN** o sistema SHALL gravar o cadastro com o papel de Coordenador de Curso vinculado ao curso informado

#### Scenario: Cadastro de administrador

- **WHEN** o administrador cadastra outro administrador
- **THEN** o sistema SHALL gravar o cadastro com o papel de Administrador e permitir que esse usuário acesse todas as áreas

#### Scenario: Cadastro sem cargo definido

- **WHEN** o administrador inicia o cadastro de um usuário de coordenação sem informar o papel
- **THEN** o sistema SHALL exigir a escolha do papel antes de concluir o cadastro

#### Scenario: Exclusão de coordenador ou administrador

- **WHEN** o administrador exclui um coordenador ou administrador
- **THEN** o sistema SHALL permitir a remoção dos dados pessoais e encerrar o acesso do usuário

### Requirement: Gestão de usuários por situação

O sistema SHALL permitir ao administrador listar usuários por papel e por situação, buscá-los por nome ou e-mail e inativar um cadastro sem excluí-lo.

#### Scenario: Lista por papel

- **WHEN** o administrador abre a gestão de usuários
- **THEN** o sistema SHALL listar os usuários e permitir filtrar por papel e por situação, exibindo o total de resultados

#### Scenario: Inativação de cadastro

- **WHEN** o administrador inativa o cadastro de um usuário
- **THEN** o sistema SHALL bloquear o acesso do usuário e preservar os registros que ele criou

### Requirement: Gerenciamento de templates de documento

O sistema SHALL permitir ao administrador cadastrar novas versões de template dos documentos, informando o arquivo do template e os campos de preenchimento correspondentes, e SHALL permitir inativar templates.

#### Scenario: Cadastro de nova versão de template

- **WHEN** o administrador cadastra um template com o arquivo e a definição dos campos de preenchimento
- **THEN** o sistema SHALL gravar a nova versão como vigente e disponibilizá-la para novos preenchimentos

#### Scenario: Nome e tipo de template

- **WHEN** o administrador cadastra um template
- **THEN** o sistema SHALL exigir o documento ao qual o template pertence e os campos de preenchimento, e recusar arquivos que não estejam no formato docx

#### Scenario: Histórico de versões

- **WHEN** o administrador consulta um documento com mais de uma versão de template
- **THEN** o sistema SHALL exibir as versões com a data de cadastro e indicar qual é a vigente

#### Scenario: Documentos preenchidos com versão anterior

- **WHEN** um documento foi preenchido com uma versão anterior do template
- **THEN** o sistema SHALL manter o preenchimento e a versão utilizados e não SHALL reaplicar os campos da nova versão

#### Scenario: Inativação de template

- **WHEN** o administrador inativa um template que possui documentos gerados
- **THEN** o sistema SHALL manter os documentos já gerados disponíveis e sinalizar a inatividade do template

### Requirement: Importação de matrículas do SIGAA

O sistema SHALL permitir ao administrador importar matrículas de aluno, enquanto não houver integração formal com o SIGAA, por meio de arquivo ou lançamento manual.

#### Scenario: Importação por arquivo

- **WHEN** o administrador envia um arquivo com matrículas e o sistema processa a importação
- **THEN** o sistema SHALL gravar as matrículas válidas, informar quantas foram importadas e listar as rejeitadas com o motivo

#### Scenario: Matrícula duplicada

- **WHEN** a importação contém uma matrícula já registrada
- **THEN** o sistema SHALL não duplicar o registro e informar a matrícula como ignorada

#### Scenario: Importação sem integração com o SIGAA

- **WHEN** o administrador importa matrículas
- **THEN** o sistema SHALL informar que a importação é manual e temporária, pois não há acesso oficial ao SIGAA

#### Scenario: Consulta de matrículas importadas

- **WHEN** o administrador abre a lista de matrículas
- **THEN** o sistema SHALL exibir as matrículas registradas com a origem do registro e o total importado