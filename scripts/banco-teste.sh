#!/bin/sh
# Instância MySQL exclusiva dos testes de integração do SELic.
#
# Roda em porta e diretório próprios, sem tocar na instância do sistema nem no
# banco real da aplicação. O usuário criado só tem privilégios no schema
# selic_teste.
#
# Uso: scripts/banco-teste.sh {iniciar|parar|estado|limpar|url|ambiente}
set -eu

BASE="${SELIC_MYSQL_TESTE_BASE:-$HOME/.local/share/selic-mysql-teste}"
PORTA="${SELIC_MYSQL_TESTE_PORTA:-33306}"
BANCO="${SELIC_MYSQL_TESTE_BANCO:-selic_teste}"
BANCO_APP="${SELIC_MYSQL_TESTE_BANCO_APP:-selic_teste_app}"
USUARIO="${SELIC_MYSQL_TESTE_USUARIO:-selic_teste}"
SOCKET="$BASE/run/mysql.sock"
PIDFILE="$BASE/run/mysqld.pid"
LOGFILE="$BASE/mysqld.log"
CREDENCIAIS="$BASE/credentials.env"
MYSQLD_SISTEMA="${SELIC_MYSQLD_BINARIO:-/usr/sbin/mysqld}"
MYSQLD="$BASE/bin/mysqld"

OPCOES_MENSAGENS=""
[ -d /usr/share/mysql ] && OPCOES_MENSAGENS="--lc-messages-dir=/usr/share/mysql"
OPCOES_PLUGINS=""
[ -d /usr/lib/mysql/plugin ] && OPCOES_PLUGINS="--plugin-dir=/usr/lib/mysql/plugin"

exigir_cliente() {
  for ferramenta in mysql openssl; do
    command -v "$ferramenta" >/dev/null 2>&1 || {
      echo "$ferramenta não encontrado no PATH." >&2
      exit 1
    }
  done
  command -v mysqladmin >/dev/null 2>&1 || {
    echo "mysqladmin não encontrado no PATH." >&2
    exit 1
  }
}

ativo() {
  [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null
}

preparar_binario() {
  if [ ! -x "$MYSQLD" ]; then
    mkdir -p "$BASE/bin"
    # O perfil AppArmor de /usr/sbin/mysqld limita o datadir a /var/lib/mysql.
    # Executar uma cópia no diretório de testes mantém a instância isolada sem
    # exigir alteração global do AppArmor.
    cp "$MYSQLD_SISTEMA" "$MYSQLD"
    chmod 700 "$MYSQLD"
  fi
}

inicializar() {
  preparar_binario
  preparar_tls
  if [ ! -d "$BASE/data/mysql" ]; then
    rm -rf "$BASE/data"
    mkdir -p "$BASE/data" "$BASE/run"
    "$MYSQLD" --no-defaults --initialize-insecure \
      --datadir="$BASE/data" \
      $OPCOES_MENSAGENS \
      --log-error="$BASE/init.log"
  fi
}

preparar_tls() {
  if [ ! -f "$BASE/tls/server-cert.pem" ]; then
    mkdir -p "$BASE/tls"
    umask 077
    openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
      -keyout "$BASE/tls/ca-key.pem" -out "$BASE/tls/ca.pem" \
      -subj "/CN=SELic MySQL Test CA" \
      -addext "basicConstraints=critical,CA:TRUE" 2>/dev/null
    openssl req -new -newkey rsa:2048 -nodes \
      -keyout "$BASE/tls/server-key.pem" -out "$BASE/tls/server.csr" \
      -subj "/CN=localhost" \
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null
    openssl x509 -req -days 3650 \
      -in "$BASE/tls/server.csr" -CA "$BASE/tls/ca.pem" \
      -CAkey "$BASE/tls/ca-key.pem" -CAcreateserial \
      -copy_extensions copy -out "$BASE/tls/server-cert.pem" 2>/dev/null
  fi
}

senha_atual() {
  sed -n "s#^TEST_DATABASE_URL=mysql://[^:]*:\([^@]*\)@.*#\1#p" "$CREDENCIAIS" 2>/dev/null
}

provisionar() {
  senha=$(senha_atual)
  if [ -z "$senha" ]; then
    senha=$(openssl rand -hex 16)
  fi

  umask 077
  printf 'TEST_DATABASE_URL=mysql://%s:%s@127.0.0.1:%s/%s\nTEST_APP_DATABASE_URL=mysql://%s:%s@127.0.0.1:%s/%s\n' \
    "$USUARIO" "$senha" "$PORTA" "$BANCO" \
    "$USUARIO" "$senha" "$PORTA" "$BANCO_APP" >"$CREDENCIAIS"

  mysql --socket="$SOCKET" -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`$BANCO\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS \`$BANCO_APP\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$USUARIO'@'127.0.0.1' IDENTIFIED BY '$senha';
ALTER USER '$USUARIO'@'127.0.0.1' IDENTIFIED BY '$senha';
GRANT ALL PRIVILEGES ON \`$BANCO\`.* TO '$USUARIO'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`$BANCO_APP\`.* TO '$USUARIO'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
}

iniciar() {
  exigir_cliente
  inicializar

  if ativo; then
    echo "MySQL de testes já está ativo na porta $PORTA."
  else
    mkdir -p "$BASE/run"
    "$MYSQLD" --no-defaults \
      --datadir="$BASE/data" \
      --socket="$SOCKET" \
      --port="$PORTA" \
      --bind-address=127.0.0.1 \
      --ssl-ca="$BASE/tls/ca.pem" \
      --ssl-cert="$BASE/tls/server-cert.pem" \
      --ssl-key="$BASE/tls/server-key.pem" \
      --pid-file="$PIDFILE" \
      --log-error="$LOGFILE" \
      $OPCOES_MENSAGENS \
      $OPCOES_PLUGINS \
      --mysqlx=OFF \
      --skip-name-resolve \
      --daemonize

    tentativa=0
    while [ ! -S "$SOCKET" ]; do
      tentativa=$((tentativa + 1))
      if [ "$tentativa" -ge 50 ]; then
        echo "MySQL de testes não abriu o socket; veja $LOGFILE." >&2
        exit 1
      fi
      sleep 0.2
    done
    echo "MySQL de testes iniciado na porta $PORTA."
  fi

  provisionar
  echo "Schemas: $BANCO e $BANCO_APP. Credenciais: $CREDENCIAIS"
}

parar() {
  if ativo; then
    mysqladmin --socket="$SOCKET" -uroot shutdown
    echo "MySQL de testes encerrado."
  else
    echo "MySQL de testes já está parado."
  fi
}

estado() {
  if ativo; then
    echo "ativo pid=$(cat "$PIDFILE") porta=$PORTA socket=$SOCKET"
    mysqladmin --socket="$SOCKET" -uroot ping
  else
    echo "parado"
    exit 1
  fi
}

limpar() {
  if ! ativo; then
    echo "Inicie o banco de testes antes de limpar o schema." >&2
    exit 1
  fi
  mysql --socket="$SOCKET" -uroot -e "DROP DATABASE IF EXISTS \`$BANCO\`; CREATE DATABASE \`$BANCO\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; DROP DATABASE IF EXISTS \`$BANCO_APP\`; CREATE DATABASE \`$BANCO_APP\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  provisionar
  echo "Schemas $BANCO e $BANCO_APP recriados vazios."
}

case "${1:-}" in
  iniciar) iniciar ;;
  parar) parar ;;
  estado) estado ;;
  limpar) limpar ;;
  url)
    [ -f "$CREDENCIAIS" ] || { echo "Banco de testes ainda não inicializado." >&2; exit 1; }
    cat "$CREDENCIAIS"
    ;;
  ambiente)
    [ -f "$CREDENCIAIS" ] || { echo "Banco de testes ainda não inicializado." >&2; exit 1; }
    echo "export $(cat "$CREDENCIAIS")"
    ;;
  *)
    echo "Uso: $0 {iniciar|parar|estado|limpar|url|ambiente}" >&2
    exit 2
    ;;
esac
