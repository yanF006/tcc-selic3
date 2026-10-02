## Purpose

Permite que alunos, coordenadores de estágio, coordenadores de curso e administradores entrem no sistema com e-mail e senha, se cadastrem, recuperem a senha e alcancem apenas as áreas compatíveis com seu papel.

## ADDED Requirements

### Requirement: Autenticação por e-mail e senha

O sistema SHALL autenticar o usuário por e-mail e senha. O e-mail SHALL identificar o usuário, de modo que exista apenas um usuário por e-mail, e a senha SHALL ser armazenada de forma que nunca seja exibida em texto legível.

#### Scenario: Login com credenciais válidas

- **WHEN** o usuário informa e-mail e senha de uma conta existente e ativa
- **THEN** o sistema SHALL autenticar o usuário e levá-lo à área do seu papel

#### Scenario: Login com senha incorreta

- **WHEN** o usuário informa um e-mail existente com senha incorreta
- **THEN** o sistema SHALL recusar o acesso e exibir uma mensagem que não revele se o e-mail existe ou se a senha foi o dado errado

#### Scenario: E-mail inexistente

- **WHEN** o usuário informa um e-mail que não pertence a nenhuma conta
- **THEN** o sistema SHALL exibir a mesma mensagem do cenário de senha incorreta

### Requirement: Cadastro do aluno em duas etapas

O sistema SHALL permitir que apenas o aluno cadastre a si mesmo. O cadastro SHALL ocorrer em duas etapas: a primeira com matrícula, e-mail, senha e confirmação de senha; a segunda com os dados pessoais. O sistema SHALL exigir que o usuário confirme a senha antes de avançar.

#### Scenario: Avanço entre as etapas

- **WHEN** o aluno preenche matrícula, e-mail, senha e confirmação coincidentes
- **THEN** o sistema SHALL validar a senha, verificar a matrícula e então exibir a etapa de dados pessoais

#### Scenario: Confirmação de senha divergente

- **WHEN** a confirmação de senha não coincide com a senha informada
- **THEN** o sistema SHALL bloquear o avanço e sinalizar o erro no campo de confirmação

#### Scenario: E-mail já cadastrado

- **WHEN** o aluno informa um e-mail que já pertence a outro usuário
- **THEN** o sistema SHALL recusar o cadastro e sinalizar que o e-mail já está em uso, sem revelar dados da conta existente

### Requirement: Validação da matrícula no cadastro

O sistema SHALL considerar a matrícula válida quando ela já estiver registrada no sistema, seja por importação do SIGAA, seja por cadastro de administrador. Uma matrícula inválida SHALL gerar uma solicitação de autorização e o cadastro SHALL permanecer pendente.

#### Scenario: Matrícula registrada no sistema

- **WHEN** o aluno informa uma matrícula já registrada
- **THEN** o sistema SHALL concluir o cadastro e liberar o acesso do aluno à sua área

#### Scenario: Matrícula não registrada

- **WHEN** o aluno informa uma matrícula inexistente no sistema
- **THEN** o sistema SHALL manter o cadastro como pendente de autorização e informar que o acesso será liberado após a autorização

### Requirement: Autorização de cadastro pendente

O sistema SHALL permitir que um coordenador de estágio, o coordenador do curso correspondente ou um administrador autorize ou recuse um cadastro pendente, e SHALL notificar o aluno sobre o resultado.

#### Scenario: Autorização concedida

- **WHEN** um Coordenador de Estágio, o Coordenador de Curso do aluno ou um Administrador autoriza um cadastro pendente
- **THEN** o sistema SHALL liberar o acesso do aluno e notificar o resultado

#### Scenario: Autorização recusada

- **WHEN** o responsável recusa um cadastro pendente
- **THEN** o sistema SHALL manter o cadastro inativo, registrar o motivo e notificar o aluno

#### Scenario: Aluno com cadastro pendente tenta acessar o sistema

- **WHEN** um aluno pendente tenta entrar em qualquer área autenticada
- **THEN** o sistema SHALL informar que o cadastro aguarda autorização e não SHALL exibir dados do sistema

### Requirement: Recuperação de senha por e-mail

O sistema SHALL permitir solicitar a redefinição de senha pelo e-mail e SHALL enviar ao e-mail cadastrado um link de redefinição de uso único.

#### Scenario: Solicitação para e-mail cadastrado

- **WHEN** o usuário solicita a redefinição informando um e-mail existente
- **THEN** o sistema SHALL enviar ao e-mail cadastrado o link para definir uma nova senha

#### Scenario: Solicitação para e-mail inexistente

- **WHEN** o usuário solicita a redefinição informando um e-mail que não existe
- **THEN** o sistema SHALL exibir a mesma confirmação de solicitação, sem indicar que o e-mail não está cadastrado

#### Scenario: Uso do link de redefinição

- **WHEN** o usuário acessa o link recebido e define uma nova senha válida
- **THEN** o sistema SHALL alterar a senha e permitir o login com a nova senha

#### Scenario: Link de redefinição reutilizado

- **WHEN** o usuário tenta usar o mesmo link de redefinição novamente
- **THEN** o sistema SHALL recusar a operação e exigir nova solicitação

### Requirement: Alteração de senha autenticado

O sistema SHALL permitir que um usuário autenticado altere a própria senha informando a senha atual, e SHALL exigir a confirmação da nova senha.

#### Scenario: Troca de senha válida

- **WHEN** o usuário autenticado informa a senha atual correta e a nova senha com a confirmação idêntica
- **THEN** o sistema SHALL atualizar a senha e informar o sucesso da troca

#### Scenario: Senha atual incorreta

- **WHEN** o usuário informa uma senha atual incorreta
- **THEN** o sistema SHALL recusar a troca e manter a senha anterior

### Requirement: Sessão do usuário

O sistema SHALL manter a sessão do usuário autenticado entre recarregamentos de página e SHALL encerrá-la nologout, descartando as credenciais mantidas no navegador.

#### Scenario: Navegação após recarregar a página

- **WHEN** o usuário autenticado recarrega uma página interna
- **THEN** o sistema SHALL manter a sessão ativa e exibir o conteúdo da área solicitada

#### Scenario: Encerramento de sessão

- **WHEN** o usuário executa o logout
- **THEN** o sistema SHALL encerrar a sessão, limpar as credenciais e redirecioná-lo para a tela de login

### Requirement: Guarda de rotas por papel

O sistema SHALL proteger todas as áreas autenticadas e SHALL bloquear o acesso de usuários cujo papel não as inclui, sem exibir o conteúdo nem a existência dos dados solicitados.

#### Scenario: Usuário sem sessão acessa área protegida

- **WHEN** uma pessoa não autenticada acessa uma URL de área autenticada
- **THEN** o sistema SHALL redirecioná-la para a tela de login

#### Scenario: Papel incompatível com a área

- **WHEN** um usuário autenticado de um papel acessa a URL de uma área de outro papel
- **THEN** o sistema SHALL exibir um aviso de acesso não autorizado e não SHALL renderizar a área solicitada

#### Scenario: Inatividade de recurso inativado

- **WHEN** um usuário autenticado acessa a URL de um recurso que foi inativado
- **THEN** o sistema SHALL informar que o recurso está inativo e não SHALL permitir sua edição

### Requirement: Navegação por papel

O sistema SHALL exibir na navegação apenas as áreas permitidas ao papel do usuário. A navegação do aluno SHALL conter o logotipo do SELic e os acessos a Documentos, Estágio e Perfil. As navegações de Coordenador de Estágio, Coordenador de Curso e Administrador SHALL conter os acessos correspondentes às permissões de cada papel.

#### Scenario: Navegação do aluno

- **WHEN** um aluno abre qualquer tela autenticada
- **THEN** o sistema SHALL exibir o logotipo do SELic e os acessos a Documentos, Estágio e Perfil, e nenhum acesso administrativo

#### Scenario: Navegação do administrador

- **WHEN** um administrador abre qualquer tela autenticada
- **THEN** o sistema SHALL exibir os acessos de gestão de usuários, templates, matrículas e demais permissões do administrador

#### Scenario: Ocultação de acesso não permitido

- **WHEN** o usuário visualiza a navegação
- **THEN** o sistema SHALL omitir os itens que não pertencem ao seu papel

