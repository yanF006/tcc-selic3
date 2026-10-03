import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { FormularioLogin } from "@/app/(publico)/login/formulario-login";
import { usuarioDaRequisicao, rotaInicial } from "@/lib/auth/sessao-servidor";
import { contasDeDesenvolvimento } from "@/lib/services/sessao";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesso ao SELic — Sistema de Gestão de Estágio do IFRJ Campus Pinheiral.",
};

/** Formulário de acesso com as quatro contas de desenvolvimento (D3). */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const parametros = await searchParams;
  const destino = typeof parametros.redirect === "string" ? parametros.redirect : undefined;
  const usuario = await usuarioDaRequisicao();

  if (usuario) redirect(destino ?? rotaInicial(usuario));

  const contas = contasDeDesenvolvimento();

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

      <FormularioLogin destino={destino} />

      <section className="border-border bg-card w-full max-w-sm rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Contas de desenvolvimento</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Senha <code className="bg-muted rounded px-1">selic123</code> para todas. Autenticação
          real (Better Auth) fica para a etapa do backend.
        </p>
        <ul className="mt-3 flex flex-col gap-2 text-xs">
          {contas.map((conta) => (
            <li key={conta.id} className="flex flex-col">
              <span className="font-medium">{conta.rotulo}</span>
              <span className="text-muted-foreground">{conta.email}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
