import type { Metadata } from "next";

/**
 * Área de impressão de documento (8.13). Diferente das demais áreas
 * autenticadas, não usa a casca com navbar: a página precisa imprimir apenas a
 * folha, sem nenhuma interface ao redor. A sessão é conferida na própria página.
 */
export const metadata: Metadata = {
  title: "Impressão de documento",
};

export default function LayoutImpressao({ children }: LayoutProps<"/">) {
  return <>{children}</>;
}
