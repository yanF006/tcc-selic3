## Purpose

Garantir que cadastro, credenciais e sessões do SELic sejam duráveis e utilizáveis entre instâncias, preservando a aprovação de matrícula e as permissões dos usuários.

## ADDED Requirements

### Requirement: Credencial durável para contas cadastradas

O sistema SHALL permitir autenticar uma conta ativa com a senha estabelecida pelo titular após reinício da aplicação e em outra instância. Senhas SHALL ser armazenadas por mecanismo de hash apropriado para senhas e SHALL NOT ser recuperáveis em texto legível, expostas em respostas ou registradas em logs. Contas criadas pela administração SHALL dispor de um fluxo de estabelecimento de senha pelo titular, sem depender de uma senha de demonstração.

#### Scenario: Cadastro seguido de login em outra instância
- **WHEN** um aluno conclui um cadastro ativo e tenta entrar com a senha escolhida em outra instância ou após reinício
- **THEN** o sistema SHALL autenticar a mesma conta e preservar seus dados e vínculos

#### Scenario: Conta criada pela administração
- **WHEN** o titular de uma conta ativa criada pela administração estabelece uma senha pelo fluxo autorizado
- **THEN** o sistema SHALL permitir login com essa senha em qualquer instância, sem exigir acesso à memória do processo que criou a conta

#### Scenario: Credenciais inválidas
- **WHEN** uma pessoa informa senha incorreta ou e-mail inexistente
- **THEN** o sistema SHALL recusar o acesso com a mesma mensagem genérica para os dois casos, sem divulgar credenciais ou dados da conta

### Requirement: Cadastro em duas etapas visuais com conclusão única

O sistema SHALL apresentar o cadastro em duas etapas visuais e manter os dados ainda não concluídos somente no estado temporário do formulário do navegador, sem prévia persistida no servidor nem senha em armazenamento persistente do navegador. A primeira etapa SHALL permitir validar o formato e consultar a disponibilidade de e-mail e matrícula, sem reservá-los nem criar conta, credencial ou solicitação. A conclusão SHALL receber todos os dados e revalidar matrícula, e-mail, senha, confirmação, dados pessoais e vínculos acadêmicos no servidor, sem confiar em uma validação anterior ou depender da memória da instância que a realizou.

#### Scenario: Etapas atendidas por processos diferentes
- **WHEN** uma consulta da primeira etapa é atendida por uma instância e o formulário completo é enviado a outra
- **THEN** o sistema SHALL permitir a conclusão após validar todos os dados recebidos, sem exigir uma prévia ou token de continuidade criado pela primeira instância

#### Scenario: Abandono ou recarregamento antes da conclusão
- **WHEN** o aluno fecha ou recarrega a página antes de concluir o cadastro
- **THEN** o sistema SHALL exigir reiniciar o preenchimento, sem manter conta, credencial, solicitação ou prévia persistida por causa das etapas incompletas

#### Scenario: Conclusão com dados alterados ou inválidos
- **WHEN** a conclusão recebe dados inválidos, ainda que uma consulta anterior tenha indicado disponibilidade ou permitido avançar
- **THEN** o sistema SHALL recusar a conclusão e sinalizar o erro sem criar registros parciais

#### Scenario: Repetição da conclusão
- **WHEN** os mesmos dados são enviados novamente após uma conclusão bem-sucedida
- **THEN** o sistema SHALL impedir cadastro duplicado por e-mail ou matrícula, sem substituir a conta, a credencial ou a solicitação já criada

### Requirement: Cargo único por usuário

Cada usuário SHALL possuir exatamente um cargo entre aluno, coordenador de curso, coordenador de estágio e administrador. A participação na Comissão de Estágio SHALL ser uma condição permitida somente ao coordenador de estágio, sem constituir outro cargo. O cadastro público SHALL criar exclusivamente contas de aluno; cargos de gestão SHALL ser atribuídos somente por operação administrativa autorizada. A autorização SHALL usar o cargo atual registrado, sem acumular permissões de cargos anteriores.

#### Scenario: Cadastro com múltiplos cargos
- **WHEN** uma operação tenta atribuir mais de um cargo à mesma conta ou nenhum cargo válido
- **THEN** o sistema SHALL recusar a operação sem persistir uma conta com cargo ambíguo

#### Scenario: Cargo de gestão enviado no cadastro público
- **WHEN** o cliente tenta concluir o cadastro público solicitando cargo administrativo ou de coordenação
- **THEN** o sistema SHALL NOT conceder esse cargo e SHALL manter o cadastro público restrito a aluno

#### Scenario: Troca administrativa de cargo
- **WHEN** a administração substitui o cargo de uma conta por outro cargo válido
- **THEN** as requisições seguintes SHALL aplicar somente as permissões do novo cargo e remover condições incompatíveis, como participação na comissão quando a conta deixa de ser coordenador de estágio

### Requirement: Situação da conta governa o acesso

O sistema SHALL liberar acesso autenticado somente para contas ativas. Cadastro público com matrícula registrada e ainda livre SHALL resultar em conta ativa; com matrícula livre ainda não registrada SHALL resultar em conta pendente e solicitação de aprovação persistida. Contas pendentes ou inativas SHALL NOT acessar áreas protegidas, inclusive com sessão anteriormente emitida.

#### Scenario: Aluno com matrícula registrada
- **WHEN** o aluno conclui um cadastro válido para uma matrícula registrada e sem conta vinculada
- **THEN** o sistema SHALL persistir a conta ativa e sua credencial e permitir o login

#### Scenario: Cadastro depende de aprovação
- **WHEN** o aluno conclui um cadastro válido para uma matrícula livre não registrada
- **THEN** o sistema SHALL persistir conta pendente, credencial e solicitação, informar o aguardo de autorização e bloquear áreas protegidas

#### Scenario: Conta inativada durante uma sessão
- **WHEN** a administração inativa uma conta que mantém uma sessão aberta e essa conta faz nova requisição protegida
- **THEN** o sistema SHALL bloquear o acesso, inclusive quando a inativação foi feita em outra instância

### Requirement: Sessões consistentes entre instâncias

O sistema SHALL manter a identificação da conta em sessões válidas entre navegações, recarregamentos e instâncias, com expiração controlada. Logout SHALL invalidar a sessão encerrada para requisições posteriores em qualquer instância. O cliente SHALL NOT poder escolher a identidade, o cargo ou o curso autorizado pela manipulação dos dados de sessão.

#### Scenario: Recarregamento com sessão válida
- **WHEN** uma sessão válida é apresentada em outra instância após recarregar a página
- **THEN** o sistema SHALL reconhecer a mesma conta e aplicar suas permissões atuais

#### Scenario: Sessão encerrada ou expirada
- **WHEN** uma sessão encerrada por logout ou já expirada é reutilizada em outra instância
- **THEN** o sistema SHALL recusar o acesso protegido e exigir autenticação

#### Scenario: Manipulação da identidade ou papel
- **WHEN** o cliente altera dados apresentados como sessão para se identificar como administrador
- **THEN** o sistema SHALL recusar a identidade adulterada sem conceder privilégios

### Requirement: Alteração e recuperação duráveis de senha

O sistema SHALL permitir trocar a senha mediante conferência da senha atual e confirmação da nova senha, e recuperar ou estabelecer acesso por link de uso único enviado ao e-mail cadastrado. O link SHALL possuir validade limitada e SHALL NOT poder ser usado para outra conta. A solicitação pública SHALL apresentar resposta que não revele a existência da conta; falhas de envio SHALL ser diagnosticáveis sem marcar entrega inexistente como sucesso. A senha anterior SHALL deixar de autenticar após a alteração concluída. Uma nova solicitação SHALL permitir tentar novamente a entrega sem exigir uma central de mensagens ou reprocessamento de e-mails na interface.

#### Scenario: Troca autenticada em outra instância
- **WHEN** o titular troca a senha corretamente e tenta autenticar em outra instância
- **THEN** o sistema SHALL aceitar a nova senha e recusar a anterior

#### Scenario: Senha atual incorreta
- **WHEN** o titular tenta trocar a senha informando a senha atual incorreta
- **THEN** o sistema SHALL recusar a alteração e preservar a credencial existente

#### Scenario: Link de recuperação válido
- **WHEN** o titular usa um link válido recebido em seu e-mail para definir uma nova senha
- **THEN** o sistema SHALL persistir a nova credencial e consumir a autorização de redefinição de forma indivisível

#### Scenario: Link inválido ou reutilizado concorrentemente
- **WHEN** um link expirado, adulterado ou já consumido é apresentado, ou duas requisições tentam consumi-lo simultaneamente
- **THEN** o sistema SHALL rejeitar o link inválido e permitir no máximo uma redefinição com o mesmo link

#### Scenario: Falha ao entregar recuperação
- **WHEN** o serviço de envio não aceita a mensagem de recuperação de uma conta existente
- **THEN** o sistema SHALL preservar a senha atual, registrar a falha de envio e manter a resposta pública sem revelar a existência da conta

#### Scenario: Nova solicitação após falha de envio
- **WHEN** o titular solicita novamente a recuperação após uma falha de entrega
- **THEN** o sistema SHALL permitir uma nova tentativa de envio pelo fluxo de recuperação, respeitando seus limites de uso e sem exigir intervenção em uma fila própria de mensagens

### Requirement: Autorização aplicada nas operações de servidor

O sistema SHALL verificar a conta ativa e suas permissões atuais em cada leitura ou alteração protegida, independentemente da navegação exibida. Alunos SHALL acessar somente seus registros; coordenadores de curso SHALL respeitar o recorte de curso; coordenação de estágio e administração SHALL respeitar as permissões específicas de cada ação, sem tornar papéis equivalentes.

#### Scenario: Acesso direto a registro de outro aluno
- **WHEN** um aluno tenta consultar ou alterar um registro pertencente a outro aluno por requisição direta
- **THEN** o sistema SHALL negar o acesso sem exibir o conteúdo nem alterar o registro

#### Scenario: Acesso cruzado entre cursos
- **WHEN** um coordenador de curso tenta consultar ou alterar um registro fora do seu curso autorizado
- **THEN** o sistema SHALL negar o acesso mesmo que o cliente envie o identificador de outro curso
