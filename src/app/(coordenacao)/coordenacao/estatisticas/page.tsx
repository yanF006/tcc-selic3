import type { Metadata } from "next";

import { PaginaArea } from "@/components/layout/pagina-area";

export const metadata: Metadata = {
  title: "Estatísticas",
  description: "Pesquisar estágios eIndicadores por curso, período e instituição.",
};

export default function Page() {
  return (
    <PaginaArea
      titulo="Estatísticas"
      descricao="Pesquisar estágios eIndicadores por curso, período e instituição."
    >
      <p className="text-muted-foreground text-sm">
        Tela reservada para o bloco de implementação desta área. A rota
        <code className="bg-muted rounded px-1 py-0.5 text-xs">/coordenacao/documentos</code> já
        está registrada em <code className="bg-muted rounded px-1 py-0.5 text-xs">src/nav.ts</code>{" "}
        e protegida pela guarda de papel do layout.
      </p>
    </PaginaArea>
  );
}
