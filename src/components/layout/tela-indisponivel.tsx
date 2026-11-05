"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MENSAGEM_BANCO_INDISPONIVEL } from "@/lib/db/mensagens";

/**
 * Tela segura quando a própria casca autenticada não consegue resolver a sessão
 * porque o banco está indisponível. Fica fora do layout com navbar (que depende
 * do usuário) e permite refazer a leitura sem reiniciar o processo.
 */
export function TelaIndisponivel() {
  const router = useRouter();
  const [tentando, iniciarTentativa] = React.useTransition();

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <AlertCircleIcon className="text-destructive size-10" aria-hidden="true" />
      <h1 className="text-2xl font-semibold tracking-tight">Dados temporariamente indisponíveis</h1>
      <p className="text-muted-foreground text-sm">{MENSAGEM_BANCO_INDISPONIVEL}</p>
      <Button
        type="button"
        disabled={tentando}
        onClick={() => iniciarTentativa(() => router.refresh())}
      >
        <RefreshCwIcon className="size-4" aria-hidden="true" />
        {tentando ? "Tentando…" : "Tentar novamente"}
      </Button>
    </main>
  );
}
