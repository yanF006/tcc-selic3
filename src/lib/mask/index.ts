/**
 * Máscaras de entrada como funções puras (D7).
 *
 * Cada função recebe o texto digitado ou colado e devolve o texto com a
 * máscara aplicada. Elas nunca guardam estado, o que permite reutilizá-las no
 * formulário do cadastro, no perfil e nos formulários dirigidos pelo descritor
 * de template.
 */

/** Remove tudo que não é dígito. */
export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** Limita a entrada a dígitos, com a quantidade máxima de caracteres. */
function digitosLimitados(valor: string, maximo: number): string {
  return somenteDigitos(valor).slice(0, maximo);
}

export function mascaraCpf(valor: string): string {
  const d = digitosLimitados(valor, 11);

  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;

  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function mascaraRg(valor: string): string {
  const d = digitosLimitados(valor, 9);

  if (d.length <= 2) return d;
  if (d.length <= 7) return `${d.slice(0, 2)}.${d.slice(2)}`;

  return `${d.slice(0, 2)}.${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Celular com nove dígitos: (21) 99999-9999. Com onze: (21) 99999-99999. */
export function mascaraCelular(valor: string): string {
  const d = digitosLimitados(valor, 11);

  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;

  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Telefone fixo com oito dígitos: (21) 3333-4444. */
export function mascaraTelefone(valor: string): string {
  const d = digitosLimitados(valor, 10);

  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;

  return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

/** Telefone que aceita celular ou fixo, conforme a quantidade de dígitos. */
export function mascaraTelefoneOuCelular(valor: string): string {
  const d = somenteDigitos(valor);

  return d.length > 10 ? mascaraCelular(valor) : mascaraTelefone(valor);
}

export function mascaraCep(valor: string): string {
  const d = digitosLimitados(valor, 8);

  if (d.length <= 5) return d;

  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function mascaraData(valor: string): string {
  const d = digitosLimitados(valor, 8);

  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;

  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Horas em formato decimal com uma casa: 6, 5,5. */
export function mascaraHoras(valor: string): string {
  const d = digitosLimitados(valor, 3);

  if (d.length <= 1) return d;

  return `${d.slice(0, d.length - 1)},${d.slice(d.length - 1)}`;
}

/** Horário de entrada e saída: 08:30. */
export function mascaraHora(valor: string): string {
  const d = digitosLimitados(valor, 4);

  if (d.length <= 2) return d;

  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

export const MASCARAS = {
  cpf: mascaraCpf,
  rg: mascaraRg,
  celular: mascaraCelular,
  telefone: mascaraTelefone,
  telefoneOuCelular: mascaraTelefoneOuCelular,
  cep: mascaraCep,
  data: mascaraData,
  horas: mascaraHoras,
  hora: mascaraHora,
} as const;

export type NomeMascara = keyof typeof MASCARAS;

/** Tira a máscara, devolvendo apenas os dígitos do valor original. */
export function removerMascara(nome: NomeMascara, valor: string): string {
  if (nome === "data" || nome === "hora" || nome === "horas") {
    return somenteDigitos(valor);
  }

  return somenteDigitos(valor);
}
