import type { Metadata } from "next";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { FormularioRecuperacao } from "@/app/(publico)/recuperar-senha/formulario-recuperacao";

export const metadata: Metadata = {
  title: "Recuperar senha",
  description: "Pedido de link para definir uma nova senha no SELic.",
};

/** Pedido de redefinição de senha (5.8): a confirmação é a mesma exista ou não conta. */
export default function RecuperarSenhaPage() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <Logo tamanho="grande" />
        <p className="text-muted-foreground text-sm">
          Sistema de Gestão de Estágio do IFRJ Campus Pinheiral
        </p>
      </div>

      <FormularioRecuperacao />
    </main>
  );
}
