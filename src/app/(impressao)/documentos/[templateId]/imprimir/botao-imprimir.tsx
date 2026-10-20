"use client";

import { PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Botão de impressão da página dedicada (8.13). É a única peça interativa da
 * tela; o contêiner ao redor leva `.sem-impressao`, então ele não vai ao papel.
 */
export function BotaoImprimir() {
  return (
    <Button type="button" onClick={() => window.print()}>
      <PrinterIcon aria-hidden="true" className="size-4" />
      Imprimir documento
    </Button>
  );
}
