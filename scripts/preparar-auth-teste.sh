#!/bin/sh
# Aplica o schema mínimo de autenticação e gera o cliente exclusivo dos testes.
# Nunca usa DATABASE_URL: recusa qualquer destino que não seja o banco isolado.
set -eu

BASE="${SELIC_MYSQL_TESTE_BASE:-$HOME/.local/share/selic-mysql-teste}"
CREDENCIAIS="$BASE/credentials.env"

if [ -z "${TEST_DATABASE_URL:-}" ] && [ -f "$CREDENCIAIS" ]; then
  . "$CREDENCIAIS"
fi

if [ -z "${TEST_DATABASE_URL:-}" ]; then
  echo "TEST_DATABASE_URL ausente. Execute scripts/banco-teste.sh iniciar." >&2
  exit 1
fi

case "$TEST_DATABASE_URL" in
  mysql://*@127.0.0.1:*/selic_teste) ;;
  *)
    echo "Recusado: TEST_DATABASE_URL deve ser loopback e apontar para o schema selic_teste." >&2
    exit 1
    ;;
esac

DATABASE_URL="$TEST_DATABASE_URL" npx prisma db push \
  --schema prisma/auth-teste.prisma \
  --accept-data-loss
DATABASE_URL="$TEST_DATABASE_URL" npx prisma generate --schema prisma/auth-teste.prisma

echo "Schema e cliente de autenticação de teste prontos."
