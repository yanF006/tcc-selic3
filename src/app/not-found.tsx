import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

/** Página 404: sem dados do sistema e com o caminho de retorno. */
export default function NaoEncontrado() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo tamanho="medio" />

      <div className="max-w-md space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Página não encontrada</h1>
        <p className="text-muted-foreground text-sm">
          O endereço acessado não existe ou foi movido.
        </p>
      </div>

      <Button asChild>
        <Link href="/">Voltar ao início</Link>
      </Button>
    </main>
  );
}
