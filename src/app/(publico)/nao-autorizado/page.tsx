import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Acesso não autorizado",
  description: "Você não tem permissão para acessar esta área do SELic.",
};

/**
 * Tela de acesso não autorizado (4.5): mostra apenas a informação de que o
 * acesso foi recusado, sem listar usuários, cursos, estágios ou qualquer dado do
 * sistema.
 */
export default function NaoAutorizadoPage() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo tamanho="medio" />

      <div className="max-w-md space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Acesso não autorizado</h1>
        <p className="text-muted-foreground text-sm">
          Sua conta não tem permissão para acessar esta área. Se acredita que isso é um engano, fale
          com a coordenação do estágio.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href="/">Voltar ao início</Link>
        </Button>
      </div>
    </main>
  );
}
