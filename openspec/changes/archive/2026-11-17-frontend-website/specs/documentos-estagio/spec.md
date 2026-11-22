## Purpose

Reúne o catálogo do Kit de Estágio, o preenchimento automático da documentação inicial, a liberação dos demais documentos, as observações da coordenação, o preview, o download e o registro de horas, respeitando as permissões de cada perfil.

## ADDED Requirements

### Requirement: Catálogo de documentos

O sistema SHALL apresentar, em uma tela acessível a todos os cargos, a lista de todos os templates preenchíveis e dos documentos fixos para download, com o nome e a indicação de que o documento é preenchível ou apenas para download.

#### Scenario: Acesso ao catálogo

- **WHEN** um usuário autenticado de qualquer cargo abre a tela de Documentos
- **THEN** o sistema SHALL listar os doze documentos do Kit de Estágio com nome e indicação de preenchimento ou download

#### Scenario: Documento preenchível

- **WHEN** o usuário seleciona um documento marcado como preenchível
- **THEN** o sistema SHALL abrir a tela de preenchimento quando o perfil e a etapa do estágio permitirem, ou informar a condição pendente sem criar um preenchimento não autorizado

#### Scenario: Documento apenas para download

- **WHEN** o usuário seleciona um documento marcado como somente download
- **THEN** o sistema SHALL oferecer o download e não SHALL abrir formulário de preenchimento

### Requirement: Documentos fixos para download

O sistema SHALL disponibilizar para download a Lei de Estágio e o Regulamento de Estágio dos Cursos de Licenciatura, sem formulário de preenchimento.

#### Scenario: Download da Lei de Estágio

- **WHEN** o usuário baixa a Lei de Estágio no catálogo
- **THEN** o sistema SHALL fornecer o arquivo e registrar que o documento é de uso exclusivo para download

### Requirement: Campos de preenchimento por versão de template

O sistema SHALL definir os campos de preenchimento de cada documento a partir da versão vigente do respective template, e SHALL oferecer apenas os campos correspondentes a essa versão.

#### Scenario: Documento com versão vigente

- **WHEN** o aluno abre o preenchimento de um documento com versão vigente cadastrada
- **THEN** o sistema SHALL exibir exatamente os campos correspondentes a essa versão

#### Scenario: Documento sem versão vigente

- **WHEN** o usuário tenta abrir o preenchimento de um documento que não possui versão vigente cadastrada
- **THEN** o sistema SHALL informar que o documento está indisponível e oferecer a alternativa de download

### Requirement: Preenchimento automático com dados do aluno

O sistema SHALL preencher inicialmente os campos dos documentos com os dados cadastrados do aluno e do estágio selecionado, mantendo os campos de identificação somente para leitura. Os grupos de endereço SHALL permitir correção manual no fluxo autorizado de edição, inclusive quando preenchidos pelo cadastro, e seus valores salvos SHALL prevalecer na reabertura. Abrir o formulário SHALL NOT consultar o ViaCEP; durante a edição de endereço, somente alterar/informar CEP válido ou solicitar explicitamente sua consulta SHALL iniciar a busca. Editar apenas outro campo SHALL NOT consultar.

#### Scenario: Campos de identificação preenchidos

- **WHEN** o aluno abre o preenchimento de um documento a partir de um estágio
- **THEN** o sistema SHALL preencher nome, matrícula e curso do aluno, e os dados de instituição, supervisor, orientador e período do estágio, nos campos correspondentes e em modo somente leitura

#### Scenario: Duração declarada do estágio

- **WHEN** o aluno informa os dados necessários à preparação do Termo de Compromisso, incluindo a duração prevista em horas
- **THEN** o sistema SHALL utilizar a duração declarada no preenchimento automático, sem exigir lançamentos de horas de um estágio ainda não liberado

#### Scenario: Dado cadastrado ausente

- **WHEN** um campo de identificação protegido corresponde a um dado do aluno que não está preenchido no cadastro
- **THEN** o sistema SHALL sinalizar a pendência e orientar o aluno a completar o cadastro antes de gerar o documento

#### Scenario: Endereço cadastrado ausente ou incompleto

- **WHEN** um grupo de endereço não possui todos os dados cadastrados necessários
- **THEN** o sistema SHALL exibir os dados disponíveis e permitir completar o endereço na edição autorizada do documento, sem consulta externa na carga inicial

#### Scenario: Endereço corrigido e salvo

- **WHEN** o usuário autorizado corrige um endereço do documento, salva e reabre o registro
- **THEN** o sistema SHALL preservar os valores finais informados, sem reaplicar o endereço original do cadastro nem consultar o ViaCEP

### Requirement: Preparação automática da documentação inicial

O sistema SHALL preencher automaticamente o Termo de Compromisso, o Formulário de Liberação e o Plano de Atividades a partir dos dados cadastrados do aluno e dos dados informados na solicitação do estágio. Os três documentos SHALL permanecer distintos, obrigatórios e vinculados à mesma solicitação.

#### Scenario: Dados da solicitação completos

- **WHEN** o aluno conclui os dados necessários para a criação do estágio
- **THEN** o sistema SHALL disponibilizar os três documentos iniciais preenchidos para conferência e solicitação de encaminhamento, sem exigir que o aluno selecione ou redigite os dados compartilhados em cada documento

#### Scenario: Dado necessário ausente

- **WHEN** falta um dado exigido por um dos três documentos iniciais
- **THEN** o sistema SHALL identificar o dado pendente e impedir o encaminhamento até sua complementação, reaproveitando o preenchimento já informado

### Requirement: Liberação dos documentos por etapa do estágio

O sistema SHALL permitir ao aluno preparar somente os três documentos iniciais enquanto o estágio não estiver liberado. O registro dos demais documentos e dos lançamentos de horas SHALL depender da liberação inicial pelo Coordenador de Estágio; o catálogo e o download dos documentos fixos SHALL continuar acessíveis.

#### Scenario: Acesso direto antes da liberação

- **WHEN** o aluno tenta abrir ou salvar um documento adicional por URL ou requisição direta em um estágio em preparação
- **THEN** o sistema SHALL bloquear o preenchimento e informar que o estágio aguarda liberação, sem criar ou gravar o documento

#### Scenario: Continuidade após conferência

- **WHEN** o Coordenador de Estágio confirma as assinaturas iniciais de um estágio com parecer favorável no Formulário de Liberação
- **THEN** o sistema SHALL disponibilizar os demais documentos daquele estágio conforme as permissões de preenchimento de cada perfil

#### Scenario: Liberação não se estende a outro estágio

- **WHEN** o aluno possui um estágio liberado e outro ainda em preparação
- **THEN** o sistema SHALL manter os documentos adicionais bloqueados apenas no estágio em preparação

#### Scenario: Registro de horas antes da liberação

- **WHEN** o aluno tenta registrar horas em um estágio ainda não liberado
- **THEN** o sistema SHALL recusar o lançamento e informar a necessidade de liberação inicial

### Requirement: Observações da coordenação por documento

O sistema SHALL disponibilizar, em cada documento registrado, observações com conteúdo, autor e data. Apenas o Coordenador de Curso e o Coordenador de Estágio com acesso ao documento SHALL acrescentar observações, ao emitir parecer, ao confirmar assinaturas ou a qualquer momento, independentemente dessas ações. Cada acréscimo SHALL preservar as observações anteriores e não SHALL alterar por si só o parecer, a conferência das assinaturas ou a situação do estágio.

#### Scenario: Observação durante o parecer

- **WHEN** o Coordenador de Curso acrescenta uma observação ao emitir o parecer do Formulário de Liberação
- **THEN** o sistema SHALL vinculá-la ao documento com o conteúdo, o autor e a data, preservando as observações anteriores

#### Scenario: Observação durante a conferência

- **WHEN** o Coordenador de Estágio acrescenta observações ao confirmar as assinaturas dos documentos iniciais
- **THEN** o sistema SHALL registrar cada observação no documento correspondente com autor e data, sem substituir as observações do parecer

#### Scenario: Observação independente da etapa

- **WHEN** um dos dois coordenadores com acesso acrescenta uma observação fora das ações de parecer e conferência, inclusive em documento sem parecer ou de estágio já concluído
- **THEN** o sistema SHALL acrescentar o registro ao histórico do documento sem exigir nova emissão de parecer ou confirmação de assinaturas

#### Scenario: Tentativa por perfil não autorizado

- **WHEN** um usuário sem papel de Coordenador de Curso ou Coordenador de Estágio tenta acrescentar uma observação, inclusive por requisição direta
- **THEN** o sistema SHALL recusar a operação e preservar os registros existentes

### Requirement: Gravação e consulta de documento preenchido

O sistema SHALL permitir que o documento preenchido seja salvo, reaberto, alterado e exibido na lista de documentos preenchidos do estágio, e SHALL distinguir documentos em preenchimento de documentos já preenchidos.

#### Scenario: Salvamento do preenchimento

- **WHEN** o aluno salva um preenchimento válido
- **THEN** o sistema SHALL gravá-lo, marcar o documento como preenchido para aquele estágio e listá-lo entre os documentos preenchidos do estágio

#### Scenario: Salvamento com campo inválido

- **WHEN** o aluno salva um preenchimento com algum campo obrigatório em branco ou inválido
- **THEN** o sistema SHALL recusar o salvamento e sinalizar os campos com erro

#### Scenario: Reabertura de documento preenchido

- **WHEN** o aluno abre novamente um documento já preenchido de um estágio
- **THEN** o sistema SHALL exibir os valores anteriormente informados, permitindo a edição

### Requirement: Documentos vinculados a um estágio

O sistema SHALL preencher documentos vinculados a um estágio apenas a partir do estágio selecionado, e SHALL preservar o vínculo entre o documento preenchido e aquele estágio.

#### Scenario: Preenchimento de Termo Aditivo

- **WHEN** o aluno preenche um Termo Aditivo
- **THEN** o sistema SHALL exigir a indicação do estágio a que o termo se refere e vincular o documento preenchido a esse estágio

#### Scenario: Documento sem estágio

- **WHEN** o aluno tenta preencher um documento que exige estágio sem informar qual é
- **THEN** o sistema SHALL bloquear a conclusão e exigir a seleção do estágio

### Requirement: Data preenchida no ato da assinatura externa

O sistema SHALL manter em branco, no documento, a Data do Termo de Compromisso apresentada no Termo Aditivo para preenchimento no ato da assinatura fora do sistema. O sistema SHALL NOT solicitar, preencher automaticamente, validar como dado obrigatório ou registrar esse valor no formulário, no cadastro do estágio ou na confirmação das assinaturas.

#### Scenario: Preenchimento do Termo Aditivo

- **WHEN** o aluno abre ou salva o Termo Aditivo
- **THEN** o sistema SHALL permitir a operação sem informar essa data e SHALL apresentar apenas a indicação de preenchimento externo, sem controle de entrada para o valor

#### Scenario: Preview e download para assinatura

- **WHEN** um usuário visualiza ou baixa o Termo Aditivo para assinatura
- **THEN** o sistema SHALL preservar o espaço em branco da data para preenchimento fora do sistema, sem usar a data de criação, de início do estágio ou de conferência das assinaturas

### Requirement: Quem pode preencher cada documento

O sistema SHALL liberar o preenchimento de cada documento apenas aos perfis indicados na matriz de preenchimento. O aluno preenche o Formulário de Liberação, o Plano de Atividades, o Termo de Compromisso, a Ficha de Acompanhamento, o Relatório Semestral, o Requerimento para Aproveitamento de Horas, o Termo Aditivo e a Proposta de Atuação Pedagógica; o Coordenador de Estágio preenche o Convênio de Estágio; e a Ficha de Frequência e Avaliação não é preenchida pelo aluno, pois o template oficial só admite o Setor de Recursos Humanos ou o chefe imediato do estagiário na concedente.

#### Scenario: Aluno preenche documento de aluno

- **WHEN** um aluno abre um documento que ele preenche
- **THEN** o sistema SHALL permitir o preenchimento e associá-lo ao estágio escolhido

#### Scenario: Convênio preenchido pelo Coordenador de Estágio

- **WHEN** um Coordenador de Estágio abre o Convênio de Estágio
- **THEN** o sistema SHALL permitir o preenchimento e recusar o preenchimento por outros perfis

#### Scenario: Aluno tenta preencher a Ficha de Frequência

- **WHEN** um aluno abre a Ficha de Frequência e Avaliação
- **THEN** o sistema SHALL recusar a abertura do formulário e informar que o preenchimento cabe ao responsável da concedente e que o documento assinado deve ser registrado no estágio

#### Scenario: Registro da Ficha de Frequência recebida

- **WHEN** o Coordenador de Estágio registra a Ficha de Frequência já preenchida e assinada pela concedente
- **THEN** o sistema SHALL associá-la ao estágio e permitir o lançamento das horas e das avaliações que o documento traz

#### Scenario: Documento preenchido por outro perfil

- **WHEN** um usuário de um perfil não indicado para aquele documento abre o formulário
- **THEN** o sistema SHALL recusar a abertura do formulário e informar qual perfil é responsável

### Requirement: Preview do documento preenchido

O sistema SHALL exibir, no navegador e antes do download, o preview do documento preenchido com os valores informados, permitindo que o usuário confira o resultado.

#### Scenario: Preview antes do download

- **WHEN** o usuário preenchido solicita o preview de um documento
- **THEN** o sistema SHALL exibir o documento com os dados aplicados e sem os marcadores de preenchimento do template

#### Scenario: Divergência entre o formulário e o preview

- **WHEN** o usuário altera um valor no formulário e visualiza o preview
- **THEN** o preview SHALL refletir o valor novo e o usuário SHALL poder retornar ao formulário para corrigir

### Requirement: Download do documento preenchido

O sistema SHALL oferecer o download do documento preenchido nos formatos docx e pdf, e o arquivo obtido SHALL corresponder aos valores informados no preenchimento.

#### Scenario: Download nos dois formatos

- **WHEN** o usuário baixa um documento preenchido
- **THEN** o sistema SHALL oferecer o download em docx e em pdf, e o arquivo baixado SHALL conter os valores informados no preenchimento

#### Scenario: Documento em preenchimento

- **WHEN** o usuário tenta baixar um documento ainda em preenchimento e sem dados obrigatórios
- **THEN** o sistema SHALL recusar o download e sinalizar os campos pendentes

### Requirement: Registro de horas do estágio

O sistema SHALL permitir que o aluno registre as horas do estágio conforme digita, informando por dia a data, a presença e as horas trabalhadas, e SHALL apresentar o total acumulado do estágio.

#### Scenario: Lançamento de horas

- **WHEN** o aluno informa a data, a presença e as horas trabalhadas de um dia dentro do período do estágio
- **THEN** o sistema SHALL somar as horas ao total acumulado do estágio e exibi-lo na tela

#### Scenario: Valor de horas inválido

- **WHEN** o aluno informa horas trabalhadas zero, negativas ou não numéricas
- **THEN** o sistema SHALL recusar o lançamento e sinalizar o erro no campo

#### Scenario: Lançamento fora do período do estágio

- **WHEN** o aluno tenta lançar horas em data anterior ao início ou posterior ao fim do estágio
- **THEN** o sistema SHALL recusar o lançamento e informar o período válido

#### Scenario: Consulta do total

- **WHEN** o aluno consulta os detalhes de um estágio
- **THEN** o sistema SHALL exibir o total de horas registradas e a lista de lançamentos do período

### Requirement: Limites de jornada e de carga horária semanal

O sistema SHALL aplicar, ao registrar horas, os limites previstos no Regulamento de Estágio e no Convênio: jornada máxima de 6 horas por dia, excluído o horário de almoço, e carga horária máxima de 30 horas por semana.

#### Scenario: Lançamento acima do limite diário

- **WHEN** o aluno lança mais de 6 horas trabalhadas em um mesmo dia
- **THEN** o sistema SHALL recusar o lançamento e informar o limite diário de 6 horas

#### Scenario: Lançamento acima do limite semanal

- **WHEN** o lançamento faz a soma das horas da semana ultrapassar 30 horas
- **THEN** o sistema SHALL recusar o lançamento e informar o limite semanal e o total já registrado naquela semana

#### Scenario: Intervalo de almoço não contabilizado

- **WHEN** o aluno informa horário de entrada e de saída que encompassa o intervalo de almoço
- **THEN** o sistema SHALL permitir desligar o intervalo antes da soma, de modo que a jornada máxima seja calculada sobre as horas efetivamente trabalhadas

#### Scenario: Lançamento dentro dos limites

- **WHEN** o lançamento respeita os limites diário e semanal e está dentro do período do estágio
- **THEN** o sistema SHALL aceitar o lançamento e somá-lo ao total acumulado do estágio

### Requirement: Correção de lançamento sem rasura

O sistema SHALL mantém imutável cada lançamento de horas registrado e SHALL permitir corrigir um lançamento por meio de um lançamento de correção que identifica o lançamento corrigido, preservando o histórico, porque a Ficha de Acompanhamento não deve conter rasuras.

#### Scenario: Edição de lançamento já registrado

- **WHEN** o aluno tenta alterar as horas ou a data de um lançamento já registrado
- **THEN** o sistema SHALL recusar a edição e orientar o uso de um lançamento de correção

#### Scenario: Lançamento de correção

- **WHEN** o aluno registra um lançamento de correção indicando o lançamento a corrigir e o novo valor
- **THEN** o sistema SHALL manter o lançamento original, registrar a correção vinculada a ele e recalcular o total do estágio

#### Scenario: Histórico sem apagamento

- **WHEN** o usuário consulta os lançamentos do estágio
- **THEN** o sistema SHALL exibir o lançamento original e a correção identificados como tales, sem apagar nenhum dos dois

### Requirement: Limite de palavras por seção

O sistema SHALL aplicar, nas seções dos documentos que definem limite de palavras em seu template, o limite correspondente e exibir a contagem de palavras enquanto o aluno escreve.

#### Scenario: Contagem durante a digitação

- **WHEN** o aluno digita em uma seção cujo template define limite de palavras
- **THEN** o sistema SHALL exibir a contagem de palavras e o limite da seção

#### Scenario: Seção acima do limite

- **WHEN** a contagem de palavras da seção ultrapassa o limite do template
- **THEN** o sistema SHALL sinalizar o excedente e recusar a gravação da seção enquanto o limite não for respeitado

### Requirement: Escalas de avaliação dos documentos

O sistema SHALL aplicar a escala numérica de 0 a 10, com as faixas E, B, R e I, na Ficha de Frequência e Avaliação, e a escala qualitativa de ótimo, bom, regular e insuficiente na autoavaliação do Relatório Semestral, conforme o template de cada documento.

#### Scenario: Nota com faixa correspondente

- **WHEN** o responsável da concedente atribui nota 9,5 a um critério da Ficha de Frequência
- **THEN** o sistema SHALL exibir a nota e a faixa correspondente, que é E, e calcular o conceito global

#### Scenario: Marcação de um único nível

- **WHEN** o aluno avalia um fator da autoavaliação do Relatório Semestral
- **THEN** o sistema SHALL exigir a escolha de um único nível entre ótimo, bom, regular e insuficiente para cada fator

#### Scenario: Conceito global e total de horas

- **WHEN** as avaliações da Ficha de Frequência estão registradas
- **THEN** o sistema SHALL exibir o conceito global e o total de horas preenchidos no documento

### Requirement: Documentação comprobatória do Requerimento

O sistema SHALL listar, no Requerimento para Aproveitamento de Horas, a documentação comprobatória exigida e SHALL permitir marcar cada item, recusando a submissão a parecer enquanto houver item obrigatório não marcado.

#### Scenario: Itens da documentação

- **WHEN** o aluno abre o Requerimento para Aproveitamento de Horas
- **THEN** o sistema SHALL listar cópia da Carteira de Trabalho, declaração do supervisor, programa de atividades assinado e carimbado, Ficha de Avaliação e Frequência assinada e carimbada e formulário de escolha do professor orientador

#### Scenario: Submissão com item pendente

- **WHEN** o aluno tenta submeter a parecer com item obrigatório não marcado
- **THEN** o sistema SHALL recusar a submissão e indicar os itens pendentes
