## Why

A busca de endereço atual usa um catálogo local de CEPs de demonstração e está disponível apenas no cadastro e no perfil do aluno. Integrar o ViaCEP nos fluxos de preenchimento e alteração reduz a digitação e os erros, mantendo a edição manual e a prioridade dos dados já cadastrados no banco ao abrir formulários de documentos.

## What Changes

- Solicitar CEP em todos os formulários que coletam endereço, incluindo cadastro, perfil e formulários de documentos, com cobertura de cada endereço quando houver mais de um no mesmo formulário.
- Ao abrir formulários de documentos, consultar primeiro o banco de dados e preencher os endereços com os dados cadastrados. A carga inicial, inclusive de um CEP válido, não deve disparar consulta ao ViaCEP.
- Substituir a consulta simulada por integração real com a API ViaCEP. No cadastro e nos demais fluxos de entrada de endereço, consultar ao informar um CEP válido de oito dígitos e preencher logradouro, bairro, cidade e estado disponíveis na resposta. Nos formulários de documentos, habilitar essa busca apenas quando o aluno optar por alterar o endereço e informar ou alterar o CEP, ou solicitar explicitamente a consulta; corrigir apenas número, complemento ou outro campo não deve disparar uma consulta desnecessária.
- Permitir a edição manual dos campos de endereço antes e depois da consulta, preservando os valores editados ao salvar. Número e complemento continuam sob controle do usuário, sem serem presumidos pela consulta.
- Informar carregamento, CEP inválido, CEP não encontrado e indisponibilidade do serviço. Permitir preenchimento manual quando não houver resultado, quando a resposta for parcial ou quando a consulta falhar, sem bloquear o salvamento apenas pela falha externa, desde que os dados atendam às validações do formulário.
- Evitar que respostas de consultas desatualizadas sobrescrevam um novo CEP ou alterações manuais realizadas enquanto a consulta estava em andamento. Consultas de endereços distintos não devem alterar os campos umas das outras.
- Alinhar os campos e descritores de endereço dos documentos para permitir a correção manual solicitada, inclusive quando inicialmente preenchidos com dados do aluno, mantendo as permissões de acesso e preenchimento do restante do formulário.
- Exigir cobertura automatizada da funcionalidade, com testes unitários do serviço, testes de integração dos formulários e testes E2E dos fluxos de uso. A cobertura deverá verificar carga inicial pelo banco sem consulta ao ViaCEP, busca durante a edição, preenchimento automático, edição manual e salvamento, validação de CEP, respostas parciais, CEP não encontrado, indisponibilidade e respostas atrasadas. Incluir verificações de integração para todos os formulários e grupos de endereço inventariados, inclusive formulários com mais de um endereço.

## Capabilities

### New Capabilities

- `consulta-endereco-cep`: carregamento inicial dos endereços de documentos a partir do banco, consulta ao ViaCEP nos fluxos de entrada ou alteração de endereço e edição manual em todos os formulários, com validação de CEP, estados de consulta e continuidade do preenchimento diante de respostas incompletas ou falhas.

### Modified Capabilities

Nenhuma capacidade já consolidada em `openspec/specs/` será alterada. A change ativa `frontend-website` contém requisitos de busca de CEP em `dados-pessoais-aluno` e de preenchimento automático em `documentos-estagio`; esta mudança deverá manter esses artefatos coerentes com a integração real e com a edição manual dos campos de endereço, evitando requisitos conflitantes quando ambas forem consolidadas.

## Impact

- Serviço de consulta em `src/lib/services/endereco.ts`, atualmente baseado em catálogo local.
- Formulários de cadastro e perfil do aluno, componentes reutilizáveis de entrada, máscaras e validações de CEP e endereço.
- Renderização e descritores dos formulários de documentos em `src/components/documentos/` e `src/lib/templates/`, incluindo grupos de endereço que ainda não solicitam CEP.
- Demais formulários que solicitem endereço, a serem inventariados no design e nas tarefas para garantir cobertura integral.
- Dependência externa da API ViaCEP e tratamento consistente de suas respostas e falhas.
- Testes unitários, de integração e E2E, com respostas externas controladas e dados persistidos preparados para verificar a prioridade do banco, a ausência de consulta externa na carga inicial, o preenchimento automático durante a edição, a preservação das alterações manuais ao salvar e reabrir e os cenários de falha, sem depender da disponibilidade real do ViaCEP.
- Documentação sobre a consulta de CEP deixar de ser simulada e compatibilização com os requisitos da change ativa `frontend-website`.
