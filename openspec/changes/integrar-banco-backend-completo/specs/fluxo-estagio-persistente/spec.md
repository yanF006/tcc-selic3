## Purpose

Garantir a continuidade dos processos de estágio, documentos, horas e avaliações entre instâncias, com catálogo fixo do Kit de Estágio e preservação dos registros funcionais necessários.

## ADDED Requirements

### Requirement: Solicitação de estágio e documentação inicial duráveis

O sistema SHALL persistir o estágio em preparação com aluno, vínculos acadêmicos e institucionais, dados declarados e os três documentos iniciais distintos: Termo de Compromisso, Formulário de Liberação e Plano de Atividades. A criação desses registros obrigatórios SHALL constituir uma única operação de negócio; seu resultado SHALL permanecer consultável após reinício e por outra instância autorizada.

#### Scenario: Preparação consultada em outra instância
- **WHEN** o aluno conclui uma solicitação válida e abre seus detalhes em outra instância
- **THEN** o sistema SHALL mostrar o mesmo estágio em preparação e os três documentos iniciais com seus valores salvos e pendências

#### Scenario: Falha ao criar documentação inicial
- **WHEN** uma falha impede salvar um dos registros obrigatórios da criação do estágio
- **THEN** o sistema SHALL recusar a conclusão sem deixar estágio ou documentos parcialmente criados

### Requirement: Liberação e transições baseadas no estado persistido

O sistema SHALL persistir encaminhamentos, pareceres e conferências com autor e data e validar as transições contra o estado atual do estágio e dos documentos. A liberação inicial SHALL exigir parecer favorável no Formulário de Liberação e confirmação das assinaturas dos três documentos pelo coordenador de estágio. Registro de envio SHALL NOT comprovar assinatura nem liberar o estágio. Demais documentos e horas SHALL permanecer bloqueados até a liberação.

#### Scenario: Liberação concluída
- **WHEN** o coordenador de estágio confirma as três assinaturas de um estágio com parecer favorável
- **THEN** o sistema SHALL persistir conferência com responsável e data e situação em andamento conjuntamente, apresentando a liberação nos detalhes e liberando os demais processos nas consultas seguintes

#### Scenario: Tentativa de contornar pendência
- **WHEN** aluno ou coordenador tenta colocar um estágio em preparação diretamente em andamento ou concluído por edição genérica
- **THEN** o sistema SHALL recusar a alteração e preservar as pendências e a situação anterior

#### Scenario: Requisição baseada em documento desatualizado
- **WHEN** uma requisição tenta liberar estágio sem que o estado persistido atual satisfaça os requisitos de parecer e assinaturas
- **THEN** o sistema SHALL recusar a liberação mesmo que a tela de origem apresente dados anteriores favoráveis

### Requirement: Catálogo fixo e preenchimentos preservados

O sistema SHALL oferecer o catálogo fixo do Kit de Estágio, distinguindo definições preenchíveis de recursos somente para download, com arquivos e campos mantidos pelo desenvolvedor. O sistema SHALL persistir documentos preenchidos com seus vínculos, situação, valores finais e identificação da definição utilizada. Uma atualização do acervo pelo desenvolvedor SHALL NOT reinterpretar silenciosamente preenchimentos existentes. Referências e arquivos necessários à reabertura SHALL ser duráveis e respeitar as permissões do documento. A interface SHALL NOT oferecer editor de templates, upload/publicação de templates pela gestão ou gerenciamento administrativo de versões nesta entrega. Persistir preenchimento ou referência SHALL NOT ser apresentado como geração concluída de um arquivo que ainda não existe.

#### Scenario: Reabertura de preenchimento salvo
- **WHEN** um documento salvo é reaberto em outra instância ou após uma atualização da aplicação
- **THEN** o sistema SHALL preservar seus valores, incluindo endereços corrigidos manualmente, e a identificação de sua definição, sem substituir silenciosamente seu conteúdo por novos campos ou valores do catálogo

#### Scenario: Catálogo sem edição administrativa
- **WHEN** administrador ou coordenador abre o catálogo do Kit de Estágio
- **THEN** o sistema SHALL apresentar os recursos fixos e as ações de uso autorizadas, sem editor, upload ou publicação de versões de templates

#### Scenario: Tentativa direta de publicar template
- **WHEN** um usuário tenta publicar ou alterar uma definição de template por requisição direta à aplicação
- **THEN** o sistema SHALL NOT disponibilizar uma operação administrativa de publicação e SHALL preservar as definições fixas usadas pelos registros existentes

#### Scenario: Arquivo não disponível
- **WHEN** o usuário solicita um arquivo que não foi gerado ou cuja referência não pode ser resolvida
- **THEN** o sistema SHALL informar a indisponibilidade e não confirmar geração ou download bem-sucedido

### Requirement: Horas e correções consistentes

O sistema SHALL persistir lançamentos de horas e correções com vínculo ao estágio e ao lançamento original, preservando o histórico imutável. O cálculo do total SHALL considerar as correções sem contar duas vezes as horas substituídas e SHALL respeitar o período, a liberação e os limites de 6 horas por dia e 30 horas por semana, inclusive sob concorrência.

#### Scenario: Correção consultada após reinício
- **WHEN** o aluno registra uma correção válida e consulta o estágio após reinício
- **THEN** o sistema SHALL mostrar original e correção identificados e o total ajustado sem duplicar as horas corrigidas

#### Scenario: Lançamentos concorrentes acima do limite
- **WHEN** dois lançamentos simultâneos seriam individualmente válidos mas juntos ultrapassariam o limite diário ou semanal
- **THEN** o sistema SHALL impedir o excesso no resultado persistido e informar a rejeição da operação incompatível

#### Scenario: Horas antes da liberação
- **WHEN** uma requisição tenta registrar horas em estágio ainda em preparação
- **THEN** o sistema SHALL recusar a gravação sem alterar o total ou o histórico

### Requirement: Pareceres e observações com histórico durável

O sistema SHALL persistir submissão, decisão, considerações, autor e data dos pareceres e conteúdo, autor e data das observações. Indeferimento e nova submissão SHALL preservar decisões anteriores. A decisão e sua alteração de situação SHALL ser aplicadas conjuntamente, com resultado acessível nas consultas autorizadas. Observação isolada SHALL NOT alterar parecer, assinatura ou situação do estágio.

#### Scenario: Indeferimento e nova submissão
- **WHEN** o aluno corrige um Formulário de Liberação indeferido e solicita nova análise
- **THEN** o sistema SHALL preservar o parecer anterior, registrar a nova submissão e manter o bloqueio de liberação até nova decisão favorável

#### Scenario: Observações simultâneas
- **WHEN** dois coordenadores autorizados acrescentam observações ao mesmo documento em instâncias diferentes
- **THEN** o sistema SHALL preservar ambas com seus autores e datas, sem substituir o histórico anterior

#### Scenario: Falha ao registrar decisão
- **WHEN** uma falha impede concluir a persistência de uma decisão e seus efeitos obrigatórios
- **THEN** o sistema SHALL manter a situação anterior sem apresentar decisão concluída nem parecer parcialmente aplicado

### Requirement: Acompanhamento por situações e filas

O sistema SHALL permitir acompanhar pendências e resultados pelas situações dos documentos e estágios, seus detalhes e pelas filas autorizadas de parecer e conferência. Totais de pendências SHALL refletir os registros de negócio atuais, sem depender de avisos com estado lido/não lido. Uma central de notificações gerais e seu controle de leitura SHALL NOT fazer parte desta entrega.

#### Scenario: Resultado de parecer consultado pelo aluno
- **WHEN** um parecer é concluído e o aluno abre o documento em nova consulta
- **THEN** o sistema SHALL mostrar a decisão, autor, data e considerações sem exigir uma notificação para acessar o resultado

#### Scenario: Fila após decisão em outra instância
- **WHEN** uma decisão remove a pendência de parecer e o responsável consulta novamente sua fila em outra instância
- **THEN** o sistema SHALL atualizar a fila e o total de pendências a partir dos documentos atuais, sem contagem de notificações não lidas

### Requirement: Registros de envio duráveis

O sistema SHALL persistir registros de envio com documento, autor, data, destinatário e resultado. Reenvios SHALL preservar tentativas anteriores. Solicitação de envio, envio confirmado e falha SHALL permanecer distinguíveis; a indisponibilidade da integração de anexos SHALL NOT gerar confirmação fictícia de envio ou assinatura. Resultado e indisponibilidade SHALL ser apresentados no contexto do documento, sem depender de notificações gerais.

#### Scenario: Envio sem integração disponível
- **WHEN** há pedido de envio de documento e a integração necessária não está disponível
- **THEN** o sistema SHALL registrar o pedido e a indisponibilidade sem indicar envio concluído nem liberar o estágio por esse motivo

#### Scenario: Histórico de falha e reenvio
- **WHEN** uma tentativa de envio falha e posteriormente ocorre uma nova tentativa
- **THEN** o sistema SHALL manter os resultados das duas tentativas consultáveis, sem apagar a falha anterior ou presumir a assinatura externa

### Requirement: Registros funcionais sem histórico genérico de alterações

O sistema SHALL preservar os registros necessários para explicar decisões de acesso, pareceres, conferências de assinaturas, correções de horas, cancelamentos e exclusões, incluindo responsável, data e resultado quando aplicáveis. A persistência desses registros SHALL NOT exigir uma trilha genérica de toda edição de campo ou um painel de histórico completo de alterações. Adiar essa trilha SHALL NOT permitir apagar decisões ou correções necessárias ao processo.

#### Scenario: Correção seguida de nova decisão
- **WHEN** um documento indeferido é corrigido e recebe outro parecer
- **THEN** o sistema SHALL preservar os pareceres e seus responsáveis e datas, sem exigir histórico de cada edição de campo intermediária

#### Scenario: Consulta de conferência concluída
- **WHEN** o responsável consulta um estágio já liberado
- **THEN** o sistema SHALL identificar quem conferiu as assinaturas e quando, mesmo sem uma central de auditoria genérica

### Requirement: Exclusão e cancelamento com histórico preservado

O sistema SHALL persistir cancelamento de solicitação de estágio e solicitações e decisões de exclusão com seus responsáveis e datas. Exclusão que exige cargo superior SHALL NOT ser concluída antes da autorização. Ao executar exclusão autorizada, o sistema SHALL retirar o estágio dos processos ativos, inativar documentos vinculados e aplicar a remoção de dados pessoais prevista para o fluxo, preservando o histórico permitido e o perfil independente do aluno.

#### Scenario: Exclusão solicitada por coordenador de curso
- **WHEN** o coordenador de curso solicita a exclusão de um estágio sob sua responsabilidade
- **THEN** o sistema SHALL persistir a solicitação para decisão superior e manter o estágio sem exclusão até a autorização

#### Scenario: Exclusão autorizada em outra instância
- **WHEN** o responsável competente autoriza a exclusão e a operação é concluída
- **THEN** outra instância SHALL apresentar o estágio fora dos processos ativos, os documentos inativados e o histórico permitido para a coordenação, preservando o perfil do aluno

#### Scenario: Cancelamento em preparação
- **WHEN** o aluno cancela uma solicitação ainda em preparação
- **THEN** o sistema SHALL persistir o cancelamento, impedir sua continuidade e preservar seu histórico após reinício

### Requirement: Consultas e estatísticas sobre dados persistidos autorizados

O sistema SHALL calcular listas, totais e indicadores sobre todos os registros persistidos que atendam aos filtros e às permissões, sem depender de páginas pré-carregadas ou dados locais de demonstração. As consultas SHALL preservar os recortes de aluno, curso e campus e distinguir preparação, andamento e conclusão, documentos por situação, horas efetivas, convênios por vigência e pendências de parecer.

#### Scenario: Indicador e lista correspondente
- **WHEN** o coordenador filtra um indicador por curso e período e abre a lista dos registros que o compõem
- **THEN** o sistema SHALL usar o mesmo recorte autorizado no total e na lista, permitindo percorrer todos os registros

#### Scenario: Atualização de situação em outra instância
- **WHEN** um coordenador conclui um estágio válido e outro processo consulta as estatísticas em nova requisição
- **THEN** o sistema SHALL contabilizá-lo como concluído sem depender de reinício ou de dados anteriores em memória

#### Scenario: Estatísticas de curso restrito
- **WHEN** um coordenador de curso consulta indicadores com filtros manipulados para outro curso
- **THEN** o sistema SHALL manter o recorte autorizado e não revelar totais ou registros de outro curso
