"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DIGEST_BANCO_INDISPONIVEL, MENSAGEM_BANCO_INDISPONIVEL } from "@/lib/db/mensagens";

function ehFalhaDeBanco(erro: Error & { digest?: string }): boolean {
  return (
    erro.digest === DIGEST_BANCO_INDISPONIVEL ||
    erro.name === "BancoIndisponivelError" ||
    erro.message === MENSAGEM_BANCO_INDISPONIVEL
  );
}

/**
 * Conteúdo comum dos `error.tsx`. Diferencia indisponibilidade de banco de um
 * erro inesperado, sem exibir mensagem interna, host ou credenciais. A nova
 * tentativa chama `reset()` e `router.refresh()` para refazer a leitura do
 * Server Component sem recarregar a aplicação inteira.
 */
export function ConteudoErroArea({
  erro,
  reset,
}: {
  erro: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [tentando, iniciarTentativa] = React.useTransition();
  const bancoIndisponivel = ehFalhaDeBanco(erro);

  function tentarNovamente() {
    iniciarTentativa(() => {
      reset();
      router.refresh();
    });
  }

  return (
    <section className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <AlertCircleIcon className="text-destructive size-10" aria-hidden="true" />
      <h1 className="text-2xl font-semibold tracking-tight">
        {bancoIndisponivel ? "Dados temporariamente indisponíveis" : "Não foi possível carregar"}
      </h1>
      <p className="text-muted-foreground text-sm">
        {bancoIndisponivel
          ? MENSAGEM_BANCO_INDISPONIVEL
          : "Ocorreu um erro inesperado ao preparar esta tela. Tente novamente; se persistir, informe o suporte."}
      </p>
      <Button type="button" onClick={tentarNovamente} disabled={tentando}>
        <RefreshCwIcon className="size-4" aria-hidden="true" />
        {tentando ? "Tentando…" : "Tentar novamente"}
      </Button>
    </section>
  );
}
