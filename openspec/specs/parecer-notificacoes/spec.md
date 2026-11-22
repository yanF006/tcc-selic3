# Parecer, acompanhamento e envios

## Purpose

Governa a submissão e a correção de documentos sujeitos a parecer, o acompanhamento de pendências e resultados nas situações e filas, o envio da documentação inicial para assinaturas após parecer favorável e os demais envios externos previstos no Kit, com registros duráveis. Não há central de notificações nesta entrega.

## Requirements

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

#### Scenario: Parecer na documentação inicial

- **WHEN** o sistema prepara o Formulário de Liberação, o Termo de Compromisso e o Plano de Atividades de uma solicitação
- **THEN** o sistema SHALL exigir parecer apenas no Formulário de Liberação e SHALL tratar as assinaturas do Termo e do Plano como assinaturas, sem submetê-los a parecer

### Requirement: Encaminhamento da solicitação de estágio

O sistema SHALL permitir ao aluno solicitar o encaminhamento dos três documentos iniciais preenchidos. Essa ação SHALL encaminhar somente o Formulário de Liberação para parecer do Coordenador de Curso, mantendo o envio dos documentos para assinaturas bloqueado até o parecer favorável.

#### Scenario: Solicitação de encaminhamento

- **WHEN** o aluno solicita encaminhamento com os três documentos iniciais completos
- **THEN** o sistema SHALL submeter o Formulário de Liberação ao Coordenador de Curso, registrar o pedido de envio dos documentos e informar que o envio para assinaturas depende da aprovação

#### Scenario: Tentativa de envio antecipado

- **WHEN** o aluno tenta enviar ou reenviar um documento inicial para assinatura enquanto o Formulário de Liberação não possui parecer favorável
- **THEN** o sistema SHALL recusar o envio e informar a pendência de parecer, inclusive quando a tentativa ocorre por requisição direta

#### Scenario: Parecer favorável após o pedido do aluno

- **WHEN** o Coordenador de Curso aprova o Formulário de Liberação de uma solicitação já encaminhada pelo aluno
- **THEN** o sistema SHALL liberar o envio solicitado dos documentos iniciais aos respectivos assinantes, registrando cada tentativa e seu resultado e mantendo o estágio em preparação até a confirmação das assinaturas

### Requirement: Submissão do documento a parecer

O sistema SHALL permitir que o aluno submeta a parecer o documento preenchido que exige avaliação; o documento SHALL passar à situação de submetido a parecer e entrar na fila do responsável.

#### Scenario: Submissão pelo aluno

- **WHEN** o aluno submete a parecer um documento preenchido que exige avaliação
- **THEN** o sistema SHALL registrar a submissão com data e responsável, alterar a situação do documento e incluí-lo na fila de pareceres do responsável

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

### Requirement: Correção do Formulário de Liberação indeferido

O sistema SHALL devolver ao aluno o Formulário de Liberação com parecer desfavorável para correção e nova submissão, preservando o histórico de pareceres. Enquanto não houver novo parecer favorável, o estágio SHALL permanecer em preparação e os envios iniciais para assinatura e os demais documentos SHALL permanecer bloqueados.

#### Scenario: Parecer desfavorável no formulário

- **WHEN** o Coordenador de Curso indefere o Formulário de Liberação
- **THEN** o sistema SHALL apresentar ao aluno o indeferimento na situação do documento, disponibilizar o ajuste e preservar o parecer e suas observações no histórico

#### Scenario: Nova submissão após correção

- **WHEN** o aluno corrige o formulário e solicita nova submissão
- **THEN** o sistema SHALL encaminhá-lo novamente ao Coordenador de Curso, mantendo os pareceres anteriores e o bloqueio do envio para assinaturas até nova decisão favorável

### Requirement: Parecer de usuário do sistema

O sistema SHALL permitir que o responsável que é usuário do sistema registre o parecer com a decisão de aprovar, indeferir e as considerações, e o parecer SHALL ser exibido ao aluno. A decisão, com autor e data, e a alteração de situação do documento SHALL ser gravadas conjuntamente, preservando as decisões anteriores. O Coordenador de Curso SHALL poder acrescentar observações do documento durante a emissão do parecer, registradas com autor e data conforme a regra de observações por documento.

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

#### Scenario: Falha ao registrar decisão

- **WHEN** uma falha impede concluir a gravação de uma decisão e de seus efeitos obrigatórios
- **THEN** o sistema SHALL manter a situação anterior, sem apresentar decisão concluída nem parecer parcialmente aplicado

### Requirement: Acompanhamento de pendências e resultados

O sistema SHALL permitir acompanhar pendências e resultados pelas situações dos documentos e estágios, por seus detalhes e pelas filas autorizadas de parecer e conferência. Totais de pendências SHALL refletir os registros atuais, sem avisos com estado lido ou não lido. Uma central de notificações gerais SHALL NOT fazer parte desta entrega.

#### Scenario: Sinalização de pendência

- **WHEN** um coordenador possui documentos aguardando seu parecer
- **THEN** o sistema SHALL exibir a contagem de pendências na navegação e disponibilizar a fila de pareceres

#### Scenario: Fila após decisão em outra instância

- **WHEN** uma decisão remove a pendência e o responsável consulta novamente sua fila em outra instância
- **THEN** o sistema SHALL atualizar a fila e o total a partir dos documentos atuais

#### Scenario: Resultado de parecer consultado pelo aluno

- **WHEN** um parecer é concluído e o aluno abre o documento
- **THEN** o sistema SHALL mostrar a decisão, o autor, a data e as considerações, sem exigir uma notificação para acessar o resultado

#### Scenario: Liberação do estágio consultada pelo aluno

- **WHEN** o Coordenador de Estágio libera um estágio
- **THEN** o sistema SHALL apresentar ao aluno, nos detalhes do estágio, a situação em andamento e os demais documentos liberados

### Requirement: Parecer de responsável externo

O parecer de responsável externo, que não é usuário do sistema, SHALL ser obtido fora do sistema. O pedido de envio do documento ao responsável externo SHALL ser registrado conforme os registros de envio; enquanto a integração de envio de anexos estiver indisponível, o sistema SHALL informar ao aluno que obtenha o parecer pelo meio convencional, sem indicar envio concluído.

#### Scenario: Pedido de envio ao professor orientador

- **WHEN** o aluno pede o envio do Relatório Semestral ao professor orientador
- **THEN** o sistema SHALL registrar o pedido com destinatário e resultado, informando a indisponibilidade do envio quando a integração não estiver disponível

#### Scenario: Responsável externo sem e-mail cadastrado

- **WHEN** o documento é destinado a um responsável externo sem e-mail cadastrado
- **THEN** o sistema SHALL recusar o envio por e-mail e informar ao aluno que ele deve obter a resposta pelo meio convencional

### Requirement: Envio de documento para assinatura externa

As assinaturas SHALL ser sempre externas ao sistema, sem assinatura eletrônica. O envio do documento aos assinantes SHALL ocorrer por e-mail com anexo quando a integração de envio de anexos estiver disponível; enquanto ela não estiver, o sistema SHALL registrar o pedido e a indisponibilidade sem confirmação fictícia de envio ou assinatura. Para os três documentos iniciais, o envio SHALL depender de solicitação do aluno e de parecer favorável no Formulário de Liberação, e o resultado do envio SHALL NOT ser tratado como comprovação de assinatura.

#### Scenario: Envio sem integração disponível

- **WHEN** há pedido de envio de documento e a integração de anexos não está disponível
- **THEN** o sistema SHALL registrar o pedido e a indisponibilidade, orientar a obtenção da assinatura pelo meio convencional e SHALL NOT indicar envio concluído

#### Scenario: Assinatura externa fora do sistema

- **WHEN** um documento precisa de assinatura
- **THEN** o sistema SHALL oferecer apenas o envio ou o download do arquivo, sem opção de assinatura eletrônica

#### Scenario: Envio não libera o estágio

- **WHEN** há registro de envio dos documentos iniciais, com sucesso ou não
- **THEN** o sistema SHALL manter o estágio em preparação e informar que aguarda a conferência das assinaturas pelo Coordenador de Estágio

#### Scenario: Reenvio do documento

- **WHEN** o usuário reenvia um documento para assinatura
- **THEN** o sistema SHALL registrar uma nova tentativa, preservando as anteriores e aplicando a exigência de parecer favorável quando se tratar de documentação inicial

### Requirement: Registro do envio

O sistema SHALL persistir cada tentativa de envio com documento, autor, data, destinatário e resultado, distinguindo pedido de envio, envio confirmado, indisponibilidade e falha. O registro SHALL ser exibido ao aluno e ao coordenador no contexto do documento.

#### Scenario: Consulta do histórico de envios

- **WHEN** o aluno ou o coordenador consulta o documento
- **THEN** o sistema SHALL exibir a lista de tentativas com autor, data, destinatário e resultado

#### Scenario: Falha seguida de nova tentativa

- **WHEN** uma tentativa de envio falha e posteriormente ocorre uma nova tentativa
- **THEN** o sistema SHALL manter os resultados das duas consultáveis, informar o erro ao usuário e SHALL NOT presumir envio ou assinatura externa
