## Purpose

Define a apresentação visual do SELic em todo o sistema: a paleta com verde como cor principal, os temas claro e escuro, a identidade visual do sistema e a adaptação da interface a celulares e computadores.

## ADDED Requirements

### Requirement: Verde como cor principal

O sistema SHALL usar o verde como cor principal da identidade visual, e as demais cores SHALL ser derivadas dessa paleta, aplicadas de forma consistente em navegação, ações principais e estados ativos.

#### Scenario: Uso da cor principal

- **WHEN** o usuário visualiza qualquer tela autenticada
- **THEN** a navegação, o elemento ativo da navegação e as ações principais SHALL usar a cor principal da identidade

#### Scenario: Estados inativos

- **WHEN** o usuário visualiza itens de navegação e ações que não estão em uso
- **THEN** o sistema SHALL apresentá-los com cor secundária, distinguindo-os dos elementos ativos sem depender apenas de cor

### Requirement: Temas claro e escuro

O sistema SHALL oferecer um tema claro e um tema escuro, e o usuário SHALL poder alternar entre eles; todas as telas SHALL ser legíveis nos dois temas.

#### Scenario: Alternância de tema

- **WHEN** o usuário alterna o tema pela interface
- **THEN** o sistema SHALL aplicar o novo tema a todas as telas, sem exigir novo carregamento da página

#### Scenario: Telas de áreas diferentes

- **WHEN** o usuário alterna o tema e percorre login, documentos, estágios, pareceres e estatísticas
- **THEN** todas essas telas SHALL ser exibidas no tema escolhido

### Requirement: Preferência de tema

O sistema SHALL oferecer as opções de tema claro, tema escuro e acompanhar a preferência do sistema, e SHALL manter a escolha do usuário entre sessões.

#### Scenario: Acompanhamento da preferência do sistema

- **WHEN** o usuário mantém a opção de acompanhar o sistema e altera a aparência do sistema operacional entre claro e escuro
- **THEN** o sistema SHALL aplicar o tema correspondente ao do sistema operacional

#### Scenario: Escolha explícita de tema

- **WHEN** o usuário escolhe explicitamente o tema escuro
- **THEN** o sistema SHALL manter o tema escuro, mesmo que a preferência do sistema operacional seja diferente

#### Scenario: Manutenção da preferência

- **WHEN** o usuário escolhe um tema, fecha a sessão e volta a entrar no sistema
- **THEN** o sistema SHALL iniciar exibindo o tema escolhido

### Requirement: Ausência de piscada de tema na abertura

O sistema SHALL aplicar o tema escolhido já na primeira renderização das páginas, sem exibir momentaneamente o tema padrão antes do tema escolhido.

#### Scenario: Abertura de página com tema escuro escolhido

- **WHEN** o usuário com tema escuro escolhido abre uma página do sistema
- **THEN** o sistema SHALL exibir a página já no tema escuro, sem exibir antes o tema claro

#### Scenario: Abertura de página sem preferência definida

- **WHEN** um usuário sem preferência de tema definida abre uma página do sistema
- **THEN** o sistema SHALL aplicar o tema correspondente à preferência do sistema operacional

### Requirement: Contraste nos dois temas

O sistema SHALL manter contraste suficiente em ambos os temas para textos, rótulos de formulário, bordas, indicadores de foco e sinalizações de situação de documento, e SHALL diferenciar as situações de documento por rótulo textual, e não apenas por cor.

#### Scenario: Sinalização de situação de documento

- **WHEN** o usuário visualiza um documento com situação de rascunho, submetido, em análise, aprovado ou indeferido
- **THEN** o sistema SHALL apresentar a situação legível e identificável por texto nos dois temas

#### Scenario: Indicador de foco do teclado

- **WHEN** o usuário navega pelos elementos da tela pelo teclado
- **THEN** o sistema SHALL apresentar indicador de foco visível e com contraste suficiente nos dois temas

#### Scenario: Mensagem de erro de campo

- **WHEN** um campo de formulário apresenta mensagem de erro
- **THEN** a mensagem SHALL permanecer legível e identificável como erro nos dois temas

### Requirement: Preview de documento independente do tema

O sistema SHALL exibir o preview do documento com fundo claro e texto escuro, independentemente do tema da interface, por se tratar de conteúdo destinado a impressão.

#### Scenario: Preview no tema escuro

- **WHEN** o usuário com tema escuro visualiza o preview de um documento preenchido
- **THEN** o sistema SHALL exibir o documento com fundo claro e texto escuro, sem inverter as cores do conteúdo

#### Scenario: Impressão de documento

- **WHEN** o usuário imprime a página de preview de um documento
- **THEN** o sistema SHALL imprimir o documento com fundo branco e texto preto, sem áreas escuras de fundo

### Requirement: Identidade visual do SELic

O sistema SHALL exibir o logotipo do SELic na navegação e o ícone do sistema no navegador, e esses elementos SHALL ser legíveis nos dois temas.

#### Scenario: Logotipo na navegação

- **WHEN** o usuário visualiza a navegação em qualquer tema
- **THEN** o logotipo do SELic SHALL estar presente e legível sobre o fundo da navegação

#### Scenario: Logotipo ilegível no tema escolhido

- **WHEN** o logotipo não mantém contraste suficiente no tema aplicado
- **THEN** o sistema SHALL exibir a variante do logotipo adequada ao tema em uso

### Requirement: Interface responsiva

O sistema SHALL adaptar a interface a celulares e a computadores, mantendo a navegação e as ações principais acessíveis em ambos os tamanhos de tela e sem exigir rolagem horizontal indevida.

#### Scenario: Uso em celular

- **WHEN** o usuário acessa qualquer tela do sistema em um celular
- **THEN** o sistema SHALL exibir o conteúdo sem cortes horizontais e SHALL manter as ações principais acessíveis

#### Scenario: Navegação em tela estreita

- **WHEN** o usuário acessa o sistema em um celular
- **THEN** o sistema SHALL recolher a navegação em um menu acionado por botão, mantendo acessíveis a navegação e as ações principais

#### Scenario: Mudança de tamanho de tela

- **WHEN** o usuário redimensiona a janela entre largura de celular e de computador
- **THEN** o sistema SHALL reorganizar o layout sem perder o conteúdo preenchido em formulários e a posição na lista exibida

### Requirement: Feedback de campo nos formulários

O sistema SHALL marcar os campos obrigatórios de forma visível sem alterar o nome acessível do campo, SHALL apresentar a mensagem de erro ou de conferência no próprio campo, sem depender apenas da cor, e SHALL permitir exibir a senha digitada.

#### Scenario: Obrigatoriedade visível

- **WHEN** o usuário abre um formulário com campos obrigatórios
- **THEN** o sistema SHALL indicar a obrigatoriedade ao lado do rótulo, anunciar a obrigatoriedade no campo e explicar o marcador uma única vez por formulário

#### Scenario: Erro apresentado no campo

- **WHEN** um campo é recusado por validação
- **THEN** o sistema SHALL exibir a mensagem junto ao campo, com ícone e texto, e associá-la ao campo para quem usa leitor de tela

#### Scenario: Conferência do formato do e-mail

- **WHEN** o usuário digita um e-mail e sai do campo
- **THEN** o sistema SHALL informar se o formato preenchido é válido ou inválido, antes do envio

#### Scenario: Exibição da senha

- **WHEN** o usuário preenche um campo de senha
- **THEN** o sistema SHALL oferecer o controle para exibir e ocultar a senha digitada, sem limpar o valor

### Requirement: Navegação por teclado

O sistema SHALL permitir que todos os elementos interativos sejam alcançados e acionados pelo teclado e SHALL rotular os campos de formulário de forma associada ao respectivo campo.

#### Scenario: Percurso pelo teclado em formulário

- **WHEN** o usuário percorre um formulário pelo teclado
- **THEN** o foco SHALL passar por todos os campos na ordem visual e cada campo SHALL estar associado ao seu rótulo e às suas mensagens

#### Scenario: Fechamento de diálogo pelo teclado

- **WHEN** um diálogo de confirmação está aberto e o usuário pressiona a tecla de escape
- **THEN** o sistema SHALL fechar o diálogo e devolver o foco ao elemento que o abriu