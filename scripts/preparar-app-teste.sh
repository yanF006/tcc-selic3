#!/bin/sh
# Aplica o schema completo da aplicação no banco isolado de testes de modelo.
# Usa um schema separado do schema mínimo de autenticação para que o `db push`
# de um não remova as tabelas do outro. Nunca usa DATABASE_URL.
set -eu

BASE="${SELIC_MYSQL_TESTE_BASE:-$HOME/.local/share/selic-mysql-teste}"
CREDENCIAIS="$BASE/credentials.env"
BANCO_APP="${SELIC_MYSQL_TESTE_BANCO_APP:-selic_teste_app}"

if [ -z "${TEST_APP_DATABASE_URL:-}" ] && [ -f "$CREDENCIAIS" ]; then
  . "$CREDENCIAIS"
fi

if [ -z "${TEST_APP_DATABASE_URL:-}" ]; then
  echo "TEST_APP_DATABASE_URL ausente. Execute scripts/banco-teste.sh iniciar." >&2
  exit 1
fi

case "$TEST_APP_DATABASE_URL" in
  mysql://*@127.0.0.1:*/"$BANCO_APP") ;;
  *)
    echo "Recusado: TEST_APP_DATABASE_URL deve ser loopback e apontar para o schema $BANCO_APP." >&2
    exit 1
    ;;
esac

if [ -n "${DATABASE_URL:-}" ] && [ "$TEST_APP_DATABASE_URL" = "$DATABASE_URL" ]; then
  echo "Recusado: TEST_APP_DATABASE_URL não pode ser igual à DATABASE_URL." >&2
  exit 1
fi

if [ -n "${TEST_DATABASE_URL:-}" ] && [ "$TEST_APP_DATABASE_URL" = "$TEST_DATABASE_URL" ]; then
  echo "Recusado: TEST_APP_DATABASE_URL deve ser diferente de TEST_DATABASE_URL." >&2
  exit 1
fi

DATABASE_URL="$TEST_APP_DATABASE_URL" npx prisma db push \
  --schema prisma/schema.prisma \
  --accept-data-loss
DATABASE_URL="$TEST_APP_DATABASE_URL" npx prisma generate

echo "Schema completo da aplicação pronto em $BANCO_APP."
