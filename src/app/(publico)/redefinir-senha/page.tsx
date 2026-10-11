import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link2OffIcon } from "lucide-react";

import { FormularioRedefinicao } from "@/app/(publico)/redefinir-senha/formulario-redefinicao";

export const metadata: Metadata = {
  title: "Definir nova senha",
  description: "Uso do link de redefinição de senha do SELic.",
};

/**
 * Destino do link de redefinição (5.8). Sem `token` na URL — ou com link já
 * utilizado — a tela orienta a pedir uma nova solicitação, em vez de oferecer um
 * formulário que não tem como funcionar.
 */
export default async function RedefinirSenhaPage({ searchParams }: PageProps<"/redefinir-senha">) {
  const parametros = await searchParams;
  const token = typeof parametros.token === "string" ? parametros.token : "";

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <Logo tamanho="grande" />
        <p className="text-muted-foreground text-sm">
          Sistema de Estágios das Licenciaturas do IFRJ Campus Pinheiral
        </p>
      </div>

      {token ? (
        <FormularioRedefinicao token={token} />
      ) : (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>
              <h1 className="text-base font-semibold">Link incompleto</h1>
            </CardTitle>
            <CardDescription>O endereço não traz o código do link de redefinição.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-muted-foreground flex items-start gap-2 text-sm">
              <Link2OffIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Solicite um novo link para definir a senha novamente.
            </p>
            <Button asChild>
              <Link href="/recuperar-senha">Solicitar novo link</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
