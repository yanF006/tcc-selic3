"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertCircleIcon } from "lucide-react";

import { entrarAction, type EstadoLogin } from "@/app/(publico)/acoes/sessao";

const estadoInicial: EstadoLogin = { ok: false };

export function FormularioLogin({ destino }: { destino?: string }) {
  const [estado, enviar, pendente] = useActionState(
    async (anterior: EstadoLogin, formData: FormData) => {
      const email = String(formData.get("email") ?? "");
      const senha = String(formData.get("senha") ?? "");

      if (!email || !senha) {
        return { ok: false, erro: "Informe e-mail e senha." } satisfies EstadoLogin;
      }

      void anterior;
      void destino;

      return (await entrarAction(email, senha)) satisfies EstadoLogin;
    },
    estadoInicial,
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-base">
          <h1 className="text-base font-semibold">Entrar</h1>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={enviar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder="nome@ifrj.edu.br"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              name="senha"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {estado.erro ? (
            <Alert variant="destructive" role="alert">
              <AlertCircleIcon className="size-4" aria-hidden="true" />
              <AlertTitle>Não foi possível entrar</AlertTitle>
              <AlertDescription>{estado.erro}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={pendente}>
            {pendente ? "Entrando…" : "Entrar"}
          </Button>

          <p className="text-muted-foreground text-center text-xs">
            Ainda não tem cadastro?{" "}
            <Link className="underline" href="/cadastro">
              Criar cadastro
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
