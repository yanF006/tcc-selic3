# Autenticação e acesso

## Purpose

Permite que alunos, coordenadores de estágio, coordenadores de curso e administradores entrem no sistema com e-mail e senha, se cadastrem, recuperem a senha e alcancem apenas as áreas compatíveis com seu cargo, com credenciais, sessões, solicitações de acesso e decisões duráveis entre reinícios e instâncias.

## Requirements

### Requirement: Autenticação por e-mail e senha

O sistema SHALL autenticar o usuário por e-mail e senha. O e-mail SHALL identificar o usuário, de modo que exista apenas um usuário por e-mail. Senhas SHALL ser armazenadas por mecanismo de hash apropriado para senhas e SHALL NOT ser recuperáveis em texto legível, expostas em respostas ou registradas em logs. A credencial SHALL valer após reinício da aplicação e em qualquer instância. Contas criadas pela administração SHALL dispor de um fluxo de estabelecimento de senha pelo titular, sem depender de uma senha de demonstração.

#### Scenario: Login com credenciais válidas

- **WHEN** o usuário informa e-mail e senha de uma conta existente e ativa, inclusive em outra instância ou após reinício
- **THEN** o sistema SHALL autenticar o usuário, preservar seus dados e vínculos e levá-lo à área do seu cargo

#### Scenario: Login com senha incorreta

- **WHEN** o usuário informa um e-mail existente com senha incorreta
- **THEN** o sistema SHALL recusar o acesso e exibir uma mensagem que não revele se o e-mail existe ou se a senha foi o dado errado

#### Scenario: E-mail inexistente

- **WHEN** o usuário informa um e-mail que não pertence a nenhuma conta
- **THEN** o sistema SHALL exibir a mesma mensagem do cenário de senha incorreta

#### Scenario: Conta criada pela administração

- **WHEN** o titular de uma conta ativa criada pela administração estabelece uma senha pelo link recebido no e-mail cadastrado
- **THEN** o sistema SHALL permitir login com essa senha em qualquer instância

### Requirement: Cadastro do aluno em duas etapas

O sistema SHALL permitir que apenas o aluno cadastre a si mesmo, em duas etapas visuais: a primeira com matrícula, e-mail, senha e confirmação de senha; a segunda com os dados pessoais e os vínculos acadêmicos. Os dados ainda não concluídos SHALL permanecer somente no estado temporário do formulário do navegador, sem prévia persistida no servidor nem senha em armazenamento persistente do navegador. A primeira etapa SHALL validar o formato e consultar a disponibilidade de e-mail e matrícula, sem reservá-los nem criar conta, credencial ou solicitação. A conclusão SHALL revalidar no servidor todos os dados recebidos, sem confiar em validação anterior nem depender da instância que a realizou. Uma matrícula SHALL estar vinculada a no máximo uma conta, qualquer que seja a situação dessa conta. Mensagens de indisponibilidade SHALL NOT revelar se o e-mail ou a matrícula pertencem a uma conta existente.

#### Scenario: Avanço entre as etapas

- **WHEN** o aluno preenche matrícula, e-mail, senha e confirmação coincidentes e disponíveis
- **THEN** o sistema SHALL validar a senha, verificar a matrícula e então exibir a etapa de dados pessoais

#### Scenario: Confirmação de senha divergente

- **WHEN** a confirmação de senha não coincide com a senha informada
- **THEN** o sistema SHALL bloquear o avanço e sinalizar o erro no campo de confirmação

#### Scenario: E-mail já cadastrado

- **WHEN** o aluno informa um e-mail que já pertence a outro usuário
- **THEN** o sistema SHALL recusar o avanço com mensagem genérica, sem revelar que a conta existe nem dados dela

#### Scenario: Matrícula já vinculada a outra conta

- **WHEN** o aluno informa, com outro e-mail, uma matrícula já vinculada a uma conta ativa, pendente ou inativa
- **THEN** o sistema SHALL recusar a primeira etapa e a conclusão, sem criar conta, credencial ou solicitação

#### Scenario: Matrícula ocupada entre as etapas

- **WHEN** outra conta é concluída com a mesma matrícula depois da primeira etapa e antes da conclusão
- **THEN** o sistema SHALL recusar a conclusão posterior, mantendo uma única conta para a matrícula e nenhuma credencial ou solicitação para o cadastro recusado

#### Scenario: Etapas atendidas por instâncias diferentes

- **WHEN** a consulta da primeira etapa é atendida por uma instância e o formulário completo é enviado a outra
- **THEN** o sistema SHALL permitir a conclusão após validar todos os dados recebidos, sem exigir prévia ou token de continuidade

#### Scenario: Abandono ou recarregamento antes da conclusão

- **WHEN** o aluno fecha ou recarrega a página antes de concluir o cadastro
- **THEN** o sistema SHALL exigir reiniciar o preenchimento, sem manter conta, credencial, solicitação ou prévia persistida

#### Scenario: Conclusão com dados alterados ou inválidos

- **WHEN** a conclusão recebe dados inválidos, ainda que uma consulta anterior tenha permitido avançar
- **THEN** o sistema SHALL recusar a conclusão e sinalizar o erro sem criar registros parciais

#### Scenario: Repetição ou concorrência da conclusão

- **WHEN** os mesmos dados são enviados novamente ou duas conclusões da mesma matrícula ocorrem simultaneamente
- **THEN** o sistema SHALL criar no máximo uma conta, uma credencial e uma solicitação, sem substituir os registros já criados

### Requirement: Validação da matrícula e situação da conta

A matrícula SHALL seguir o formato do SIGAA, com onze dígitos. O sistema SHALL considerar a matrícula válida quando ela já estiver registrada no sistema, por importação ou por cadastro de administrador. O cadastro público com matrícula registrada e livre SHALL resultar em conta ativa; com matrícula livre ainda não registrada, SHALL resultar em conta pendente e solicitação de autorização persistida. Somente contas ativas SHALL acessar áreas autenticadas; contas pendentes ou inativas SHALL NOT acessá-las, inclusive com sessão anteriormente emitida.

#### Scenario: Matrícula fora do formato

- **WHEN** o aluno informa uma matrícula que não tem onze dígitos
- **THEN** o sistema SHALL recusar a primeira etapa e sinalizar o campo de matrícula

#### Scenario: Matrícula registrada no sistema

- **WHEN** o aluno conclui um cadastro válido com matrícula registrada e sem conta vinculada
- **THEN** o sistema SHALL persistir a conta ativa e sua credencial e liberar o acesso do aluno à sua área

#### Scenario: Matrícula não registrada

- **WHEN** o aluno conclui um cadastro válido com matrícula livre que não está registrada
- **THEN** o sistema SHALL persistir conta pendente, credencial e solicitação e informar que o acesso será liberado após a autorização

#### Scenario: Aluno com cadastro pendente tenta acessar o sistema

- **WHEN** um aluno pendente tenta entrar em qualquer área autenticada
- **THEN** o sistema SHALL informar que o cadastro aguarda autorização e SHALL NOT exibir dados do sistema

#### Scenario: Conta inativada durante uma sessão

- **WHEN** a administração inativa uma conta que mantém uma sessão aberta e essa conta faz nova requisição protegida, inclusive em outra instância
- **THEN** o sistema SHALL bloquear o acesso

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
- **THEN** as requisições seguintes SHALL aplicar somente as permissões do novo cargo e remover condições incompatíveis, como a participação na comissão quando a conta deixa de ser coordenador de estágio

### Requirement: Autorização de cadastro pendente

O sistema SHALL persistir cada solicitação de acesso com referência à conta pendente, matrícula, dados necessários à conferência, motivo, situação e data de criação. Um coordenador de estágio, o coordenador do curso correspondente ou um administrador SHALL poder decidir uma solicitação pendente. A autorização SHALL persistir a decisão com autor e data, registrar a matrícula quando necessário e ativar a conta como uma única operação. A recusa SHALL exigir motivo, persistir a decisão e inativar a conta. Uma solicitação decidida SHALL NOT receber outra decisão nem gerar outra conta. O resultado SHALL ser consultável na solicitação e refletido no acesso do aluno, sem depender de notificação. A listagem SHALL considerar todas as solicitações autorizadas ao consultante, com ordenação determinística, busca, filtros, paginação e totais sobre o conjunto completo.

#### Scenario: Autorização concedida

- **WHEN** um responsável autorizado aprova uma solicitação pendente
- **THEN** o sistema SHALL registrar a matrícula como válida quando ela ainda não estiver registrada, ativar a conta e persistir autor e data, permitindo o login do aluno em qualquer instância

#### Scenario: Autorização recusada

- **WHEN** um responsável autorizado recusa uma solicitação pendente com motivo
- **THEN** o sistema SHALL persistir motivo, autor e data, apresentar o resultado na solicitação e manter a conta inativa, sem acesso

#### Scenario: Decisões concorrentes

- **WHEN** dois responsáveis tentam decidir a mesma solicitação simultaneamente
- **THEN** somente uma decisão SHALL ser aplicada e a outra tentativa SHALL informar que a solicitação já foi decidida

#### Scenario: Falha durante a autorização

- **WHEN** uma falha impede concluir qualquer alteração necessária à autorização
- **THEN** o sistema SHALL manter a solicitação pendente e a conta sem liberação, sem matrícula ou decisão parcialmente aplicada

#### Scenario: Decisão por outro curso

- **WHEN** um coordenador de curso tenta decidir uma solicitação de outro curso
- **THEN** o sistema SHALL negar a operação e preservar conta e solicitação

#### Scenario: Listagem completa e restrita

- **WHEN** o responsável busca uma solicitação que não está na primeira página, ou um coordenador de curso consulta a fila
- **THEN** o sistema SHALL encontrá-la e informar o total filtrado correto, apresentando ao coordenador de curso apenas as solicitações do seu curso

### Requirement: Recuperação de senha por e-mail

O sistema SHALL permitir solicitar a redefinição de senha pelo e-mail e SHALL enviar ao e-mail cadastrado um link de redefinição de uso único, com validade limitada e que não serve a outra conta. A resposta pública SHALL NOT revelar a existência da conta. Falhas de envio SHALL ser diagnosticáveis sem marcar entrega inexistente como sucesso, e uma nova solicitação SHALL permitir tentar novamente a entrega.

#### Scenario: Solicitação para e-mail cadastrado

- **WHEN** o usuário solicita a redefinição informando um e-mail existente
- **THEN** o sistema SHALL enviar ao e-mail cadastrado o link para definir uma nova senha

#### Scenario: Solicitação para e-mail inexistente

- **WHEN** o usuário solicita a redefinição informando um e-mail que não existe
- **THEN** o sistema SHALL exibir a mesma confirmação de solicitação, sem indicar que o e-mail não está cadastrado

#### Scenario: Uso do link de redefinição

- **WHEN** o usuário acessa o link recebido e define uma nova senha válida
- **THEN** o sistema SHALL persistir a nova credencial, consumir o link e permitir o login somente com a nova senha

#### Scenario: Link inválido, reutilizado ou usado concorrentemente

- **WHEN** um link expirado, adulterado ou já consumido é apresentado, ou duas requisições tentam consumi-lo simultaneamente
- **THEN** o sistema SHALL recusar o link inválido, permitir no máximo uma redefinição e exigir nova solicitação

#### Scenario: Falha ao entregar a recuperação

- **WHEN** o serviço de envio não aceita a mensagem de recuperação de uma conta existente
- **THEN** o sistema SHALL preservar a senha atual, registrar a falha e manter a resposta pública sem revelar a existência da conta, permitindo nova solicitação

### Requirement: Alteração de senha autenticado

O sistema SHALL permitir que um usuário autenticado altere a própria senha informando a senha atual, e SHALL exigir a confirmação da nova senha. A senha anterior SHALL deixar de autenticar em qualquer instância após a alteração.

#### Scenario: Troca de senha válida

- **WHEN** o usuário autenticado informa a senha atual correta e a nova senha com a confirmação idêntica
- **THEN** o sistema SHALL atualizar a senha, informar o sucesso e, em qualquer instância, aceitar a nova senha e recusar a anterior

#### Scenario: Senha atual incorreta

- **WHEN** o usuário informa uma senha atual incorreta
- **THEN** o sistema SHALL recusar a troca e manter a senha anterior

### Requirement: Sessão do usuário

O sistema SHALL manter a sessão do usuário autenticado entre navegações, recarregamentos e instâncias, com expiração controlada, e SHALL encerrá-la no logout para requisições posteriores em qualquer instância. O cliente SHALL NOT poder escolher a identidade, o cargo ou o curso autorizado pela manipulação dos dados de sessão.

#### Scenario: Navegação após recarregar a página

- **WHEN** o usuário autenticado recarrega uma página interna, ainda que a requisição seja atendida por outra instância
- **THEN** o sistema SHALL reconhecer a mesma conta, aplicar suas permissões atuais e exibir o conteúdo da área solicitada

#### Scenario: Encerramento de sessão

- **WHEN** o usuário executa o logout
- **THEN** o sistema SHALL encerrar a sessão, limpar as credenciais do navegador e redirecioná-lo para a tela de login

#### Scenario: Sessão encerrada ou expirada

- **WHEN** uma sessão encerrada por logout ou já expirada é reutilizada em outra instância
- **THEN** o sistema SHALL recusar o acesso protegido e exigir autenticação

#### Scenario: Manipulação da identidade ou do cargo

- **WHEN** o cliente altera dados apresentados como sessão para se identificar como outra conta ou outro cargo
- **THEN** o sistema SHALL recusar a identidade adulterada sem conceder privilégios

### Requirement: Guarda de rotas e de operações por cargo

O sistema SHALL proteger todas as áreas autenticadas e SHALL verificar a conta ativa e suas permissões atuais em cada leitura ou alteração protegida, independentemente da navegação exibida. Usuários cujo cargo não inclui a área SHALL ser bloqueados sem que o conteúdo ou a existência dos dados solicitados seja exibido. Alunos SHALL acessar somente seus registros; coordenadores de curso SHALL respeitar o recorte de curso.

#### Scenario: Usuário sem sessão acessa área protegida

- **WHEN** uma pessoa não autenticada acessa uma URL de área autenticada
- **THEN** o sistema SHALL redirecioná-la para a tela de login

#### Scenario: Cargo incompatível com a área

- **WHEN** um usuário autenticado acessa a URL de uma área de outro cargo
- **THEN** o sistema SHALL exibir um aviso de acesso não autorizado e SHALL NOT renderizar a área solicitada

#### Scenario: Acesso direto a registro de outro aluno

- **WHEN** um aluno tenta consultar ou alterar um registro pertencente a outro aluno por requisição direta
- **THEN** o sistema SHALL negar o acesso sem exibir o conteúdo nem alterar o registro

#### Scenario: Acesso cruzado entre cursos

- **WHEN** um coordenador de curso tenta consultar ou alterar um registro fora do seu curso
- **THEN** o sistema SHALL negar o acesso mesmo que o cliente envie o identificador de outro curso

#### Scenario: Recurso inativado

- **WHEN** um usuário autenticado acessa a URL de um recurso que foi inativado
- **THEN** o sistema SHALL informar que o recurso está inativo e SHALL NOT permitir sua edição

### Requirement: Navegação por cargo

O sistema SHALL exibir na navegação apenas as áreas permitidas ao cargo do usuário. A navegação do aluno SHALL conter o logotipo do SELic e os acessos a Documentos, Estágio e Perfil. As navegações de Coordenador de Estágio, Coordenador de Curso e Administrador SHALL conter os acessos correspondentes às permissões de cada cargo.

#### Scenario: Navegação do aluno

- **WHEN** um aluno abre qualquer tela autenticada
- **THEN** o sistema SHALL exibir o logotipo do SELic e os acessos a Documentos, Estágio e Perfil, e nenhum acesso de gestão

#### Scenario: Navegação do administrador

- **WHEN** um administrador abre qualquer tela autenticada
- **THEN** o sistema SHALL exibir os acessos de gestão de usuários, matrículas, convênios, solicitações de acesso, estatísticas e demais áreas permitidas ao administrador

#### Scenario: Ocultação de acesso não permitido

- **WHEN** o usuário visualiza a navegação
- **THEN** o sistema SHALL omitir os itens que não pertencem ao seu cargo

#### Scenario: Acessos agrupados em menus

- **WHEN** os acessos de um cargo não cabem na linha principal da navegação
- **THEN** o sistema SHALL agrupá-los em menus por área, mantendo cada acesso permitido alcançável a partir da navegação
