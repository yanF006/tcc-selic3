## Purpose

Define como as telas que dependem do banco de dados se comportam durante a espera, a indisponibilidade e a recuperação, garantindo que o que aparece na tela seja atual, completo e identificado como real.

## ADDED Requirements

### Requirement: Carregamento explícito de dados remotos

Toda tela que lê informações do banco de dados SHALL apresentar um estado de carregamento enquanto a leitura estiver pendente. O estado de carregamento SHALL NOT ser confundido com lista vazia, lista parcial ou ausência de registros.

#### Scenario: Leitura lenta

- **WHEN** uma tela dependente do banco é aberta e a leitura ainda não terminou
- **THEN** o sistema SHALL exibir um estado de carregamento identificável até que a leitura seja concluída ou falhe

#### Scenario: Lista vazia é diferente de carregando

- **WHEN** a leitura termina com sucesso e não há registros
- **THEN** o sistema SHALL exibir o estado vazio próprio da tela, e não o indicador de carregamento

### Requirement: Indisponibilidade do banco visível e recuperável

Quando o banco estiver configurado e a leitura falhar, a tela SHALL exibir uma mensagem de indisponibilidade com ação de tentar novamente. A tela SHALL NOT exibir fixtures, dados parciais ou uma lista vazia como se a consulta tivesse sido concluída. A nova tentativa SHALL ser possível sem recarregar a aplicação inteira.

#### Scenario: Falha ao listar usuários

- **WHEN** o administrador abre a lista de usuários e a leitura do banco falha
- **THEN** a tela SHALL informar que os dados estão indisponíveis e SHALL oferecer nova tentativa, sem listar as contas padrão

#### Scenario: Nova tentativa bem-sucedida

- **WHEN** o usuário aciona a nova tentativa e o banco volta a responder
- **THEN** a tela SHALL substituir o estado de erro pelos dados atuais

#### Scenario: Erro preservado durante a falha

- **WHEN** a leitura falha repetidamente
- **THEN** a tela SHALL manter a mensagem de indisponibilidade e SHALL NOT alternar para dados fictícios

### Requirement: Resultados completos nas listas

Filtros, busca e paginação de telas alimentadas pelo banco SHALL considerar todo o conjunto persistido, e não apenas um recorte carregado previamente. O sistema SHALL NOT impor um limite silencioso que torne registros inalcançáveis pela interface.

#### Scenario: Busca alcança registro fora da primeira página

- **WHEN** o administrador busca um usuário que não estaria entre os primeiros registros da listagem
- **THEN** a busca SHALL encontrar o usuário e exibir o resultado

#### Scenario: Total corresponde ao conjunto consultado

- **WHEN** a tela informa o total de usuários encontrados
- **THEN** o total SHALL corresponder ao conjunto completo que atende aos filtros, e a paginação SHALL permitir percorrer todos os registros

### Requirement: Operações de escrita com estado pendente e erro

Server Actions que alteram dados persistidos SHALL indicar que a operação está em andamento, SHALL impedir envio duplicado enquanto pendente e SHALL exibir erro recuperável quando a gravação falhar, sem deixar a interface em estado de sucesso.

#### Scenario: Cadastro de usuário em andamento

- **WHEN** o administrador confirma o cadastro de um usuário
- **THEN** o formulário SHALL indicar o processamento e SHALL impedir uma segunda confirmação até a conclusão

#### Scenario: Falha ao gravar

- **WHEN** a gravação do usuário falha por indisponibilidade do banco
- **THEN** o sistema SHALL exibir a falha no formulário e SHALL NOT anunciar o cadastro como concluído

### Requirement: Cobertura automatizada dos estados remotos

A funcionalidade SHALL possuir testes automatizados que distingam simulação sem banco, carregamento, sucesso, falha, nova tentativa e resultados completos. Os testes SHALL NOT depender da disponibilidade real do Aiven nem exibir credenciais.

#### Scenario: Suíte cobre falha e recuperação

- **WHEN** os testes automatizados são executados
- **THEN** eles SHALL verificar que uma falha de banco não produz fixtures, que o carregamento é exibido e que a nova tentativa recupera os dados
