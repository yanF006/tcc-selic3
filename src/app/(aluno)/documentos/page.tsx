import type { Metadata } from "next";

import { PaginaArea } from "@/components/layout/pagina-area";

export const metadata: Metadata = {
  title: "Documentos",
  description: "Preencher e acompanhar os documentos do Kit de Estágio.",
};

export default function Page() {
  return (
    <PaginaArea
      titulo="Documentos"
      descricao="Preencher e acompanhar os documentos do Kit de Estágio."
    >
      <p className="text-muted-foreground text-sm">
        Tela reservada para o bloco de implementação desta área. A rota
        <code className="bg-muted rounded px-1 py-0.5 text-xs">/documentos</code> já está registrada
        em <code className="bg-muted rounded px-1 py-0.5 text-xs">src/nav.ts</code> e protegida pela
        guarda de papel do layout.
      </p>
    </PaginaArea>
  );
}
