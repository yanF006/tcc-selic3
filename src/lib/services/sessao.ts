import { rotuloPapel } from "@/lib/domain/status";
import type { Papel, Usuario } from "@/lib/domain/types";
import { CONTAS_DE_DESENVOLVIMENTO } from "@/lib/fixtures/base";

import { agora, obterEstado, novoId } from "./store";

/**
 * Sessão simulada (D5). A sessão vive em memória no navegador; o servidor vai
 * trocar este módulo por cookie assinada e Better Auth.
 */

export interface Sessao {
  usuario: Usuario;
  iniciadaEm: string;
}

export interface ContaDesenvolvimento {
  id: string;
  email: string;
  senha: string;
  papeis: Papel[];
  rotulo: string;
}

export interface ResultadoLogin {
  ok: boolean;
  /** Mensagem exibida no formulário quando o login falha. */
  erro?: string;
}

let sessaoAtual: Sessao | null = null;

export function contasDeDesenvolvimento(): ContaDesenvolvimento[] {
  return CONTAS_DE_DESENVOLVIMENTO.map((conta) => ({
    ...conta,
    papeis: [...conta.papeis] as Papel[],
  }));
}

export function sessao(): Sessao | null {
  return sessaoAtual;
}

export function usuarioAtual(): Usuario | null {
  return sessaoAtual?.usuario ?? null;
}

export function estaAutenticado(): boolean {
  return sessaoAtual !== null;
}

export function papeisAtuais(): Papel[] {
  return sessaoAtual?.usuario.papeis ?? [];
}

export function temPapel(...papeis: Papel[]): boolean {
  return papeis.some((papel) => papeisAtuais().includes(papel));
}

/** true quando o Coordenador de Estágio atua como membro da Comissão. */
export function membroComissaoEstagio(): boolean {
  const usuario = usuarioAtual();

  return (
    usuario?.papeis.includes("coordenador_estagio") === true &&
    usuario.membroComissaoEstagio === true
  );
}

export async function entrar(email: string, senha: string): Promise<ResultadoLogin> {
  const conta = CONTAS_DE_DESENVOLVIMENTO.find(
    (candidato) => candidato.email.toLowerCase() === email.trim().toLowerCase(),
  );

  if (!conta || conta.senha !== senha) {
    return { ok: false, erro: "E-mail ou senha inválidos." };
  }

  const usuario = obterEstado().usuarios.find((candidato) => candidato.id === conta.id);

  // Cadastro pendente entra no sistema para ver o aviso de aguardo (5.7);
  // inativo é recusado com a mesma mensagem genérica do e-mail inexistente.
  if (!usuario || usuario.situacao === "inativo") {
    return { ok: false, erro: "E-mail ou senha inválidos." };
  }

  sessaoAtual = { usuario, iniciadaEm: agora() };

  return { ok: true };
}

export function sair(): void {
  sessaoAtual = null;
}

/** Recarrega a sessão a partir do estado, como faria o servidor a cada requisição. */
export async function recarregarSessao(): Promise<Usuario | null> {
  if (!sessaoAtual) return null;

  const usuario = obterEstado().usuarios.find(
    (candidato) => candidato.id === sessaoAtual?.usuario.id,
  );

  if (!usuario || usuario.situacao !== "ativo") {
    sessaoAtual = null;

    return null;
  }

  sessaoAtual = { ...sessaoAtual, usuario };

  return usuario;
}

export function rotuloSessao(): string {
  const usuario = usuarioAtual();

  if (!usuario) return "Visitante";

  return `${usuario.nome} — ${usuario.papeis.map(rotuloPapel).join(", ")}`;
}

export function usuarioPorId(id: string): Usuario | null {
  return obterEstado().usuarios.find((usuario) => usuario.id === id) ?? null;
}

export function notificacoesDoUsuario(id: string): number {
  return obterEstado().notificacoes.filter(
    (notificacao) => notificacao.destinatarioId === id && !notificacao.lida,
  ).length;
}

export function notificar(
  destinatarioId: string,
  titulo: string,
  mensagem: string,
  tipo: "parecer" | "acesso" | "envio" | "sistema" = "sistema",
): void {
  obterEstado().notificacoes.push({
    id: novoId("ntf"),
    destinatarioId,
    titulo,
    mensagem,
    tipo,
    lida: false,
    criadaEm: agora(),
  });
}

export function marcarNotificacoesLidas(destinatarioId: string): void {
  for (const notificacao of obterEstado().notificacoes) {
    if (notificacao.destinatarioId === destinatarioId) notificacao.lida = true;
  }
}
