import { CONTAS_DE_DESENVOLVIMENTO } from "@/lib/fixtures/base";

/**
 * Credenciais em memória (D4). A senha nunca é guardada em texto legível: o
 * que fica no mapa é o par sal + digest SHA-256, como o §5 do
 * `Contexto/visaoGeral.md` exige. O Better Auth vai substituir este módulo por
 * hash com argon2id e tabela de sessão no banco, sem que as telas mudem.
 *
 * As contas de desenvolvimento entram por demanda: a primeira conferência de um
 * e-mail semeia o digest a partir da senha da fixture, e a partir daí a senha
 * original deixa de existir em lugar nenhum.
 */

export type OrigemCredencial =
  "conta_desenvolvimento" | "cadastro_publico" | "redefinicao" | "troca_autenticada";

export interface Credencial {
  /** E-mail normalizado, com minúsculas e sem espaços. */
  email: string;
  sal: string;
  digest: string;
  origem: OrigemCredencial;
  alteradaEm: string;
}

const credenciais = new Map<string, Credencial>();

function normalizar(email: string): string {
  return email.trim().toLowerCase();
}

function agora(): string {
  return new Date().toISOString();
}

/** SHA-256 de `sal:senha` em hexadecimal. */
async function calcularDigest(sal: string, senha: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${sal}:${senha}`);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Grava (ou substitui) a credencial de um e-mail. */
export async function definirSenha(
  email: string,
  senha: string,
  origem: OrigemCredencial,
): Promise<Credencial> {
  const chave = normalizar(email);
  const sal = globalThis.crypto.randomUUID();
  const credencial: Credencial = {
    email: chave,
    sal,
    digest: await calcularDigest(sal, senha),
    origem,
    alteradaEm: agora(),
  };

  credenciais.set(chave, credencial);

  return credencial;
}

/**
 * Credencial do e-mail, semeando a conta de desenvolvimento quando ainda não
 * existe. `undefined` para e-mail sem senha conhecida.
 */
export async function credencialDe(email: string): Promise<Credencial | undefined> {
  const chave = normalizar(email);
  const existente = credenciais.get(chave);

  if (existente) return existente;

  const conta = CONTAS_DE_DESENVOLVIMENTO.find(
    (candidata) => normalizar(candidata.email) === chave,
  );

  if (!conta) return undefined;

  return definirSenha(conta.email, conta.senha, "conta_desenvolvimento");
}

/** true quando a senha informada é a do e-mail. */
export async function conferirSenha(email: string, senha: string): Promise<boolean> {
  const credencial = await credencialDe(email);

  if (!credencial) return false;

  return (await calcularDigest(credencial.sal, senha)) === credencial.digest;
}

/** true quando existe senha cadastrada para o e-mail. */
export async function temSenha(email: string): Promise<boolean> {
  return (await credencialDe(email)) !== undefined;
}

/**
 * Move a credencial para outro e-mail, mantendo a mesma senha.
 *
 * Usado quando o aluno troca o e-mail no perfil: a senha não muda, então o
 * digest e o sal seguem válidos e o login passa a ser pelo novo e-mail.
 */
export async function moverCredencial(emailAtual: string, novoEmail: string): Promise<void> {
  const credencial = await credencialDe(emailAtual);

  if (!credencial) return;

  const destino = normalizar(novoEmail);

  if (destino === credencial.email) return;

  credenciais.delete(credencial.email);
  credenciais.set(destino, { ...credencial, email: destino });
}

/** Descarta as senhas em memória; usado pelos testes e pela demonstração. */
export function reiniciarCredenciais(): void {
  credenciais.clear();
}
