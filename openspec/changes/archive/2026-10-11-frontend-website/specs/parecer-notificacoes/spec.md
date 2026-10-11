## Purpose

Governa a submissão de documentos a parecer, o registro do parecer de usuários do sistema, a notificação na interface, e o envio por e-mail dos documentos que dependem de assinaturas de responsáveis externos.

## ADDED Requirements

### Requirement: Identificação dos documentos que exigem parecer

O sistema SHALL associar a cada template a existência de parecer, o responsável pelo parecer e se o responsável é usuário do sistema ou pessoa externa.

#### Scenario: Documento que exige parecer de usuário do sistema

- **WHEN** o aluno preenche o Formulário de Liberação
- **THEN** o sistema SHALL identificar que o parecer é do Coordenador de Curso e que ele é usuário do sistema

#### Scenario: Documento que exige parecer de pessoa externa

- **WHEN** o aluno preenche o Relatório Semestral de Estágio
- **THEN** o sistema SHALL identificar que o parecer é do professor orientador e que ele não é usuário do sistema

#### Scenario: Documento sem parecer

- **WHEN** o aluno preenche o Plano de Atividades de Estágio
- **THEN** o sistema SHALL identificar que o documento não exige parecer e não SHALL solicitar submissão

### Requirement: Submissão do documento a parecer

O sistema SHALL permitir que o aluno submeta a parecer o documento preenchido que exige avaliação, e o documento SHALL passar à situação de submetido a parecer e o responsável SHALL ser notificado.

#### Scenario: Submissão pelo aluno

- **WHEN** o aluno submete a parecer um documento preenchido que exige avaliação
- **THEN** o sistema SHALL registrar a submissão com data e responsável, alterar a situação do documento e notificar o responsável

#### Scenario: Documento incompleto

- **WHEN** o aluno tenta submeter a parecer um documento com campos obrigatórios em branco
- **THEN** o sistema SHALL recusar a submissão e sinalizar os campos pendentes

#### Scenario: Documento sem parecer exigido

- **WHEN** o usuário tenta submeter a parecer um documento que não exige parecer
- **THEN** o sistema SHALL recusar a operação e informar que o documento não está sujeito a parecer

### Requirement: Situação do documento

O sistema SHALL apresentar, para cada documento preenchido, uma situação entre rascunho, submetido a parecer, em análise, aprovado e indeferido.

#### Scenario: Documento em preenchimento

- **WHEN** o aluno salvou um preenchimento sem submeter a parecer
- **THEN** o sistema SHALL apresentar o documento com a situação de rascunho

#### Scenario: Documento aprovado

- **WHEN** o responsável registra um parecer de aprovação
- **THEN** o sistema SHALL alterar a situação do documento para aprovado e registrar autor, data e considerações

#### Scenario: Documento indeferido

- **WHEN** o responsável registra um parecer de indeferimento
- **THEN** o sistema SHALL alterar a situação do documento para indeferido e registrar autor, data e o motivo informado

### Requirement: Parecer de usuário do sistema

O sistema SHALL permitir que o responsável que é usuário do sistema registre o parecer com a decisão de aprovar, indeferir e as considerações, e o parecer SHALL ser exibido ao aluno.

#### Scenario: Coordenador de Curso analisa o Formulário de Liberação

- **WHEN** o Coordenador de Curso do aluno acessa a fila de pareceres e registra o parecer do Formulário de Liberação
- **THEN** o sistema SHALL gravar autor, data, decisão e considerações e torná-lo visível ao aluno

#### Scenario: Comissão de Estágio analisa o Requerimento de Aproveitamento de Horas

- **WHEN** o Coordenador de Estágio, na condição de membro da Comissão de Estágio, registra o parecer do Requerimento para Aproveitamento de Horas
- **THEN** o sistema SHALL gravar o parecer e vinculá-lo à Comissão de Estágio

#### Scenario: Parecer sem considerações

- **WHEN** o responsável registra a decisão de aprovar sem informar considerações
- **THEN** o sistema SHALL aceitar o parecer e armazenar a decisão sem considerações

#### Scenario: Decisão ausente

- **WHEN** o responsável tenta registrar o parecer sem escolher entre aprovar e indeferir
- **THEN** o sistema SHALL recusar o registro e exigir a decisão

### Requirement: Notificação de parecer na interface

O sistema SHALL sinalizar na interface, para o usuário autenticado, a existência de pareceres e solicitações que aguardam sua ação.

#### Scenario: Sinalização de pendência

- **WHEN** um Coordenador de Curso possui documentos aguardando parecer
- **THEN** o sistema SHALL exibir a contagem de pendências na navegação e disponibilizar a fila de pareceres

#### Scenario: Acesso à fila

- **WHEN** o responsável abre a fila de pareceres
- **THEN** o sistema SHALL listar os documentos que aguardam a decisão dele, com aluno, documento e estágio associados

#### Scenario: Aluno notificado de decisão

- **WHEN** o parecer de um documento do aluno é registrado
- **THEN** o sistema SHALL sinalizar ao aluno que existe um parecer novo para aquele documento

### Requirement: Parecer de responsável externo

O sistema SHALL enviar por e-mail o documento preenchido ao responsável externo que não é usuário do sistema, com o documento em anexo, para que o parecer seja obtido fora do sistema.

#### Scenario: Envio para o professor orientador

- **WHEN** o aluno submete a parecer o Relatório Semestral e o professor orientador possui e-mail cadastrado
- **THEN** o sistema SHALL enviar o e-mail com o documento em anexo ao professor orientador e registrar o envio

#### Scenario: E-mail do responsável externo indisponível

- **WHEN** o aluno submete a parecer um documento cujo responsável externo não possui e-mail cadastrado
- **THEN** o sistema SHALL notificar o aluno de que o e-mail está indisponível e de que ele deve obter a resposta pelo meio convencional

#### Scenario: Responsável externo sem cadastro de e-mail

- **WHEN** o aluno informa um responsável externo sem e-mail
- **THEN** o sistema SHALL recusar o envio por e-mail e oferecer a notificação ao aluno

### Requirement: Envio de documento para assinatura externa

O sistema SHALL enviar, exclusivamente por e-mail e como anexo, o documento que precisa de assinatura de supervisor, orientador, concedente ou convenente, sem oferecer assinatura eletrônica.

#### Scenario: Envio do Termo de Compromisso

- **WHEN** o aluno envia o Termo de Compromisso para assinatura
- **THEN** o sistema SHALL enviar o documento em anexo ao concedente e SHALL registrar o envio com data e destinatário

#### Scenario: Assinatura externa fora do sistema

- **WHEN** um assinante externo recebe o documento
- **THEN** o sistema SHALL oferecer apenas o envio do arquivo, sem opção de assinatura eletrônica

#### Scenario: Confirmação do envio

- **WHEN** o usuário visualiza um documento enviado para assinatura
- **THEN** o sistema SHALL informar a data do envio, o destinatário e que a assinatura é feita fora do sistema

#### Scenario: Reenvio do documento

- **WHEN** o usuário reenvia um documento para assinatura
- **THEN** o sistema SHALL registrar um novo envio, preservando o histórico dos envios anteriores

### Requirement: Registro do envio

O sistema SHALL registrar quem enviou o documento, quando, para quem e com qual resultado, e o registro SHALL ser exibido ao aluno e ao coordenador.

#### Scenario: Consulta do histórico de envios

- **WHEN** o aluno consulta o documento enviado
- **THEN** o sistema SHALL exibir a lista de envios com autor, data, destinatário e resultado

#### Scenario: Falha no envio

- **WHEN** o envio por e-mail não é concluído
- **THEN** o sistema SHALL registrar a falha, manter o documento como não enviado e informar o erro ao usuário, mantendo a possibilidade de tentar novamente