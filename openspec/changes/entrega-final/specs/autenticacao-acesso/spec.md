## ADDED Requirements

### Requirement: Entrega sem atalhos de desenvolvimento

A versão entregue SHALL autenticar usuários exclusivamente pelo fluxo de e-mail e senha. O sistema SHALL NOT oferecer seletor de papel, troca de sessão entre contas ou contas de demonstração em nenhuma configuração de ambiente da entrega.

#### Scenario: Navegação sem seletor de papel

- **WHEN** um usuário autenticado abre qualquer tela
- **THEN** o sistema SHALL exibir apenas a navegação do seu papel, sem controle para assumir outra conta

#### Scenario: Ação de troca de sessão inexistente

- **WHEN** uma requisição tenta acionar a troca de sessão usada na demonstração
- **THEN** o sistema SHALL NOT alterar a sessão, pois a ação não existe na entrega

#### Scenario: Busca por resíduos

- **WHEN** o código da entrega é inspecionado em busca do seletor de papel e de sua flag
- **THEN** a busca SHALL NOT encontrar componentes, ações, scripts ou variáveis de ambiente relacionados
