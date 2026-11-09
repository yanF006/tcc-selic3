import "server-only";

import { createTransport } from "nodemailer";
import { after } from "next/server";

export type TrabalhoPosResposta = () => Promise<void>;

export interface EntregaAutenticacao {
  agendar?: (trabalho: TrabalhoPosResposta) => void;
}

interface MensagemLink {
  assunto: string;
  texto: string;
}

async function enviarLink(destinatario: string, url: string, mensagem: MensagemLink) {
  const host = process.env.SMTP_HOST?.trim();
  const remetente = process.env.SMTP_FROM?.trim();
  const porta = Number(process.env.SMTP_PORT || "587");
  const usuario = process.env.SMTP_USER;
  const senha = process.env.SMTP_PASSWORD;
  if (
    !host ||
    !remetente ||
    /[\r\n]/.test(remetente) ||
    !Number.isInteger(porta) ||
    porta < 1 ||
    porta > 65535
  ) {
    throw new Error("Configuração SMTP incompleta ou inválida.");
  }
  if (Boolean(usuario) !== Boolean(senha)) throw new Error("Credenciais SMTP incompletas.");
  const transporte = createTransport({
    host,
    port: porta,
    secure: process.env.SMTP_SECURE === "true",
    ...(usuario && senha ? { auth: { user: usuario, pass: senha } } : {}),
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
  });
  try {
    const resultado = await transporte.sendMail({
      from: remetente,
      to: destinatario,
      subject: mensagem.assunto,
      text: mensagem.texto.replace("{url}", url),
    });
    if (!resultado.accepted?.length) throw new Error("SMTP não aceitou o destinatário.");
  } finally {
    transporte.close();
  }
}

/** Não inclui mensagem SMTP, destinatário ou URL/token no diagnóstico. */
function registrarFalhaEnvio(erro: unknown) {
  const codigo =
    erro && typeof erro === "object" && "code" in erro ? String(erro.code) : "ENVIO_FALHOU";
  console.warn("[autenticacao] Falha ao enviar e-mail de autenticação.", {
    codigo: /^[A-Z0-9_]{1,64}$/.test(codigo) ? codigo : "ENVIO_FALHOU",
  });
}

/** A biblioteca gera e consome o token; aqui só se agenda o transporte. */
function agendarLink(destinatario: string, url: string, mensagem: MensagemLink, entrega: EntregaAutenticacao) {
  const agendar = entrega.agendar ?? after;
  agendar(async () => {
    try {
      await enviarLink(destinatario, url, mensagem);
    } catch (erro) {
      registrarFalhaEnvio(erro);
    }
  });
}

export function agendarLinkRecuperacao(
  destinatario: string,
  url: string,
  entrega: EntregaAutenticacao = {},
) {
  agendarLink(
    destinatario,
    url,
    {
      assunto: "SELic - definir nova senha",
      texto:
        "Para definir uma nova senha no SELic, acesse o link abaixo. Ele tem validade de uma hora e pode ser usado uma única vez.\n\n{url}\n\nSe você não solicitou esta alteração, ignore esta mensagem.",
    },
    entrega,
  );
}

export function agendarConfirmacaoDeEmail(
  destinatario: string,
  url: string,
  novoEmail: string,
  entrega: EntregaAutenticacao = {},
) {
  agendarLink(
    destinatario,
    url,
    {
      assunto: "SELic - confirmar novo e-mail",
      texto: `Recebemos um pedido para usar ${novoEmail} como novo e-mail de acesso ao SELic. Para confirmar a troca, acesse o link abaixo. Ele tem validade de uma hora e pode ser usado uma única vez.\n\n{url}\n\nSe você não solicitou esta alteração, ignore esta mensagem.`,
    },
    entrega,
  );
}
