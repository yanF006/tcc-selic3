# Operação de dados: inspeção, backup, transformação e carga

Roteiro das tarefas 13.1 a 13.5 do change `integrar-banco-backend-completo`.
Todos os comandos rodam localmente, com `DATABASE_URL` no ambiente. Senhas nunca
aparecem em linha de comando, arquivo versionado ou metadado. Backups contêm dados
pessoais: ficam fora do Git (`backups/` já está no `.gitignore`).

## Ordem de execução

1. **Backup com versão e checksum** (13.2)
   `node scripts/backup-banco.mjs`
   Gera `.sql` e `.meta.json` (contagens por tabela, SHA-256, versão do MySQL e
   última migração). Arquivo parcial é removido se o metadado falhar.

2. **Inspeção somente leitura** (13.1)
   `node scripts/inspecionar-destino.mjs`
   Só executa `SELECT`. Relata contagens e conflitos com identificadores
   anonimizados. Saída `2` = há conflito que exige decisão explícita. Nenhuma conta
   é escolhida, alterada ou excluída pelo script.

3. **Restauração em banco de ensaio** (13.2)
   `DATABASE_URL=<ensaio> SELIC_RESTAURACAO_CONFIRMA=<mesmo nome> node scripts/restaurar-backup.mjs --arquivo <sql> [--limpar]`
   Travas: nome de ensaio (`_ensaio`, `_restauracao` ou `_teste`; nunca `selic`),
   confirmação idêntica ao nome, checksum conferido, destino populado só com
   `--limpar`. Depois compara as contagens com o metadado.

4. **Transformação versionada dos dados pessoais** (13.3)
   `node scripts/transformar-dados-pessoais.mjs` (ensaio) e
   `node scripts/transformar-dados-pessoais.mjs --aplicar` (gravação).
   - Para na primeira execução se a inspeção tiver conflitos.
   - Cada aluno é validado (CPF, data, endereço, vínculos de curso, turma e
     período). Registro inválido interrompe tudo, sem gravar nada.
   - Gravação em uma única transação; IDs preservados (`dpa-<usuarioId>`).
   - Confere que a identidade das contas (id, e-mail, cargo, situação, matrícula)
     não mudou. Reexecutar não duplica nada.

5. **Carga inicial operacional** (13.4)
   `SELIC_ADMIN_EMAIL=... SELIC_ADMIN_NOME=... npm run db:carga-inicial`
   Cria só o primeiro administrador, ativo e sem senha. A senha é estabelecida
   pelo fluxo padrão de recuperação de senha. Se já existe administrador, nada é
   feito. E-mail ocupado por outra conta interrompe a carga.

6. **Seed de demonstração** (13.4), somente em ensaio
   `SELIC_SEED_DEMONSTRACAO=1 npm run db:seed`
   Recusa bancos que não sejam de ensaio (`_ensaio`, `_teste` ou `_demo`) e
   insere apenas registros ausentes. Não roda na aplicação nem em produção.

7. **Ensaio de implantação interrompida** (13.5)
   `DATABASE_URL=<ensaio> SELIC_RESTAURACAO_CONFIRMA=<nome> node scripts/ensaio-implantacao.mjs`
   Executa backup, inspeção, transformação interrompida após o `COMMIT`, retomada
   idempotente, inspeção final e restauração do backup. Imprime o resultado de cada
   etapa. Sai com código `1` se algum passo não se comportar como previsto.

## Limitações conhecidas

- **Restaurar descarta escritas posteriores ao backup.** Antes de restaurar em um
  destino servido, é preciso reconciliar manualmente as alterações feitas depois
  do backup. Não há rollback automático para o simulador anterior.
- **Credenciais legadas não são recuperadas.** Senhas existiram só em memória, então
  nenhuma conta antiga tem senha utilizável. Todas estabelecem senha pelo fluxo padrão.
- **Solicitações pendentes não são reconstruídas automaticamente.** A inspeção lista
  contas pendentes sem solicitação registrada. Reconstruir exige dados verificáveis e
  decisão registrada de migração, caso a caso.
- **Gancho de ensaio.** `SELIC_ENSAIO_FALHA_APOS_GRAVACAO=1` só interrompe bancos de
  ensaio. Não usar em destino real.
- **Ensaio feito em cópia isolada.** As execuções registradas ocorreram só no MySQL
  de testes. Nenhuma ação foi feita em Aiven ou Vercel: esses passos cabem a quem
  opera a produção.

## Corte em produção (14.5)

Executado pelo responsável pelo Aiven e pela Vercel, em janela anunciada. Os
comandos locais usam `DATABASE_URL` no ambiente (nunca na linha de comando).
Production publica a partir de `master`; o código novo só entra no passo 8.

1. **Suspender escritas antigas.** No Aiven, troque a senha do usuário do banco
   `selic`. Todo deployment antigo (inclusive aliases e Previews antigos que
   apontem para `selic`) perde o acesso e não grava mais nada.
2. **Backup final** com a senha nova: `node scripts/backup-banco.mjs`. Guarde o
   `.sql` e o `.meta.json` fora do repositório e anote as contagens.
3. **Ensaio na cópia.** Crie `selic_ensaio` no mesmo serviço, restaure o backup
   (`restaurar-backup.mjs --limpar`) e, com `DATABASE_URL` apontando para ele, rode
   os passos 4 a 6. Qualquer falha aqui não afeta produção: corrija antes de seguir.
4. **Migrações em `selic`:** `npx prisma migrate status`, `npm run db:deploy` e de
   novo `npx prisma migrate status` (nenhuma pendente). A migração de cargo falha se
   houver conta com zero ou vários cargos; isso exige decisão, não exclusão.
5. **Inspeção:** `node scripts/inspecionar-destino.mjs`. Saída `2` = parar e decidir.
6. **Transformação:** `node scripts/transformar-dados-pessoais.mjs`, conferir o
   relatório e então `--aplicar`. Se ainda não houver administrador,
   `npm run db:carga-inicial`.
7. **Variáveis de Production na Vercel:** `DATABASE_URL` (senha nova),
   `SELIC_PERSISTENCIA=persistente`, `BETTER_AUTH_URL=https://tcc-selic3.vercel.app`,
   `BETTER_AUTH_SECRET` novo e diferente do Preview (`openssl rand -base64 32`),
   `SMTP_*` e `SELIC_DB_CA_CERT` quando necessário.
8. **Publicar:** fazer o merge do branch da integração em `master` e aguardar o
   deployment de Production.
9. **Conferir antes de reabrir:** `migrate status` sem pendências; contagens de
   usuários, estágios, documentos e arquivos iguais às do backup (só
   `dados_pessoais_aluno` cresce, pela transformação); smoke tests de login do
   administrador pela recuperação de senha (link abrindo em `tcc-selic3.vercel.app`),
   lista de usuários, fila de cadastros pendentes, estágio de um aluno existente,
   abertura e impressão de documento, download do Kit e de um arquivo enviado.
10. **Reabrir** e avisar os usuários: as senhas antigas não existem; cada pessoa
    entra pelo "Esqueci minha senha".

**Reversão.** Até o passo 3, basta devolver a senha nova à `DATABASE_URL` do
deployment antigo e reabrir. Depois do passo 4, o código antigo não serve o
esquema novo: reverter exige restaurar o backup em `selic` manualmente com o
cliente `mysql` (o script recusa o nome `selic` de propósito), descartando as
escritas posteriores, e promover o deployment antigo pela Vercel.

## Ações que dependem do responsável pelo ambiente

- Gerar o backup final do banco de produção e guardá-lo fora do repositório.
- Executar a inspeção no destino real e decidir os conflitos apontados.
- Aplicar as migrações e a transformação somente após o corte (tarefa 14.5).
