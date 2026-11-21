## MODIFIED Requirements

### Requirement: Download do documento preenchido

O sistema SHALL oferecer o download do documento preenchido em formato docx, no layout do respectivo documento do Kit de Estágio, com os valores informados no preenchimento aplicados nos lugares correspondentes. O download SHALL estar disponível para o Formulário de Liberação, o Plano de Atividades, o Convênio de Estágio, o Termo de Compromisso, a Ficha de Acompanhamento, o Relatório Semestral, o Requerimento para Aproveitamento de Horas, o Termo Aditivo e a Proposta de Atuação Pedagógica. O sistema SHALL NOT gerar arquivo PDF do documento preenchido nem gerar arquivo para a Ficha de Frequência e Avaliação, que é registrada já assinada pela concedente.

#### Scenario: Download no layout do Kit

- **WHEN** o usuário com acesso ao documento baixa um documento preenchido com todos os campos obrigatórios informados
- **THEN** o sistema SHALL fornecer um arquivo docx que mantém os textos fixos, a ordem e a formatação do documento do Kit e contém os valores informados no preenchimento, sem marcadores de preenchimento remanescentes

#### Scenario: Espaços para assinatura e preenchimento externo

- **WHEN** o documento baixado possui campos de assinatura ou de preenchimento no ato da assinatura, como a data do Termo de Compromisso no Termo Aditivo
- **THEN** o sistema SHALL manter esses espaços em branco no arquivo

#### Scenario: Documento em preenchimento

- **WHEN** o usuário tenta baixar um documento ainda em preenchimento e sem dados obrigatórios
- **THEN** o sistema SHALL recusar o download e sinalizar os campos pendentes

#### Scenario: Pedido de PDF

- **WHEN** um usuário solicita, por requisição direta, o documento preenchido em formato pdf
- **THEN** o sistema SHALL recusar o pedido e informar que o download é oferecido apenas em docx

#### Scenario: Ficha de Frequência registrada

- **WHEN** o usuário consulta uma Ficha de Frequência e Avaliação registrada no estágio
- **THEN** o sistema SHALL exibir o registro sem oferecer a geração de arquivo do documento
