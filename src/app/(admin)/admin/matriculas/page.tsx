import type { Metadata } from "next";

import { PaginaArea } from "@/components/layout/pagina-area";

export const metadata: Metadata = {
  title: "Matrículas",
  description: "Importar matrículas manualmente enquanto não houver integração com o SIGAA.",
};

export default function Page() {
  return (
    <PaginaArea
      titulo="Matrículas"
      descricao="Importar matrículas manualmente enquanto não houver integração com o SIGAA."
    >
      <p className="text-muted-foreground text-sm">
        Tela reservada para o bloco de implementação desta área. A rota
        <code className="bg-muted rounded px-1 py-0.5 text-xs">/admin/matriculas</code> já está
        registrada em <code className="bg-muted rounded px-1 py-0.5 text-xs">src/nav.ts</code> e
        protegida pela guarda de papel do layout.
      </p>
    </PaginaArea>
  );
}
