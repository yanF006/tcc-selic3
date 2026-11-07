#!/usr/bin/env node
// Coletor SMTP exclusivo dos testes. Não autentica, não usa TLS e só escuta em
// loopback: recebe mensagens e grava o conteúdo bruto em arquivos .eml.
//
// Variáveis: SMTP_TEST_HOST (padrão 127.0.0.1), SMTP_TEST_PORT (padrão 2525; 0
// escolhe porta livre), SMTP_TEST_DIR (diretório de saída).
import { createServer } from "node:net";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const host = process.env.SMTP_TEST_HOST ?? "127.0.0.1";
const porta = Number(process.env.SMTP_TEST_PORT ?? 2525);
const diretorio =
  process.env.SMTP_TEST_DIR ?? join(homedir(), ".local/share/selic-smtp-teste/mensagens");

mkdirSync(diretorio, { recursive: true });

let sequencia = 0;

function endereco(linha) {
  const achado = linha.match(/<([^>]*)>/);
  return achado ? achado[1] : linha.split(":").slice(1).join(":").trim();
}

const servidor = createServer((socket) => {
  socket.setEncoding("utf8");
  let buffer = "";
  let emDados = false;
  let mensagem = "";
  let remetente = "";
  let destinatarios = [];

  socket.write("220 selic-teste ESMTP\r\n");

  socket.on("data", (pedaco) => {
    buffer += pedaco;

    for (;;) {
      if (emDados) {
        const fim = buffer.indexOf("\r\n.\r\n");
        if (fim === -1) return;
        mensagem += buffer.slice(0, fim + 2);
        buffer = buffer.slice(fim + 5);
        emDados = false;

        const arquivo = join(diretorio, `${Date.now()}-${++sequencia}.eml`);
        writeFileSync(
          arquivo,
          `X-Envelope-From: ${remetente}\r\nX-Envelope-To: ${destinatarios.join(", ")}\r\n${mensagem}`,
        );
        console.log(JSON.stringify({ arquivo, de: remetente, para: destinatarios }));

        socket.write("250 2.0.0 Ok: mensagem capturada\r\n");
        mensagem = "";
        remetente = "";
        destinatarios = [];
        continue;
      }

      const quebra = buffer.indexOf("\r\n");
      if (quebra === -1) return;
      const linha = buffer.slice(0, quebra);
      buffer = buffer.slice(quebra + 2);
      const verbo = linha.split(/\s+/)[0].toUpperCase();

      switch (verbo) {
        case "EHLO":
          socket.write("250-selic-teste\r\n250 PIPELINING\r\n");
          break;
        case "HELO":
          socket.write("250 selic-teste\r\n");
          break;
        case "MAIL":
          remetente = endereco(linha);
          socket.write("250 2.1.0 Ok\r\n");
          break;
        case "RCPT":
          destinatarios.push(endereco(linha));
          socket.write("250 2.1.5 Ok\r\n");
          break;
        case "DATA":
          emDados = true;
          socket.write("354 Envie os dados e finalize com <CR><LF>.<CR><LF>\r\n");
          break;
        case "RSET":
          mensagem = "";
          remetente = "";
          destinatarios = [];
          socket.write("250 2.0.0 Ok\r\n");
          break;
        case "NOOP":
          socket.write("250 2.0.0 Ok\r\n");
          break;
        case "QUIT":
          socket.write("221 2.0.0 Bye\r\n");
          socket.end();
          break;
        default:
          socket.write("502 5.5.2 Comando não implementado\r\n");
      }
    }
  });
});

servidor.listen(porta, host, () => {
  console.log(
    JSON.stringify({
      pronto: true,
      host,
      porta: servidor.address().port,
      diretorio,
    }),
  );
});

for (const sinal of ["SIGINT", "SIGTERM"]) {
  process.on(sinal, () => servidor.close(() => process.exit(0)));
}
