"use client";

import Link from "next/link";
import * as React from "react";
import { useActionState } from "react";

import { CampoSenha, CampoTexto, LegendaObrigatorios } from "@/components/formularios/campo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircleIcon } from "lucide-react";

import { entrarAction, type EstadoLogin } from "@/app/(publico)/acoes/sessao";

const estadoInicial: EstadoLogin = { ok: false };

export function FormularioLogin({ destino }: { destino?: string }) {
  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");

  const [estado, enviar, pendente] = useActionState(
    async (anterior: EstadoLogin, formData: FormData) => {
      const emailEnviado = String(formData.get("email") ?? "");
      const senhaEnviada = String(formData.get("senha") ?? "");

      if (!emailEnviado || !senhaEnviada) {
        return { ok: false, erro: "Informe e-mail e senha." } satisfies EstadoLogin;
      }

      void anterior;
      void destino;

      return (await entrarAction(emailEnviado, senhaEnviada)) satisfies EstadoLogin;
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
          <LegendaObrigatorios />

          <CampoTexto
            id="email"
            rotulo="E-mail"
            obrigatorio
            tipo="email"
            autoComplete="username"
            placeholder="nome@ifrj.edu.br"
            valor={email}
            aoMudar={setEmail}
          />

          <CampoSenha
            id="senha"
            rotulo="Senha"
            obrigatorio
            autoComplete="current-password"
            valor={senha}
            aoMudar={setSenha}
          />

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
