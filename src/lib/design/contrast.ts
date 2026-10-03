/**
 * Cálculo de contraste WCAG 2.1 usado pelos testes de token e pela auditoria
 * de contraste dos dois temas.
 */

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb {
  const limpo = hex.trim().replace("#", "");
  const completo =
    limpo.length === 3
      ? limpo
          .split("")
          .map((c) => c + c)
          .join("")
      : limpo;

  return {
    r: parseInt(completo.slice(0, 2), 16),
    g: parseInt(completo.slice(2, 4), 16),
    b: parseInt(completo.slice(4, 6), 16),
  };
}

function canal(canalValor: number): number {
  const s = canalValor / 255;

  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminanciaRelativa(cor: Rgb): number {
  return 0.2126 * canal(cor.r) + 0.7152 * canal(cor.g) + 0.0722 * canal(cor.b);
}

export function razaoDeContraste(primeira: string, segunda: string): number {
  const l1 = luminanciaRelativa(hexToRgb(primeira));
  const l2 = luminanciaRelativa(hexToRgb(segunda));

  const [claro, escuro] = l1 > l2 ? [l1, l2] : [l2, l1];

  return (claro + 0.05) / (escuro + 0.05);
}

/** Contraste mínimo exigido para texto normal, conforme WCAG 2.1 AA. */
export const CONTRASTE_TEXTO_AA = 4.5;

/** Contraste mínimo exigido para texto grande, ícones e bordas focadas. */
export const CONTRASTE_NAO_TEXTO_AA = 3;

/**
 * Lê as variáveis CSS de um bloco de `globals.css`.
 * `seletor` pode ser `:root`, `.dark` ou `.impressao`.
 */
export function lerTokensDoCss(css: string, seletor: string): Record<string, string> {
  const inicio = css.indexOf(`${seletor} {`);
  if (inicio === -1) {
    throw new Error(`Bloco ${seletor} não encontrado em globals.css`);
  }

  const fim = css.indexOf("}", inicio);
  const bloco = css.slice(inicio, fim);
  const tokens: Record<string, string> = {};

  for (const linha of bloco.split("\n")) {
    const correspondencia = /--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/.exec(linha);

    if (correspondencia) {
      tokens[correspondencia[1]] = correspondencia[2];
    }
  }

  return tokens;
}
