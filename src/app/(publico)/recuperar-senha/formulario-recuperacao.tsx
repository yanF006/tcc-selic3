"use client";

import Link from "next/link";
import * as React from "react";
import { useActionState } from "react";

import { CampoTexto, LegendaObrigatorios } from "@/components/formularios/campo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2Icon, MailCheckIcon, MailWarningIcon } from "lucide-react";

import { solicitarRedefinicaoAction, type EstadoRecuperacao } from "@/app/(publico)/acoes/senha";

const estadoInicial: EstadoRecuperacao = { ok: false };

/**
 * Pedido de redefinição de senha (5.8).
 *
 * A confirmação é a mesma para e-mail cadastrado e para e-mail inexistente: o
 * formulário não diz se o endereço pertence a alguém. Como não há servidor de
 * e-mail nesta entrega, o link que seria enviado aparece abaixo da confirmação,
 * num bloco separado e rotulado, para o fluxo ser demonstrável de ponta a ponta.
 */
export function FormularioRecuperacao() {
  const [email, setEmail] = React.useState("");

  const [estado, enviar, pendente] = useActionState(
    async (_anterior: EstadoRecuperacao, formData: FormData): Promise<EstadoRecuperacao> =>
      solicitarRedefinicaoAction(String(formData.get("email") ?? "")),
    estadoInicial,
  );

  if (estado.ok) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1 className="text-base font-semibold">Solicitação registrada</h1>
          </CardTitle>
          <CardDescription>
            A resposta é a mesma para qualquer e-mail informado, para não revelar quem tem cadastro.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert role="status">
            <CheckCircle2Icon aria-hidden="true" />
            <AlertTitle>Confira o seu e-mail</AlertTitle>
            <AlertDescription>{estado.confirmacao}</AlertDescription>
          </Alert>

          {estado.link ? (
            <section className="border-border bg-muted/40 flex flex-col gap-2 rounded-lg border p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <MailCheckIcon className="size-4 shrink-0" aria-hidden="true" />
                Link que seria enviado
              </h2>
              <p className="text-muted-foreground text-xs">
                Não há servidor de e-mail nesta entrega: o link aparece aqui para que o fluxo possa
                ser percorrido na demonstração.
              </p>
              <Link
                className="text-primary text-sm break-all underline underline-offset-4"
                href={estado.link}
              >
                {estado.link}
              </Link>
            </section>
          ) : null}

          <Button asChild variant="outline">
            <Link href="/login">Voltar para o login</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1 className="text-base font-semibold">Recuperar senha</h1>
        </CardTitle>
        <CardDescription>
          Informe o e-mail do cadastro para receber o link de redefinição.
        </CardDescription>
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
            placeholder="nome@aluno.ifrj.edu.br"
            valor={email}
            aoMudar={setEmail}
            erro={estado.erro}
          />

          <Button type="submit" disabled={pendente}>
            {pendente ? "Enviando…" : "Enviar link de redefinição"}
          </Button>

          <p className="text-muted-foreground flex flex-col items-center gap-1 text-center text-xs">
            <span className="flex items-center gap-1">
              <MailWarningIcon className="size-3.5 shrink-0" aria-hidden="true" />O link vale por 1
              hora e só pode ser usado uma vez.
            </span>
            <Link className="underline" href="/login">
              Voltar para o login
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
