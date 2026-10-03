/**
 * Preferência de tema (2.4): as três opções oferecidas e a resolução da opção
 * escolhida diante da preferência do sistema. O `next-themes` cuida da
 * persistência e do atributo de classe; este módulo concentra a decisão para que
 * a navegação, o logotipo e o preview de impressão falem do mesmo contrato.
 */

export const TEMAS = [
  { valor: "light", rotulo: "Claro" },
  { valor: "dark", rotulo: "Escuro" },
  { valor: "system", rotulo: "Sistema" },
] as const;

export type TemaPreferido = (typeof TEMAS)[number]["valor"];
export type TemaAplicado = "light" | "dark";

/** Resolve a opção escolhida na preferência real do sistema operacional. */
export function resolverTema(
  preferido: TemaPreferido,
  preferenciaDoSistema: TemaAplicado,
): TemaAplicado {
  return preferido === "system" ? preferenciaDoSistema : preferido;
}

/** Converte a preferência do sistema reportada pelo navegador. */
export function temaDoSistema(temPreferenciaEscura: boolean): TemaAplicado {
  return temPreferenciaEscura ? "dark" : "light";
}
