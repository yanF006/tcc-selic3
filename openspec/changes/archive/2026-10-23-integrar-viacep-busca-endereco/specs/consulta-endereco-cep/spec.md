## Purpose

Padronizar a coleta e a alteração de endereços por CEP em todos os formulários do SELic, usando o ViaCEP como auxílio ao preenchimento e preservando a edição manual. Os formulários de documentos usam primeiro os dados cadastrados no banco e consultam o ViaCEP somente durante uma alteração solicitada pelo aluno.

## ADDED Requirements

### Requirement: CEP disponível em todos os grupos de endereço

O sistema SHALL solicitar CEP em todos os formulários que coletam endereço, incluindo cadastro, perfil e formulários de documentos. Quando um formulário contiver mais de um endereço, cada grupo SHALL possuir seu próprio CEP e seus campos correspondentes, identificados de forma que o usuário possa distinguir os endereços.

#### Scenario: Formulário com um endereço

- **WHEN** o usuário acessa um formulário que solicita endereço
- **THEN** o sistema SHALL apresentar o campo CEP associado aos demais campos desse endereço

#### Scenario: Formulário com endereços distintos

- **WHEN** um documento solicita o endereço do aluno e o endereço do local de estágio
- **THEN** o sistema SHALL apresentar um CEP para cada endereço e identificar a qual grupo cada campo pertence

### Requirement: Dados do banco como fonte inicial dos documentos

Ao abrir um formulário de documento, o sistema SHALL consultar primeiro os dados cadastrados no banco para preencher os endereços correspondentes. A carga inicial desses dados SHALL NOT disparar consulta ao ViaCEP, mesmo quando houver um CEP válido. A ausência de dados cadastrados SHALL NOT disparar uma consulta externa por conta própria; o formulário SHALL permitir o preenchimento ou a alteração conforme as permissões do usuário.

#### Scenario: Endereço cadastrado com CEP válido

- **WHEN** o aluno abre um documento cujo endereço correspondente está cadastrado no banco
- **THEN** o sistema SHALL exibir o CEP e os campos de endereço provenientes desse cadastro
- **AND** o sistema SHALL NOT consultar o ViaCEP durante a carga inicial

#### Scenario: Endereço ausente ou incompleto no cadastro

- **WHEN** o aluno abre um documento e o banco não possui todos os campos do endereço correspondente
- **THEN** o sistema SHALL apresentar os dados disponíveis e permitir completar os campos no fluxo de edição autorizado
- **AND** o sistema SHALL NOT consultar o ViaCEP apenas para completar a carga inicial

### Requirement: Consulta ao ViaCEP condicionada à entrada ou alteração do endereço

Nos fluxos de entrada de endereço, como o cadastro, o sistema SHALL consultar o ViaCEP automaticamente quando o usuário informar um CEP válido de oito dígitos. Nos formulários de documentos, a consulta SHALL ocorrer somente quando o aluno solicitar a alteração do endereço e informar ou alterar o CEP, ou solicitar explicitamente a consulta durante essa edição. Abrir o documento, iniciar a edição sem consultar ou alterar o CEP, ou editar apenas outro campo SHALL NOT disparar consulta ao ViaCEP.

#### Scenario: Entrada de CEP no cadastro

- **WHEN** o usuário informa um CEP válido durante o preenchimento de um novo endereço no cadastro
- **THEN** o sistema SHALL iniciar automaticamente a consulta desse CEP ao ViaCEP

#### Scenario: Alteração de CEP no documento

- **WHEN** o aluno solicita alterar o endereço de um documento e informa um novo CEP válido
- **THEN** o sistema SHALL consultar o ViaCEP para o CEP informado

#### Scenario: Consulta explícita do CEP atual

- **WHEN** o aluno está editando o endereço de um documento e solicita explicitamente a consulta do CEP válido já presente no campo
- **THEN** o sistema SHALL consultar o ViaCEP para esse CEP

#### Scenario: Edição de endereço sem consulta externa

- **WHEN** o aluno inicia a edição do endereço e altera apenas logradouro, número, complemento, bairro, cidade ou estado, sem alterar o CEP nem solicitar sua consulta
- **THEN** o sistema SHALL preservar a alteração manual sem consultar o ViaCEP

### Requirement: Validação e apresentação do CEP

O sistema SHALL apresentar o CEP com a máscara `00000-000` e SHALL aceitar a entrada dos oito dígitos com ou sem a máscara. Antes de consultar o ViaCEP, o sistema SHALL validar que o CEP contém oito dígitos. Uma tentativa de consulta com CEP inválido SHALL ser sinalizada sem chamada externa e sem apagar os campos de endereço já preenchidos.

#### Scenario: CEP informado sem máscara

- **WHEN** o usuário informa os oito dígitos de um CEP sem separadores
- **THEN** o sistema SHALL apresentar o valor com a máscara de CEP e permitir sua consulta

#### Scenario: CEP incompleto

- **WHEN** o usuário tenta consultar um CEP com menos de oito dígitos
- **THEN** o sistema SHALL informar que o CEP é inválido, preservar os demais campos e não realizar consulta externa

### Requirement: Preenchimento automático dos campos disponíveis

Quando o ViaCEP encontrar o CEP consultado, o sistema SHALL preencher logradouro, bairro, cidade e estado com os dados disponíveis na resposta e SHALL mantê-los editáveis. A consulta SHALL NOT preencher nem substituir número e complemento. Campos ausentes ou vazios na resposta SHALL permanecer disponíveis para preenchimento manual e SHALL NOT apagar valores já informados pelo usuário.

#### Scenario: Resposta com endereço completo

- **WHEN** a consulta retorna logradouro, bairro, cidade e estado para o CEP atual
- **THEN** o sistema SHALL preencher esses campos e permitir sua edição manual
- **AND** o sistema SHALL preservar o número e o complemento existentes

#### Scenario: Resposta parcial para o CEP

- **WHEN** o ViaCEP encontra o CEP, mas não retorna logradouro ou bairro
- **THEN** o sistema SHALL preencher somente os dados disponíveis e permitir completar os demais manualmente
- **AND** o sistema SHALL preservar os valores existentes nos campos não fornecidos pela resposta

### Requirement: Edição manual e preservação dos valores salvos

O sistema SHALL permitir que o usuário autorizado edite manualmente os campos de endereço antes e depois da consulta ao ViaCEP. Nos documentos, essa permissão SHALL incluir os campos de endereço inicialmente preenchidos com dados do aluno, sem ampliar as permissões de acesso ao documento ou de edição dos demais campos. Ao salvar, o sistema SHALL utilizar os valores finais do formulário e SHALL preservá-los ao reabrir o registro salvo, sem substituí-los por uma nova consulta externa ou pelo endereço original do cadastro.

#### Scenario: Correção manual após consulta

- **WHEN** o aluno altera um campo preenchido pelo ViaCEP e salva o documento com dados válidos
- **THEN** o sistema SHALL salvar o valor corrigido e exibi-lo ao reabrir esse documento
- **AND** o sistema SHALL NOT substituí-lo automaticamente pelo valor do ViaCEP ou pelo endereço original do cadastro

#### Scenario: Preenchimento inteiramente manual

- **WHEN** o usuário preenche manualmente o CEP e os campos de endereço com valores válidos sem obter uma resposta bem-sucedida do ViaCEP e salva o formulário
- **THEN** o sistema SHALL aceitar os dados conforme as validações e permissões do formulário

#### Scenario: Usuário sem permissão de preenchimento do documento

- **WHEN** um usuário sem permissão de preenchimento tenta alterar o endereço de um documento
- **THEN** o sistema SHALL recusar a alteração conforme as permissões existentes, mesmo que o usuário conheça um CEP válido

### Requirement: Estados de consulta e continuidade diante de falhas

O sistema SHALL informar quando uma consulta estiver em andamento e distinguir CEP inválido, CEP não encontrado e indisponibilidade do serviço. CEP não encontrado, falha de comunicação ou resposta inutilizável SHALL NOT apagar os dados já preenchidos nem impedir a edição manual. O salvamento SHALL continuar disponível quando os campos atenderem às validações do formulário, independentemente do sucesso da consulta externa.

#### Scenario: Consulta em andamento

- **WHEN** uma consulta ao ViaCEP foi iniciada e ainda não terminou
- **THEN** o sistema SHALL apresentar um indicador de consulta em andamento associado ao endereço consultado

#### Scenario: CEP não encontrado

- **WHEN** o ViaCEP informa que o CEP consultado não foi encontrado
- **THEN** o sistema SHALL informar esse resultado, encerrar o estado de carregamento e preservar os campos para preenchimento manual

#### Scenario: Serviço indisponível ou resposta inutilizável

- **WHEN** a consulta falha por indisponibilidade, demora além do limite de espera ou retorna uma resposta inutilizável
- **THEN** o sistema SHALL informar que a consulta não pôde ser concluída e encerrar o estado de carregamento
- **AND** o sistema SHALL preservar os valores existentes e permitir salvar o preenchimento manual válido

### Requirement: Proteção contra respostas desatualizadas

O sistema SHALL aplicar uma resposta de consulta somente ao endereço e ao CEP que ainda correspondam à solicitação. Respostas atrasadas SHALL NOT sobrescrever alterações manuais realizadas após o início da consulta, dados de um novo CEP ou o estado de uma consulta mais recente.

#### Scenario: CEP alterado antes da chegada da resposta

- **WHEN** o usuário troca o CEP de um endereço enquanto a consulta anterior está em andamento e a resposta anterior chega depois
- **THEN** o sistema SHALL ignorar essa resposta para o preenchimento e preservar o CEP e os dados mais recentes

#### Scenario: Correção manual durante a consulta

- **WHEN** o usuário altera manualmente um campo de endereço depois do início da consulta e antes da chegada da resposta
- **THEN** o sistema SHALL preservar a alteração manual desse campo ao receber a resposta

### Requirement: Independência entre endereços do mesmo formulário

O sistema SHALL manter independentes as consultas, os campos, as mensagens e os estados de carregamento de cada grupo de endereço. Consultar ou editar um endereço SHALL NOT alterar os valores ou o estado de outro endereço do mesmo formulário.

#### Scenario: Consulta de um endereço entre vários

- **WHEN** o aluno consulta o CEP do local de estágio em um documento que também contém o endereço do aluno
- **THEN** o sistema SHALL atualizar somente os campos e o estado do endereço do local de estágio

#### Scenario: Consultas simultâneas com resultados diferentes

- **WHEN** dois endereços do mesmo formulário são consultados e um CEP é encontrado enquanto o outro não é
- **THEN** o sistema SHALL associar o preenchimento e a mensagem de erro aos respectivos endereços, sem misturar os resultados

### Requirement: Cobertura automatizada dos fluxos de endereço

A funcionalidade SHALL possuir testes automatizados unitários da consulta, de integração em todos os formulários e grupos de endereço identificados e E2E dos fluxos de uso. Os testes SHALL controlar as respostas externas para não depender da disponibilidade real do ViaCEP e SHALL verificar os comportamentos definidos nesta especificação, incluindo prioridade dos dados do banco, edição manual, salvamento, falhas, respostas atrasadas e independência entre endereços.

#### Scenario: Verificação da prioridade dos dados persistidos

- **WHEN** os testes abrem um formulário de documento com um endereço previamente cadastrado no banco
- **THEN** eles SHALL verificar a exibição desses valores e a ausência de consulta ao ViaCEP na carga inicial

#### Scenario: Verificação do fluxo completo de alteração

- **WHEN** os testes E2E executam a alteração de um endereço de documento por CEP, uma correção manual, o salvamento e a reabertura
- **THEN** eles SHALL verificar a consulta condicionada à edição, o preenchimento automático e a preservação do valor corrigido ao reabrir

#### Scenario: Verificação de todas as integrações de endereço

- **WHEN** os testes de integração dos formulários e grupos de endereço identificados são executados
- **THEN** eles SHALL verificar a associação correta entre CEP e campos de destino em cada integração, incluindo documentos com mais de um endereço

#### Scenario: Verificação independente da disponibilidade externa

- **WHEN** a suíte cobre sucesso, CEP inválido, CEP inexistente, resposta parcial, indisponibilidade, resposta inutilizável e respostas fora de ordem
- **THEN** esses resultados SHALL ser controlados pelos testes, sem depender de chamadas reais ao ViaCEP
- **AND** os testes SHALL verificar a continuidade do preenchimento manual e a proteção dos dados já informados
