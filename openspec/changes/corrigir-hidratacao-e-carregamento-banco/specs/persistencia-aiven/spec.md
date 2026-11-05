## MODIFIED Requirements

### Requirement: Conexão e Persistência no Aiven MySQL

O sistema SHALL conectar-se ao banco de dados MySQL hospedado no Aiven utilizando Prisma 7 e driver adapter com suporte a TLS. Quando `DATABASE_URL` estiver configurada, o sistema SHALL tratar o banco como fonte da verdade de usuários e matrículas e SHALL NOT apresentar as fixtures como se fossem os dados persistidos. Sem `DATABASE_URL`, o modo de simulação em memória SHALL continuar explícito e independente do comportamento de falha do banco.

#### Scenario: Hidratação e Persistência de Usuários e Matrículas

- **WHEN** a aplicação inicia com `DATABASE_URL` configurada apontando para um banco dedicado (`selic`) e a conexão é concluída
- **THEN** o sistema SHALL hidratar o estado de usuários e matrículas a partir do banco de dados e persistir mutações continuamente

#### Scenario: Simulação sem banco configurado

- **WHEN** a aplicação inicia sem `DATABASE_URL`
- **THEN** o sistema SHALL operar com as fixtures em memória, sem tentar conectar e sem sinalizar indisponibilidade de banco

## ADDED Requirements

### Requirement: Falha de conexão não pode virar sucesso com fixtures

Quando `DATABASE_URL` estiver configurada e a conexão ou a hidratação falhar, o sistema SHALL tratar a leitura como indisponível, SHALL NOT concluir a hidratação e SHALL NOT substituir a resposta por dados fictícios. A falha SHALL ser recuperável: uma nova tentativa SHALL ocorrer em requisição posterior, respeitando um intervalo curto entre tentativas, sem exigir reinício do processo.

#### Scenario: Falha na primeira hidratação

- **WHEN** o pool não consegue abrir conexão na primeira leitura com `DATABASE_URL` configurada
- **THEN** a operação SHALL falhar de forma controlada e a tela SHALL receber um estado de indisponibilidade, em vez de uma lista de fixtures

#### Scenario: Recuperação sem reiniciar o processo

- **WHEN** uma tentativa anterior falhou e o banco volta a responder
- **THEN** uma requisição posterior SHALL tentar a conexão novamente e, ao obter sucesso, SHALL hidratar os dados reais sem exigir reinício ou nova instância

#### Scenario: Falha não é memorizada como modo permanente

- **WHEN** uma tentativa de conexão falha
- **THEN** o sistema SHALL NOT manter um estado permanente que faça todas as leituras seguintes retornarem imediatamente sem nova tentativa

### Requirement: Leituras refletem dados atuais entre instâncias

Quando `DATABASE_URL` estiver configurada, as leituras de usuários e matrículas SHALL refletir alterações persistidas por outra instância da aplicação dentro de um limite de atualização definido. Um snapshot carregado uma única vez por processo SHALL NOT ser a única fonte de leitura por tempo indefinido.

#### Scenario: Cadastro feito em outra instância

- **WHEN** uma conta é criada por outra instância e o administrador atualiza a listagem na instância atual
- **THEN** a conta SHALL aparecer dentro do limite de atualização definido, sem depender de reinício da instância

#### Scenario: Leitura após escrita na mesma instância

- **WHEN** uma mutação é concluída com sucesso na instância atual
- **THEN** as leituras seguintes SHALL refletir a mutação imediatamente

### Requirement: Diagnóstico e limites de tempo da conexão

O sistema SHALL limitar o tempo de conexão e de aquisição do pool para que a indisponibilidade seja sinalizada em tempo compatível com uma tela de carregamento. Ao registrar uma falha, o sistema SHALL preservar a causa completa do erro — código, estado SQL e causa encadeada — sem registrar credenciais ou a URL completa.

#### Scenario: Banco inacessível

- **WHEN** o banco não responde dentro do limite configurado
- **THEN** o sistema SHALL encerrar a tentativa em tempo limitado e SHALL registrar a causa da falha para diagnóstico

#### Scenario: Credenciais preservadas no log

- **WHEN** uma falha de conexão é registrada
- **THEN** o log SHALL NOT conter senha, usuário ou a `DATABASE_URL` completa
