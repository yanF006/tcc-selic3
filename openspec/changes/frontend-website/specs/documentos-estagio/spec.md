## Purpose

Reúne o catálogo dos documentos do Kit de Estágio, a tela de preenchimento dos templates com os dados do aluno, o preview no navegador, o download e o registro de horas do estágio, respeitando quem pode preencher cada documento.

## ADDED Requirements

### Requirement: Catálogo de documentos

O sistema SHALL apresentar, em uma tela acessível a todos os cargos, a lista de todos os templates preenchíveis e dos documentos fixos para download, com o nome e a indicação de que o documento é preenchível ou apenas para download.

#### Scenario: Acesso ao catálogo

- **WHEN** um usuário autenticado de qualquer cargo abre a tela de Documentos
- **THEN** o sistema SHALL listar os doze documentos do Kit de Estágio com nome e indicação de preenchimento ou download

#### Scenario: Documento preenchível

- **WHEN** o usuário seleciona um documento marcado como preenchível
- **THEN** o sistema SHALL abrir a tela de preenchimento daquele documento

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

O sistema SHALL preencher automaticamente, em modo somente leitura, os campos dos documentos que correspondem aos dados cadastrados do aluno e do estágio selecionado.

#### Scenario: Campos de identificação preenchidos

- **WHEN** o aluno abre o preenchimento de um documento a partir de um estágio
- **THEN** o sistema SHALL preencher nome, matrícula e curso do aluno, e os dados de instituição, supervisor, orientador e período do estágio, nos campos correspondentes e em modo somente leitura

#### Scenario: Duração declarada do estágio

- **WHEN** o aluno abre o Termo de Compromisso, que exige a duração do estágio em horas
- **THEN** o sistema SHALL preencher o campo de duração com o total de horas registrado no estágio e SHALL permitir que o aluno ajuste o valor

#### Scenario: Dado cadastrado ausente

- **WHEN** um campo de preenchimento automático corresponde a um dado do aluno que não está preenchido no cadastro
- **THEN** o sistema SHALL sinalizar a pendência e orientar o aluno a completar o cadastro antes de gerar o documento

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
