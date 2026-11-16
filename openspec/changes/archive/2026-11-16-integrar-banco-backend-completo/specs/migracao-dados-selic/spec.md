## Purpose

Permitir a transição do SELic para persistência completa com preservação dos dados existentes, mudanças rastreáveis e evidências de recuperação e operação no ambiente publicado.

## ADDED Requirements

### Requirement: Backup SQL antes de alterações do banco

A operação de implantação SHALL produzir backup SQL do banco dedicado antes de aplicar alterações de schema ou transformações de dados existentes. O backup SHALL identificar origem, momento e versão de referência sem expor credenciais em evidências públicas, e SHALL ter sua restauração verificada em ambiente isolado antes da migração do ambiente servido aos usuários.

#### Scenario: Preparação para migração
- **WHEN** uma implantação vai alterar o schema ou transformar os dados do banco existente
- **THEN** o responsável SHALL dispor do backup SQL correspondente e da evidência de restauração isolada antes de aplicar a alteração

#### Scenario: Falha na geração ou restauração do backup
- **WHEN** não é possível produzir ou verificar a restauração do backup exigido
- **THEN** a aplicação das alterações no banco servido aos usuários SHALL ser interrompida sem modificar seus dados

### Requirement: Inspeção de conflitos antes de impor restrições

A migração SHALL inspecionar o destino dedicado, duplicidades de e-mail e matrícula, cargos existentes e vínculos incompatíveis antes de impor novas restrições. Contas com múltiplos cargos, cargo ausente ou inválido SHALL exigir definição explícita de um único cargo válido antes da conversão; a migração SHALL NOT escolher um cargo por precedência ou acumular permissões. Conflitos SHALL ser apresentados para resolução explícita; a migração SHALL NOT excluir, mesclar ou desvincular contas automaticamente para viabilizar sua aplicação. Dados anteriormente sobrescritos SHALL NOT ser declarados recuperados sem uma fonte verificável.

#### Scenario: Matrículas duplicadas existentes
- **WHEN** a inspeção encontra duas contas com a mesma matrícula não vazia
- **THEN** a aplicação da garantia de unicidade SHALL aguardar decisão explícita, preservando ambas as contas existentes

#### Scenario: Conta legada com vários cargos
- **WHEN** a inspeção encontra uma conta com mais de um cargo
- **THEN** a conversão dessa conta SHALL aguardar a definição explícita do cargo único, sem escolher automaticamente o de maior privilégio nem criar contas adicionais

#### Scenario: Registro ausente sem fonte de recuperação
- **WHEN** um cadastro relatado como desaparecido não é encontrado no banco nem em backup ou histórico verificável
- **THEN** a verificação SHALL registrar a ausência de evidência de recuperação, sem inventar dados nem declarar o cadastro restaurado

### Requirement: Migração preserva identidades e vínculos existentes

A transição SHALL preservar usuários, matrículas e vínculos existentes válidos, mantendo os identificadores já referenciados ou um mapeamento verificável que atualize suas referências conjuntamente. Preenchimentos existentes SHALL manter seus valores e a identificação da definição utilizada na transição para o catálogo fixo, sem exigir a publicação de versões pela gestão. Alterações de schema SHALL ser versionadas e sua aplicação SHALL ser rastreável. Reexecução de uma migração concluída SHALL NOT duplicar dados nem reaplicar transformações destrutivas.

#### Scenario: Contas e matrículas anteriores à integração
- **WHEN** a integração completa é aplicada a um banco com contas e matrículas válidas
- **THEN** esses registros SHALL continuar identificáveis e consultáveis com seus vínculos preservados após a implantação

#### Scenario: Reexecução após aplicação concluída
- **WHEN** o procedimento de implantação é executado novamente sobre uma versão de banco já migrada
- **THEN** o sistema SHALL reconhecer as alterações aplicadas e preservar os dados sem duplicar cadastros ou cargas iniciais

#### Scenario: Preenchimento anterior ao catálogo fixo
- **WHEN** um documento preenchido válido é migrado para a operação com Kit de Estágio fixo
- **THEN** o sistema SHALL preservar seus valores e referência de definição sem convertê-lo silenciosamente para outro formulário nem exigir um editor administrativo

### Requirement: Carga inicial explícita e separada de demonstração

Dados necessários à operação inicial SHALL ser introduzidos por procedimento explícito, rastreável e repetível sem duplicação. Contas e registros de demonstração SHALL permanecer separados dos dados reais. Inicialização, leitura de tabelas vazias ou recuperação de conexão SHALL NOT inserir automaticamente fixtures no banco configurado. Um banco vazio SHALL exigir a preparação explícita dos cadastros necessários, sem habilitar contas de demonstração silenciosamente.

#### Scenario: Banco vazio em ambiente real
- **WHEN** a aplicação encontra tabelas vazias no banco configurado
- **THEN** o sistema SHALL mostrar ausência de dados ou necessidade de preparação, sem criar usuários, senhas ou solicitações de demonstração

#### Scenario: Repetição da carga inicial
- **WHEN** o responsável repete uma carga inicial já concluída
- **THEN** o procedimento SHALL preservar alterações reais e não duplicar nem sobrescrever registros existentes silenciosamente

### Requirement: Estabelecimento de senha para contas legadas

A transição SHALL identificar contas cujas credenciais não estão disponíveis em armazenamento durável e fornecer o fluxo de estabelecimento ou redefinição pelo titular integrado à autenticação adotada, sem um mecanismo paralelo de tokens próprio do domínio. Ela SHALL NOT prometer recuperar senhas a partir de registros de usuário sem credencial, atribuir senha de demonstração a contas reais ou ativar contas pendentes como efeito da migração.

#### Scenario: Conta antiga sem credencial persistida
- **WHEN** uma conta válida é migrada sem hash de senha recuperável
- **THEN** o sistema SHALL preservar a conta e disponibilizar o fluxo autorizado para estabelecer uma nova senha, sem fabricar a senha anterior

#### Scenario: Conta pendente migrada
- **WHEN** uma conta pendente passa pelo procedimento de estabelecimento de senha
- **THEN** o sistema SHALL manter a exigência de aprovação antes do acesso às áreas protegidas

### Requirement: Implantação com recuperação verificável

A implantação SHALL registrar versões de aplicação e banco, ordem de atualização, configuração necessária e estratégia de recuperação compatível com os dados e schema resultantes. Mudanças incompatíveis SHALL NOT ser aplicadas como se a versão anterior da aplicação continuasse utilizável. Recuperação por restauração SHALL explicitar o ponto restaurado e o tratamento das escritas posteriores, sem perda silenciosa de dados.

#### Scenario: Implantação interrompida
- **WHEN** ocorre falha durante a atualização de schema e aplicação
- **THEN** o responsável SHALL conseguir identificar o estado alcançado e executar o procedimento de retomada ou recuperação previamente verificado, sem anunciar implantação concluída

#### Scenario: Restauração de backup anterior
- **WHEN** a recuperação exige restaurar um backup anterior a escritas já aceitas
- **THEN** o procedimento SHALL identificar essas escritas e seu tratamento antes de declarar o ambiente recuperado

### Requirement: Evidências reais de persistência e operação

A conclusão da integração SHALL exigir verificações em banco de testes isolado para restrições, transações e concorrência, e em Preview para conexão real, conclusão do cadastro completo, aprovação, login, persistência após reinício, acesso entre instâncias, falha e recuperação. A validação das duas etapas visuais SHALL demonstrar que uma consulta inicial não cria uma prévia persistida nem reserva dados e que a conclusão permanece válida após reinício do servidor, desde que o navegador ainda mantenha o formulário. As evidências SHALL distinguir cenários executados, resultados e pendências; funcionamento com dados simulados SHALL NOT comprovar conexão com Aiven. Testes automatizados SHALL NOT alterar o banco real dos usuários.

#### Scenario: Validação do cadastro e aprovação
- **WHEN** o fluxo é verificado com uma conta de teste e matrícula livre não registrada
- **THEN** as evidências SHALL demonstrar a permanência da pendência entre instâncias, decisão autorizada e login posterior com a mesma conta e credencial

#### Scenario: Reinício entre consulta inicial e conclusão
- **WHEN** o servidor é reiniciado após a consulta inicial e o navegador envia o formulário completo ainda mantido em memória
- **THEN** a verificação SHALL demonstrar a conclusão após validação integral, sem depender de estado de cadastro anterior no servidor

#### Scenario: Preview destinado à falha de banco
- **WHEN** um Preview de testes é implantado com configuração efetivamente confirmada de banco inacessível
- **THEN** a verificação SHALL demonstrar erro recuperável sem fixtures e recuperação após restabelecimento, sem tratar login com conta simulada como sucesso do teste

#### Scenario: Dependência de acesso ainda não verificada
- **WHEN** não há evidência de conexão a partir da Vercel ou de um cenário operacional obrigatório
- **THEN** o registro de verificação SHALL manter a pendência explícita sem declarar concluída a integração operacional
