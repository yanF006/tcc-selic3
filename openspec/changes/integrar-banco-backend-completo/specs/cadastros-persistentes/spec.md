## Purpose

Manter cadastros acadêmicos, institucionais e solicitações de acesso em uma fonte compartilhada, com aprovação consistente e preservação dos vínculos entre registros.

## ADDED Requirements

### Requirement: Cadastros de apoio duráveis e relacionados

O sistema SHALL persistir cursos, turmas, períodos, instituições concedentes e responsáveis, convênios, orientadores e supervisores, disponibilizando alterações concluídas nas consultas seguintes de qualquer instância. Os vínculos SHALL identificar registros existentes e compatíveis; turma SHALL pertencer a um curso e seus períodos SHALL estar registrados. O cadastro público SHALL oferecer somente opções permitidas pelas regras de situação e vínculo.

#### Scenario: Turma criada em outra instância
- **WHEN** a gestão cadastra uma turma válida com curso e períodos e um aluno abre o cadastro em outra instância
- **THEN** o sistema SHALL oferecer a turma para o curso correspondente com os períodos associados

#### Scenario: Vínculo inexistente ou incompatível
- **WHEN** uma requisição tenta cadastrar um aluno com turma de outro curso ou referência inexistente
- **THEN** o sistema SHALL recusar a operação sem criar um cadastro parcialmente relacionado

#### Scenario: Instituição e responsáveis cadastrados
- **WHEN** um gestor autorizado cadastra uma instituição, seus responsáveis e um convênio válido
- **THEN** o sistema SHALL preservar os vínculos e permitir sua consulta após reinício, oferecendo a instituição nos novos estágios somente quando o convênio estiver ativo

### Requirement: Registro persistente de matrículas válidas

O sistema SHALL persistir matrículas registradas manualmente ou por importação, com nome, curso, origem e data de registro, mantendo distinto o registro que autoriza cadastro do vínculo da matrícula com uma conta. Importação SHALL informar registros aceitos, ignorados e rejeitados e seus motivos. Uma matrícula já registrada SHALL NOT ser duplicada, inclusive em operações concorrentes.

#### Scenario: Matrícula registrada mas ainda sem conta
- **WHEN** uma matrícula é importada e outro processo verifica sua disponibilidade para cadastro
- **THEN** o sistema SHALL identificá-la como registrada e permitir seu uso caso ainda não exista conta vinculada

#### Scenario: Importações concorrentes da mesma matrícula
- **WHEN** duas importações ou lançamentos tentam registrar a mesma matrícula simultaneamente
- **THEN** o sistema SHALL manter um único registro e informar o conflito ou a matrícula ignorada sem sobrescrever o registro anterior silenciosamente

### Requirement: Gestão persistente de contas pela administração

O sistema SHALL permitir à administração cadastrar e editar contas, seu cargo único e vínculos, consultar o perfil completo e inativar ou reativar usuários, persistindo as alterações. Ao cadastrar aluno com matrícula ainda não registrada, o sistema SHALL registrar a matrícula e a conta ativa como uma única operação de negócio, respeitando a unicidade de conta por matrícula. Formulários e perfis SHALL apresentar um único cargo, sem seleção múltipla.

#### Scenario: Cadastro administrativo de aluno
- **WHEN** um administrador cadastra um aluno válido com matrícula ainda não registrada
- **THEN** o sistema SHALL persistir a matrícula e a conta ativa, disponibilizando o perfil em outra instância e o fluxo de estabelecimento de senha ao titular

#### Scenario: Falha no cadastro administrativo
- **WHEN** ocorre falha ao persistir parte do cadastro administrativo que criaria matrícula e conta
- **THEN** o sistema SHALL informar a falha e não deixar matrícula ou conta nova resultante de uma operação parcialmente aplicada

#### Scenario: Alteração de cargo ou curso
- **WHEN** a administração conclui uma alteração autorizada de cargo ou curso de uma conta
- **THEN** as requisições protegidas seguintes SHALL aplicar o cargo único e o vínculo atualizados, sem acumular permissões anteriores nem depender do processo que realizou a edição

### Requirement: Solicitações de acesso completas e estáveis

O sistema SHALL persistir cada solicitação de acesso com referência à conta pendente, matrícula, dados necessários à conferência, motivo, situação e data de criação. A listagem SHALL considerar todas as solicitações autorizadas ao consultante e SHALL apresentar ordenação determinística inclusive em empates, busca, filtros, paginação e totais sobre o conjunto completo. Na ausência de novas mutações, recarregamentos SHALL NOT alternar entre subconjuntos pertencentes a instâncias diferentes.

#### Scenario: Dois cadastros pendentes em processos diferentes
- **WHEN** dois alunos concluem cadastros pendentes em instâncias diferentes e o administrador recarrega a listagem
- **THEN** ambos SHALL permanecer acessíveis na listagem e seu total SHALL incluir as duas solicitações

#### Scenario: Solicitação fora da primeira página
- **WHEN** o responsável busca uma solicitação que não está na primeira página
- **THEN** o sistema SHALL encontrá-la e informar o total filtrado correto

#### Scenario: Restrição da fila por curso
- **WHEN** um coordenador de curso consulta solicitações de acesso
- **THEN** o sistema SHALL apresentar apenas as solicitações do curso sob sua responsabilidade, incluindo essa restrição nos totais

### Requirement: Decisão de acesso atômica e autorizada

O sistema SHALL permitir ao administrador, ao coordenador de estágio ou ao coordenador do curso correspondente decidir uma solicitação pendente. A autorização SHALL persistir a decisão com autor e data, registrar a matrícula quando necessário e ativar a conta vinculada como uma única operação de negócio. A recusa SHALL exigir motivo, persistir a decisão e inativar a conta. Uma solicitação decidida SHALL NOT receber outra decisão nem gerar outra conta. A situação e o resultado SHALL ser consultáveis nos registros e filas autorizados, sem depender de uma notificação geral.

#### Scenario: Autorização visível em outra instância
- **WHEN** um responsável autorizado aprova uma solicitação pendente
- **THEN** outra instância SHALL reconhecer a conta ativa, a matrícula registrada e a solicitação decidida com autor e data, permitindo login com a credencial estabelecida

#### Scenario: Recusa de cadastro
- **WHEN** um responsável autorizado recusa uma solicitação pendente com motivo
- **THEN** o sistema SHALL persistir motivo, autor e data, apresentar o resultado na solicitação e manter a conta sem acesso

#### Scenario: Decisões concorrentes
- **WHEN** dois responsáveis tentam decidir a mesma solicitação simultaneamente
- **THEN** somente uma decisão SHALL ser aplicada e a outra tentativa SHALL informar que a solicitação já foi decidida, sem duplicar efeitos

#### Scenario: Falha durante a autorização
- **WHEN** uma falha impede concluir qualquer alteração necessária à autorização
- **THEN** o sistema SHALL manter a solicitação pendente e a conta sem liberação, sem publicar matrícula ou decisão parcial daquela autorização

#### Scenario: Decisão por outro curso
- **WHEN** um coordenador de curso tenta decidir uma solicitação de outro curso
- **THEN** o sistema SHALL negar a operação e preservar conta e solicitação

### Requirement: Inativação e remoção preservam integridade

O sistema SHALL impedir exclusão física de curso, turma, período ou convênio quando houver dependências protegidas pelas regras do domínio, oferecendo inativação quando aplicável. Inativação SHALL retirar o registro das seleções de novos vínculos sem romper consultas históricas. Exclusão autorizada de pessoas ou contas SHALL permitir remover seus dados pessoais e bloquear seu acesso, preservando referências e informações históricas necessárias sem reintroduzir dados pessoais removidos.

#### Scenario: Curso com vínculos
- **WHEN** um gestor tenta excluir um curso com aluno, turma, estágio ou documento vinculado
- **THEN** o sistema SHALL recusar a exclusão e permitir a inativação, mantendo os registros históricos consultáveis

#### Scenario: Convênio expirado
- **WHEN** o convênio é inativado ou ultrapassa sua vigência
- **THEN** o sistema SHALL removê-lo das opções para novos estágios e preservar os estágios já vinculados

#### Scenario: Remoção de dados pessoais com histórico
- **WHEN** a exclusão autorizada de uma pessoa ou conta remove seus dados pessoais
- **THEN** consultas em outra instância e após reinício SHALL preservar os vínculos históricos permitidos sem restaurar os dados removidos a partir de cópias antigas
