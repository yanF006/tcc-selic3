"use client";

import { FileDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Abre o diálogo de impressão do navegador, onde o destino "Salvar como PDF"
 * gera o arquivo do relatório sem depender de biblioteca no servidor.
 */
export function BotaoSalvarPdf() {
  return (
    <Button type="button" onClick={() => window.print()}>
      <FileDownIcon aria-hidden="true" className="size-4" />
      Salvar em PDF
    </Button>
  );
}
