## 1. Modelo e migração

- [ ] 1.1 Adicionar unicidade à matrícula opcional de `Usuario` e criar uma migração nova de índice único em `usuarios.matricula`; verificar que o SQL preserva as tabelas e a migração inicial e que `npm run db:generate` gera o cliente atualizado.
- [ ] 1.2 Confirmar o destino dedicado `selic` e inspecionar agrupamentos de matrículas duplicadas antes de aplicar a migração; registrar somente as evidências necessárias, sem credenciais, e interromper a aplicação para decisão do usuário caso existam conflitos.

## 2. Consulta e consistência do cadastro

- [ ] 2.1 Implementar consulta atual de matrícula vinculada na ponte de persistência, distinguindo banco configurado de simulação sem banco; verificar testes para matrícula presente no banco mas ausente da memória e para falha de consulta sem sucesso fictício.
- [ ] 2.2 Validar a matrícula vinculada em `validarEtapaUm()` e revalidá-la em `concluirCadastro()`, preservando as validações de e-mail e dados pessoais; verificar bloqueio com e-mails diferentes e contas ativas, pendentes e inativas, com mensagem no campo apropriado.
- [ ] 2.3 Coordenar conclusões concorrentes no processo e persistir antes de publicar o usuário, credencial ou solicitação; traduzir conflitos de unicidade e falhas de gravação em resultados de cadastro, verificando ausência de efeitos residuais e liberação das reservas após falha.

## 3. Testes de regressão

- [ ] 3.1 Adaptar a preparação dos testes unitários de sucesso e segunda etapa para matrículas livres sem alterar fixtures de produção; verificar que cadastro importado livre permanece ativo e matrícula livre não registrada continua gerando uma única solicitação pendente.
- [ ] 3.2 Adicionar regressões para matrícula ocupada inicialmente, ocupada entre etapas, prévias concorrentes e conflito retornado pelo banco; verificar que no máximo uma conta é criada e que o cadastro rejeitado não cria credenciais nem solicitações.
- [ ] 3.3 Adaptar os cenários E2E de segunda etapa para preparar matrículas livres via administração e adicionar o cenário de outro e-mail com matrícula ocupada; verificar com `npm run test:e2e -- e2e/cadastro.spec.ts` em ambiente de testes isolado.
- [ ] 3.4 Verificar em MySQL exclusivo de testes que o índice rejeita duas contas com a mesma matrícula, inclusive gravações concorrentes, e permite múltiplas contas com matrícula nula; registrar resultado e garantir limpeza dos registros de teste.

## 4. Aplicação e validação final

- [ ] 4.1 Aplicar a nova migração em `selic` somente após a inspeção sem conflitos; verificar `npm run db:deploy` e `prisma migrate status`, conferindo a presença do índice e registrando evidências sem expor dados de acesso.
- [ ] 4.2 Executar `npm run typecheck`, lint dos arquivos alterados, `npm run test:unit` e `openspec validate impedir-cadastro-matricula-duplicada --strict`; registrar os resultados e deixar explícita a necessidade de implantação do código e da migração no ambiente servido pela Vercel.
