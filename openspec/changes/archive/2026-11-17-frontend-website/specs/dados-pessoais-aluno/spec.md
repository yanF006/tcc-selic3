## Purpose

Define os dados pessoais que o aluno informa e mantém no sistema, com máscaras, validações conforme a regulamentação brasileira e busca de endereço por CEP, usando esses dados no preenchimento automático dos documentos.

## ADDED Requirements

### Requirement: Campos do cadastro do aluno

O sistema SHALL coletar, na segunda etapa do cadastro, nome, data de nascimento, CPF, celular, CEP, endereço (logradouro, número, bairro, estado e cidade), curso, turma e período. RG, telefone e complemento do endereço SHALL ser opcionais.

#### Scenario: Cadastro com todos os campos obrigatórios preenchidos

- **WHEN** o aluno preenche todos os campos obrigatórios com valores válidos e os opcionais em branco
- **THEN** o sistema SHALL concluir o cadastro e associar os dados ao cadastro do aluno

#### Scenario: Campo obrigatório em branco

- **WHEN** o aluno deixa em branco um dos campos obrigatórios
- **THEN** o sistema SHALL bloquear a conclusão e sinalizar o campo correspondente

### Requirement: Máscaras de entrada

O sistema SHALL aplicar máscara de entrada aos campos que seguem padrão brasileiro: CPF, RG, celular, telefone, CEP e datas. O sistema SHALL impedir a digitação de caracteres não permitidos no campo.

#### Scenario: Digitação de CPF

- **WHEN** o aluno digita os números do CPF
- **THEN** o campo SHALL exibir os dígitos na máscara de CPF e recusar letras

#### Scenario: Digitação de datas

- **WHEN** o aluno digita uma data
- **THEN** o campo SHALL exibir a data no formato de dia, mês e ano e não SHALL aceitar texto não numérico

### Requirement: Validação de CPF

O sistema SHALL validar o CPF conforme os dígitos verificadores da regulamentação brasileira e SHALL recusar o cadastro quando o CPF for inválido.

#### Scenario: CPF válido

- **WHEN** o aluno informa um CPF cujos dígitos verificadores conferem
- **THEN** o sistema SHALL aceitar o valor e permitir o avanço da etapa

#### Scenario: CPF inválido

- **WHEN** o aluno informa um CPF com dígitos verificadores incorretos ou com todos os dígitos iguais
- **THEN** o sistema SHALL recusar o valor e sinalizar o erro no campo

### Requirement: Validação de e-mail, telefone e celular

O sistema SHALL validar o formato do e-mail e SHALL validar telefone e celular conforme DDD seguido de número, aceitando dez ou onze dígitos.

#### Scenario: E-mail válido

- **WHEN** o aluno informa um e-mail no formato válido
- **THEN** o sistema SHALL aceitar o valor como meio de contato e de identificação do usuário

#### Scenario: E-mail malformado

- **WHEN** o aluno informa um e-mail sem arroba ou sem domínio
- **THEN** o sistema SHALL recusar o valor e sinalizar o erro no campo

#### Scenario: Telefone sem DDD

- **WHEN** o aluno informa telefone sem código de área ou com número de dígitos inválido
- **THEN** o sistema SHALL recusar o valor e sinalizar o erro no campo

### Requirement: Busca de endereço por CEP

O sistema SHALL consultar o ViaCEP automaticamente quando o aluno informar um CEP válido de oito dígitos nos fluxos de entrada de endereço e SHALL permitir consulta explícita por botão. O sistema SHALL preencher logradouro, bairro, cidade e estado disponíveis e SHALL mantê-los editáveis, sem substituir número, complemento ou campos editados durante a consulta. Montagem e hidratação do perfil SHALL NOT iniciar consulta.

#### Scenario: CEP encontrado

- **WHEN** o aluno informa um CEP válido existente durante a entrada de endereço ou solicita explicitamente sua consulta
- **THEN** o sistema SHALL preencher os dados disponíveis de logradouro, bairro, cidade e estado, preservando campos não fornecidos e correções realizadas durante a espera

#### Scenario: CEP não encontrado

- **WHEN** o aluno informa um CEP inexistente
- **THEN** o sistema SHALL sinalizar que o CEP não foi encontrado e preservar os campos já preenchidos para edição manual

#### Scenario: Serviço externo indisponível

- **WHEN** a consulta falha, excede o limite de espera ou retorna resposta inutilizável
- **THEN** o sistema SHALL informar indisponibilidade, preservar os dados e permitir salvar o endereço manual quando válido

#### Scenario: Correção do endereço preenchido

- **WHEN** o aluno altera manualmente um campo preenchido pelo CEP
- **THEN** o sistema SHALL manter a alteração do aluno

### Requirement: Curso, turma e período selecionados entre os cadastrados

O sistema SHALL oferecer curso, turma e período exclusivamente a partir dos registros cadastrados, e a lista de turmas e períodos SHALL depender do curso escolhido. O sistema SHALL proibir a digitação livre nesses campos.

#### Scenario: Seleção do curso

- **WHEN** o aluno escolhe um curso no cadastro
- **THEN** o sistema SHALL habilitar a seleção de turma e período apenas com as turmas e os períodos vinculados a esse curso

#### Scenario: Troca de curso

- **WHEN** o aluno troca o curso após já ter escolhido turma e período
- **THEN** o sistema SHALL limpar a turma e o período antes de exigir nova seleção

#### Scenario: Valor não cadastrado

- **WHEN** o aluno tenta informar um curso, turma ou período que não está cadastrado
- **THEN** o sistema SHALL recusar o valor

### Requirement: Edição dos dados na tela de perfil

O sistema SHALL permitir que o aluno edite todos os dados informados no cadastro, com as mesmas máscaras e validações do cadastro.

#### Scenario: Edição válida

- **WHEN** o aluno altera um ou mais campos com valores válidos e salva
- **THEN** o sistema SHALL persistir a alteração e informar o sucesso da operação

#### Scenario: Edição com valor inválido

- **WHEN** o aluno salva uma alteração com algum campo inválido
- **THEN** o sistema SHALL recusar o salvamento e sinalizar todos os campos com erro

### Requirement: Matrícula imutável

O sistema SHALL exibir a matrícula do aluno em modo somente leitura na tela de perfil e na edição de dados, e SHALL proibir sua alteração.

#### Scenario: Tentativa de editar a matrícula

- **WHEN** o aluno tenta alterar o valor da matrícula
- **THEN** o sistema SHALL manter o valor original e não SHALL permitir a gravação de um novo valor

### Requirement: Uso dos dados para preenchimento automático

O sistema SHALL utilizar os dados cadastrados do aluno para preencher inicialmente os campos correspondentes dos documentos. A identificação SHALL permanecer somente para leitura, exceto os grupos de endereço, que SHALL permitir correção manual pelo usuário autorizado. Endereços já salvos no documento SHALL prevalecer sobre o cadastro e SHALL NOT ser substituídos na reabertura. A carga inicial SHALL NOT consultar o ViaCEP.

#### Scenario: Documento com dados do aluno

- **WHEN** o aluno abre o preenchimento de um documento que possui campos de identificação do estagiário
- **THEN** o sistema SHALL preencher a identificação com os dados cadastrados e SHALL mantê-la somente para leitura, permitindo a edição autorizada dos endereços sem ampliar as permissões dos demais campos
