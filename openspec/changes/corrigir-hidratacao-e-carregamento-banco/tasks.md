## 1. Diagnóstico e limites de tempo

- [x] 1.1 Registrar a causa completa das falhas de banco (`name`, `code`, `errno`, `sqlState`, `message` e cadeia de `cause`), com redação de URL/credenciais — verificação: teste unitário confirma os campos registrados e a ausência de segredos
- [x] 1.2 Reduzir `connectTimeout`, `acquireTimeout` e `initializationTimeout` para a faixa de 8–12 s, com `initializationTimeout < acquireTimeout` e sobrescrita por ambiente — verificação: teste unitário confere as opções geradas para os valores padrão e customizados
- [x] 1.3 Reproduzir a falha com uma URL de banco inacessível e confirmar que a causa real aparece antes do timeout de aquisição — verificação: execução local registra a causa original em menos de 15 s

## 2. Máquina de estados e recuperação da persistência

- [x] 2.1 Substituir os booleanos por estados explícitos (`simulado`, `pronto`, `falha`) e criar `BancoIndisponivelError` com mensagem segura — verificação: testes unitários cobrem as transições e a distinção entre simulação e erro
- [x] 2.2 Remover o latch permanente e implementar nova tentativa com cooldown curto após falha — verificação: teste unitário simula falha seguida de sucesso e confirma que a segunda leitura hidrata sem reiniciar o processo
- [x] 2.3 Implementar validade curta do snapshot (2 s por padrão, configurável) com coalescência de hidratações concorrentes — verificação: teste unitário com relógio controlado confirma reutilização dentro do TTL e uma única consulta para chamadas simultâneas
- [x] 2.4 Renovar o snapshot após mutação bem-sucedida de usuário ou matrícula — verificação: teste de serviço confirma leitura imediata do registro criado ou alterado
- [x] 2.5 Garantir que falha com `DATABASE_URL` configurada nunca devolva fixtures nem mantenha dados antigos como se fossem atuais — verificação: teste de integração com banco simulado indisponível recebe erro e não encontra contas padrão

## 3. Leituras atuais e completas

- [x] 3.1 Mover busca, filtros e paginação da lista de usuários para o servidor via `searchParams` — verificação: teste E2E filtra, busca e navega entre páginas mantendo a URL e o total corretos
- [x] 3.2 Auditar as demais listas persistidas para eliminar limites silenciosos ou filtragem sobre página pré-carregada — verificação: levantamento registra cada lista e teste confirma acesso a registros fora da primeira página quando aplicável
- [x] 3.3 Exibir total e paginação a partir do conjunto completo filtrado, sem depender de um recorte de 50 registros — verificação: teste E2E encontra um usuário que não estaria entre os primeiros 50
- [x] 3.4 Confirmar a janela de consistência entre instâncias e a atualização após mutação local — verificação: teste com dois carregamentos e relógio controlado mostra o limite definido e a renovação imediata após escrita

## 4. Carregamento, erro e ações pendentes

- [x] 4.1 Adicionar `loading.tsx` nas áreas que dependem de sessão/banco, com esqueleto consistente e sem confundir carregamento com lista vazia — verificação: teste de componente ou E2E observa o estado de carregamento antes dos dados
- [x] 4.2 Adicionar `error.tsx` com mensagem de indisponibilidade, distinção de erro inesperado e ação de nova tentativa usando `reset()` e `router.refresh()` — verificação: teste E2E força falha de banco e observa a mensagem e o botão de nova tentativa
- [x] 4.3 Ajustar Server Actions que gravam usuários/matrículas para capturar `BancoIndisponivelError`, devolver erro de negócio, manter o formulário aberto e impedir envio duplicado — verificação: testes de ação e E2E cobrem falha de gravação e duplo clique
- [x] 4.4 Garantir que a mensagem de erro não revele credenciais, host, usuário ou detalhes internos do banco — verificação: teste verifica o texto apresentado e a ausência de dados sensíveis

## 5. Testes automatizados

- [x] 5.1 Cobrir a máquina de estados, TTL, cooldown, coalescência e renovação pós-mutação em testes unitários — verificação: `npm run test:unit -- src/lib/db/persistencia.test.ts` passa
- [x] 5.2 Cobrir falha de banco com fixtures proibidas e recuperação sem reinício em teste de integração — verificação: teste passa sem depender do Aiven real
- [x] 5.3 Adicionar E2E com `DATABASE_URL` apontando para destino inacessível, verificando carregamento, erro visível, ausência de contas padrão e nova tentativa — verificação: script E2E dedicado passa com timeouts curtos
- [x] 5.4 Manter o E2E de simulação sem `DATABASE_URL` funcionando com fixtures e contas de demonstração — verificação: suíte E2E existente continua passando
- [x] 5.5 Cobrir a listagem completa de usuários, incluindo busca por registro fora da primeira página — verificação: `npm run test:e2e -- e2e/usuarios.spec.ts` passa

## 6. Verificação operacional e final

- [x] 6.1 Confirmar o acesso do egress da Vercel ao Aiven (allowlist/IP estático) e registrar a estratégia adotada — verificação: uma leitura real a partir de Production conecta sem `ER_GET_CONNECTION_TIMEOUT`; evidência de Production aceita pelo responsável em substituição à repetição no Preview
- [ ] 6.2 Validar no Preview que a lista mostra contas reais, que a falha exibe erro recuperável, que a nova tentativa funciona sem reinício e que uma conta criada em outra instância aparece dentro do limite definido — verificação: roteiro registrado com evidências das quatro situações
- [x] 6.3 Executar `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`, `npm run build` e `openspec validate corrigir-hidratacao-e-carregamento-banco --strict` — verificação: todos os comandos passam
