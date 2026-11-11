# Instância MySQL exclusiva dos testes de integração do SELic (Windows).
#
# Contraparte Windows de scripts/banco-teste.sh: roda em porta e diretório
# próprios, sem serviço do Windows e sem tocar na instância do sistema nem no
# banco real da aplicação. O usuário criado só tem privilégios nos schemas
# selic_teste e selic_teste_app, e o acesso é somente por TCP em loopback.
#
# Requer o zip portátil do MySQL 8 extraído dentro de
# $env:SELIC_MYSQL_TESTE_BASE (padrão ~/.local/share/selic-mysql-teste), por
# exemplo mysql-8.0.43-winx64, e o openssl do Git for Windows (ou no PATH).
#
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/banco-teste.ps1 {iniciar|parar|estado|limpar|url|ambiente}

[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet("iniciar", "parar", "estado", "limpar", "url", "ambiente")]
  [string]$Acao = "iniciar"
)

$ErrorActionPreference = "Stop"

$Base = if ($env:SELIC_MYSQL_TESTE_BASE) { $env:SELIC_MYSQL_TESTE_BASE } else { Join-Path $HOME ".local/share/selic-mysql-teste" }
$Porta = if ($env:SELIC_MYSQL_TESTE_PORTA) { [int]$env:SELIC_MYSQL_TESTE_PORTA } else { 33306 }
$Banco = if ($env:SELIC_MYSQL_TESTE_BANCO) { $env:SELIC_MYSQL_TESTE_BANCO } else { "selic_teste" }
$BancoApp = if ($env:SELIC_MYSQL_TESTE_BANCO_APP) { $env:SELIC_MYSQL_TESTE_BANCO_APP } else { "selic_teste_app" }
$Usuario = if ($env:SELIC_MYSQL_TESTE_USUARIO) { $env:SELIC_MYSQL_TESTE_USUARIO } else { "selic_teste" }

$DiretorioDados = Join-Path $Base "data"
$DiretorioExecucao = Join-Path $Base "run"
$DiretorioTls = Join-Path $Base "tls"
$ArquivoPid = Join-Path $DiretorioExecucao "mysqld.pid"
$ArquivoInit = Join-Path $DiretorioExecucao "init-root.sql"
$ArquivoLog = Join-Path $Base "mysqld.log"
$ArquivoLogInicializacao = Join-Path $Base "init.log"
$Credenciais = Join-Path $Base "credentials.env"

function Get-BinariosMysql {
  if ($env:SELIC_MYSQLD_EXE) {
    if (-not (Test-Path $env:SELIC_MYSQLD_EXE)) {
      throw "SELIC_MYSQLD_EXE aponta para um executável inexistente: $env:SELIC_MYSQLD_EXE"
    }
    return @{ Mysqld = $env:SELIC_MYSQLD_EXE; Diretorio = Split-Path $env:SELIC_MYSQLD_EXE }
  }

  $candidatos = Get-ChildItem -Path $Base -Directory -Filter "mysql-*" -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending
  foreach ($candidato in $candidatos) {
    $mysqld = Join-Path $candidato.FullName "bin\mysqld.exe"
    if (Test-Path $mysqld) {
      return @{ Mysqld = $mysqld; Diretorio = Join-Path $candidato.FullName "bin" }
    }
  }

  throw @"
mysqld.exe não encontrado dentro de $Base.
Extraia o zip portátil do MySQL 8 (ex.: mysql-8.0.43-winx64.zip, coluna
"Windows (x86, 64-bit), ZIP Archive" de dev.mysql.com) dentro de $Base
ou defina SELIC_MYSQLD_EXE com o caminho do mysqld.exe.
"@
}

function Get-Openssl {
  $git = (Get-Command git -ErrorAction SilentlyContinue).Source
  if ($git) {
    $raiz = Split-Path (Split-Path $git)
    foreach ($relativo in @("usr\bin\openssl.exe", "bin\openssl.exe")) {
      $candidato = Join-Path $raiz $relativo
      if (Test-Path $candidato) { return $candidato }
    }
  }
  $openssl = (Get-Command openssl -ErrorAction SilentlyContinue).Source
  if ($openssl) { return $openssl }
  throw "openssl não encontrado; instale o Git for Windows ou coloque o openssl no PATH."
}

function Test-Ativo {
  if (-not (Test-Path $ArquivoPid)) { return $false }
  $pidTexto = Get-Content $ArquivoPid -ErrorAction SilentlyContinue | Select-Object -First 1
  $pidValor = 0
  if (-not $pidTexto -or -not [int]::TryParse("$pidTexto".Trim(), [ref]$pidValor)) { return $false }
  $processo = Get-Process -Id $pidValor -ErrorAction SilentlyContinue
  return ($null -ne $processo -and $processo.ProcessName -eq "mysqld")
}

function Test-PortaAberta {
  $cliente = New-Object System.Net.Sockets.TcpClient
  try {
    $conexao = $cliente.BeginConnect("127.0.0.1", $Porta, $null, $null)
    if (-not $conexao.AsyncWaitHandle.WaitOne(300)) { return $false }
    $cliente.EndConnect($conexao) | Out-Null
    return $true
  } catch {
    return $false
  } finally {
    $cliente.Close()
  }
}

function Initialize-Dados {
  if (Test-Path (Join-Path $DiretorioDados "mysql")) { return }
  $binarios = Get-BinariosMysql
  $compartilhado = Join-Path (Split-Path $binarios.Diretorio) "share"
  New-Item -ItemType Directory -Force -Path $DiretorioDados, $DiretorioExecucao | Out-Null
  & $binarios.Mysqld --no-defaults --initialize-insecure `
    --datadir="$DiretorioDados" `
    --lc-messages-dir="$compartilhado" `
    --log-error="$ArquivoLogInicializacao"
  if ($LASTEXITCODE -ne 0) {
    throw "A inicialização do MySQL de testes falhou; veja $ArquivoLogInicializacao."
  }
}

function New-Tls {
  if ((Test-Path (Join-Path $DiretorioTls "ca.pem")) -and
      (Test-Path (Join-Path $DiretorioTls "server-cert.pem"))) { return }

  New-Item -ItemType Directory -Force -Path $DiretorioTls | Out-Null
  $openssl = Get-Openssl
  & $openssl req -x509 -newkey rsa:2048 -nodes -days 3650 `
    -keyout "$DiretorioTls\ca-key.pem" -out "$DiretorioTls\ca.pem" `
    -subj "/CN=SELic MySQL Test CA" -addext "basicConstraints=critical,CA:TRUE"
  if ($LASTEXITCODE -ne 0) { throw "openssl falhou ao gerar a CA de testes." }

  & $openssl req -new -newkey rsa:2048 -nodes `
    -keyout "$DiretorioTls\server-key.pem" -out "$DiretorioTls\server.csr" `
    -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
  if ($LASTEXITCODE -ne 0) { throw "openssl falhou ao gerar a CSR do servidor." }

  & $openssl x509 -req -days 3650 `
    -in "$DiretorioTls\server.csr" `
    -CA "$DiretorioTls\ca.pem" -CAkey "$DiretorioTls\ca-key.pem" -CAcreateserial `
    -copy_extensions copy -out "$DiretorioTls\server-cert.pem"
  if ($LASTEXITCODE -ne 0) { throw "openssl falhou ao gerar o certificado do servidor." }
}

function Get-SenhaAtual {
  if (-not (Test-Path $Credenciais)) { return $null }
  $linha = Get-Content $Credenciais | Where-Object { $_ -like "TEST_DATABASE_URL=mysql://*" } | Select-Object -First 1
  if (-not $linha) { return $null }
  if ($linha -match "^TEST_DATABASE_URL=mysql://[^:]+:([^@]+)@") { return $Matches[1] }
  return $null
}

function Invoke-Sql {
  param([Parameter(Mandatory)][string]$Sql, [Parameter(Mandatory)][hashtable]$Binarios)

  $mysql = Join-Path $Binarios.Diretorio "mysql.exe"
  $Sql | & $mysql "-h127.0.0.1" "-P$Porta" "-uroot"
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao executar SQL no MySQL de testes (saída $LASTEXITCODE)."
  }
}

function Invoke-Provisionar {
  param([Parameter(Mandatory)][hashtable]$Binarios)

  $senha = Get-SenhaAtual
  if (-not $senha) {
    $senha = -join ((1..32) | ForEach-Object { "{0:x}" -f (Get-Random -Minimum 0 -Maximum 16) })
  }

  $sql = @"
CREATE DATABASE IF NOT EXISTS $Banco CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS $BancoApp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$Usuario'@'127.0.0.1' IDENTIFIED BY '$senha';
ALTER USER '$Usuario'@'127.0.0.1' IDENTIFIED BY '$senha';
GRANT ALL PRIVILEGES ON $Banco.* TO '$Usuario'@'127.0.0.1';
GRANT ALL PRIVILEGES ON $BancoApp.* TO '$Usuario'@'127.0.0.1';
FLUSH PRIVILEGES;
"@
  Invoke-Sql -Sql $sql -Binarios $Binarios

  Set-Content -Path $Credenciais -Encoding ascii -Value @(
    "TEST_DATABASE_URL=mysql://$Usuario`:$senha@127.0.0.1:$Porta/$Banco",
    "TEST_APP_DATABASE_URL=mysql://$Usuario`:$senha@127.0.0.1:$Porta/$BancoApp"
  )
}

function New-InitRoot {
  # --initialize-insecure cria somente root@localhost; no Linux a
  # administração usa o socket local, mas no Windows o TCP de 127.0.0.1 não
  # casa com localhost sob --skip-name-resolve. O init-file idempotente
  # garante root@127.0.0.1 para a administração por TCP em loopback.
  New-Item -ItemType Directory -Force -Path $DiretorioExecucao | Out-Null
  Set-Content -Path $ArquivoInit -Encoding ascii -Value @(
    "CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED BY '';",
    "GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION;",
    "FLUSH PRIVILEGES;"
  )
}

function Invoke-Iniciar {
  $binarios = Get-BinariosMysql
  Initialize-Dados
  New-Tls
  New-InitRoot

  if (Test-Ativo) {
    Write-Output "MySQL de testes já está ativo na porta $Porta."
  } else {
    Remove-Item $ArquivoPid -ErrorAction SilentlyContinue
    $compartilhado = Join-Path (Split-Path $binarios.Diretorio) "share"
    $argumentos = @(
      "--no-defaults",
      "--datadir=$DiretorioDados",
      "--port=$Porta",
      "--bind-address=127.0.0.1",
      "--ssl-ca=$DiretorioTls\ca.pem",
      "--ssl-cert=$DiretorioTls\server-cert.pem",
      "--ssl-key=$DiretorioTls\server-key.pem",
      "--pid-file=$ArquivoPid",
      "--init-file=$ArquivoInit",
      "--log-error=$ArquivoLog",
      "--lc-messages-dir=$compartilhado",
      "--mysqlx=OFF",
      "--skip-name-resolve"
    )
    $processo = Start-Process -FilePath $binarios.Mysqld -ArgumentList $argumentos -WindowStyle Hidden -PassThru

    $tentativa = 0
    while (-not (Test-PortaAberta)) {
      $tentativa++
      if ($processo.HasExited) {
        throw "mysqld encerrou durante a inicialização; veja $ArquivoLog."
      }
      if ($tentativa -ge 150) {
        throw "MySQL de testes não abriu a porta $Porta; veja $ArquivoLog."
      }
      Start-Sleep -Milliseconds 200
    }
    Write-Output "MySQL de testes iniciado na porta $Porta."
  }

  Invoke-Provisionar -Binarios $binarios
  Write-Output "Schemas: $Banco e $BancoApp. Credenciais: $Credenciais"
}

function Invoke-Parar {
  if (-not (Test-Ativo)) {
    Write-Output "MySQL de testes já está parado."
    return
  }
  $binarios = Get-BinariosMysql
  $mysqladmin = Join-Path $binarios.Diretorio "mysqladmin.exe"
  & $mysqladmin "-h127.0.0.1" "-P$Porta" "-uroot" shutdown
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao encerrar o MySQL de testes (saída $LASTEXITCODE)."
  }
  Write-Output "MySQL de testes encerrado."
}

function Invoke-Estado {
  if (-not (Test-Ativo)) {
    Write-Output "parado"
    exit 1
  }
  $binarios = Get-BinariosMysql
  $mysqladmin = Join-Path $binarios.Diretorio "mysqladmin.exe"
  Write-Output "ativo pid=$((Get-Content $ArquivoPid | Select-Object -First 1).Trim()) porta=$Porta"
  & $mysqladmin "-h127.0.0.1" "-P$Porta" "-uroot" ping
}

function Invoke-Limpar {
  if (-not (Test-Ativo)) {
    throw "Inicie o banco de testes antes de limpar o schema."
  }
  $binarios = Get-BinariosMysql
  $sql = @"
DROP DATABASE IF EXISTS $Banco;
CREATE DATABASE $Banco CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DROP DATABASE IF EXISTS $BancoApp;
CREATE DATABASE $BancoApp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
"@
  Invoke-Sql -Sql $sql -Binarios $binarios
  Invoke-Provisionar -Binarios $binarios
  Write-Output "Schemas $Banco e $BancoApp recriados vazios."
}

function Invoke-Url {
  if (-not (Test-Path $Credenciais)) {
    Write-Error "Banco de testes ainda não inicializado."
    exit 1
  }
  Get-Content $Credenciais
}

function Invoke-Ambiente {
  if (-not (Test-Path $Credenciais)) {
    Write-Error "Banco de testes ainda não inicializado."
    exit 1
  }
  Write-Output "export $((Get-Content $Credenciais) -join ' ')"
}

switch ($Acao) {
  "iniciar" { Invoke-Iniciar }
  "parar" { Invoke-Parar }
  "estado" { Invoke-Estado }
  "limpar" { Invoke-Limpar }
  "url" { Invoke-Url }
  "ambiente" { Invoke-Ambiente }
}
