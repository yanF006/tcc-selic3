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

## Ações que dependem do responsável pelo ambiente

- Gerar o backup final do banco de produção e guardá-lo fora do repositório.
- Executar a inspeção no destino real e decidir os conflitos apontados.
- Aplicar as migrações e a transformação somente após o corte (tarefa 14.5).
