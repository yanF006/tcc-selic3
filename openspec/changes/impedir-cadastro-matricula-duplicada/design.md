## Context

Ver `proposal.md` para a motivação. O cadastro de `src/lib/services/cadastro.ts` usa prévias em memória entre duas etapas. `validarEtapaUm()` e `concluirCadastro()` verificam o e-mail, mas não consultam usuários por matrícula. A conclusão adiciona o usuário ao estado antes de aguardar a gravação no banco.

`prisma/schema.prisma` já declara e-mail único em `Usuario` e matrícula única em `MatriculaImportada`, mas a matrícula de `Usuario` é opcional e não única. `MatriculaImportada` é a lista de matrículas autorizadas, e não a lista de identidades já ocupadas.

`garantirHidratacao()` carrega usuários apenas uma vez por processo e pode entrar em modo de memória após uma falha. Isso não garante que o cadastro veja uma matrícula ocupada por outra instância. Os testes unitários desativam o banco; portanto, seu resultado não comprova a restrição MySQL.

O inventário principal do OpenSpec contém `persistencia-aiven`. A antiga spec de autenticação permanece no arquivo da mudança de frontend; esta mudança adiciona requisitos à capacidade principal existente, preservando o contrato de conexão e seu cenário.

## Goals / Non-Goals

**Goals:**

- Garantir a identidade única por matrícula nos cadastros novos, com e sem persistência configurada.
- Usar o banco como garantia final entre processos, mantendo uma mensagem de negócio apropriada na interface.
- Preservar dados existentes e não publicar estado local de cadastros rejeitados pelo banco.

**Non-Goals:**

- Substituir o simulador de autenticação e as prévias em memória por uma solução distribuída de sessões.
- Escolher qual conta duplicada deve ser preservada ou migrar dados acadêmicos entre contas.
- Modificar o banco `defaultdb` ou reestruturar todas as operações administrativas.

## Decisions

### 1. Restrição única na matrícula opcional de Usuario

Adicionar `@unique` a `Usuario.matricula` e uma nova migração que crie o índice correspondente em `usuarios`. O MySQL permite várias entradas `NULL` em um índice único, preservando contas de gestão sem matrícula. Matrículas do cadastro continuam validadas como onze dígitos e aparadas antes da comparação.

Alternativa rejeitada: depender apenas de uma busca no serviço, porque duas requisições podem verificar a mesma matrícula livre antes de gravar. A unicidade de `MatriculaImportada` não substitui a de `Usuario`.

### 2. Verificação atual em ambas as etapas

Introduzir na ponte de persistência uma consulta por matrícula que possa ser chamada nas duas etapas. Com banco configurado, consultar o banco atual além do estado local. Sem banco configurado, validar contra o estado em memória. Considerar usuários de qualquer situação, evitando que um cadastro pendente ou inativo permita outra identidade para a mesma matrícula.

A primeira etapa deve devolver erro no campo `matricula`. A conclusão pode usar o resultado existente com campo `dados`, mantendo compatibilidade com as Server Actions e o resumo de erro da segunda etapa. As mensagens não devem revelar nome, e-mail ou dados pessoais do titular.

Quando houver banco configurado, uma falha de consulta ou uma ponte indisponível não poderá transformar um cadastro novo em sucesso somente em memória. Essa mudança de comportamento fica limitada ao fluxo de cadastro; o restante do fallback existente não é redesenhado.

Alternativa rejeitada: confiar exclusivamente no estado hidratado, que pode ficar desatualizado em outra instância da Vercel.

### 3. Reserva local e publicação após persistência

Coordenar conclusões concorrentes no mesmo processo por matrícula, incluindo a repetição da mesma prévia, com liberação da reserva em `finally`. Revalidar e-mail e matrícula antes da gravação. A restrição MySQL será a garantia entre processos.

Persistir o usuário antes de adicioná-lo ao estado, criar credenciais ou solicitações e consumir a prévia. Traduzir conflitos de unicidade do Prisma em falhas de negócio, preservando as regras existentes de mensagens para e-mail. Uma falha de banco não poderá deixar um usuário local correspondente a uma gravação rejeitada.

Alternativa rejeitada: manter a inserção antecipada no estado e apenas capturar o erro do banco, pois deixaria uma conta fantasma. Em modo exclusivamente simulado, manter a reserva até concluir os efeitos em memória.

### 4. Corrigir a preparação dos testes

O teste positivo de `src/lib/services/cadastro.test.ts` usa `20231000788`, que já pertence a um usuário fixture. Outros testes da segunda etapa usam `20241006904`, também ocupada. Os cenários de sucesso e validação dos dados pessoais precisam preparar uma matrícula importada livre no seu próprio ambiente de teste; testes de rejeição devem continuar usando uma matrícula ocupada.

O mesmo vale para os cenários de segunda etapa de `e2e/cadastro.spec.ts`. Preparar matrículas livres pela funcionalidade administrativa existente e evitar ampliar as fixtures de produção apenas para acomodar os testes.

## Risks / Trade-offs

- Duplicidades já gravadas → inspecionar agrupamentos de matrícula antes de aplicar a migração; se houver conflitos, pausar para uma decisão explícita sem remoção automática.
- Outra instância cria a conta após a consulta → índice único e tradução do conflito no serviço; testar que o cadastro rejeitado não publica efeitos locais.
- Banco indisponível → cadastro com persistência configurada retorna falha recuperável, enquanto o modo sem banco mantém a simulação explícita.
- Mais consultas nas etapas do cadastro → aceitar esse custo para consultar o vínculo atual; manter projeção mínima de dados na busca.
- Testes unitários não exercitam MySQL → combinar testes isolados do fluxo com verificação de integração em banco exclusivo de testes e validação da migração no destino correto.

## Migration Plan

1. Confirmar que a URL usada para implantação aponta ao banco dedicado `selic`, sem imprimir credenciais.
2. Consultar matrículas não nulas agrupadas em `usuarios`, identificando grupos com mais de uma conta. Se houver algum grupo, reportar o conflito e interromper a aplicação até o usuário decidir sua resolução.
3. Gerar o cliente atualizado e aplicar uma migração nova para o índice único, preservando a migração inicial já aplicada.
4. Implantar o serviço com verificação nas duas etapas e tratamento dos conflitos. Reiniciar os processos para retirar o código antigo e estados locais desatualizados.
5. Verificar os cenários de rejeição e sucesso, incluindo concorrência, falha de gravação e coexistência de contas sem matrícula.

Rollback: a mudança de código pode ser revertida mantendo o índice, mas isso perde a apresentação amigável dos conflitos. A remoção do índice exige uma migração explícita e reabre o risco de duplicidades; não editar retroativamente a migração aplicada nem excluir contas para reverter.
