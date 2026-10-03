"use client";

import Link from "next/link";
import * as React from "react";
import { useActionState } from "react";

import { CampoSenha, LegendaObrigatorios } from "@/components/formularios/campo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2Icon, Link2OffIcon } from "lucide-react";

import { redefinirSenhaAction, type EstadoRedefinicao } from "@/app/(publico)/acoes/senha";
const estadoInicial: EstadoRedefinicao = { ok: false };

/**
 * Uso do link de redefinição (5.8). O link é de uso único: quando o servidor
 * recusa — porque expirou, porque nunca existiu ou porque já foi usado — a tela
 * troca o formulário pelo caminho para solicitar outro, sem insistir em um
 * formulário que não tem como funcionar.
 */
export function FormularioRedefinicao({ token }: { token: string }) {
  const [senha, setSenha] = React.useState("");
  const [confirmacao, setConfirmacao] = React.useState("");

  const [estado, enviar, pendente] = useActionState(
    async (_anterior: EstadoRedefinicao, formData: FormData): Promise<EstadoRedefinicao> =>
      redefinirSenhaAction(
        token,
        String(formData.get("senha") ?? ""),
        String(formData.get("confirmacao") ?? ""),
      ),
    estadoInicial,
  );

  if (estado.ok) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1 className="text-base font-semibold">Senha redefinida</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert role="status">
            <CheckCircle2Icon aria-hidden="true" />
            <AlertTitle>Pronto</AlertTitle>
            <AlertDescription>{estado.mensagem}</AlertDescription>
          </Alert>

          <Button asChild>
            <Link href="/login">Entrar com a nova senha</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (estado.campo === "link") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1 className="text-base font-semibold">Link não utilizável</h1>
          </CardTitle>
          <CardDescription>Este link expirou, já foi utilizado ou nunca existiu.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground flex items-start gap-2 text-sm">
            <Link2OffIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {estado.erro}
          </p>
          <Button asChild>
            <Link href="/recuperar-senha">Solicitar novo link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1 className="text-base font-semibold">Definir nova senha</h1>
        </CardTitle>
        <CardDescription>
          Depois de salva, este link deixa de valer e a senha entra no próximo acesso.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={enviar} className="flex flex-col gap-4">
          <LegendaObrigatorios />

          <CampoSenha
            id="senha"
            rotulo="Nova senha"
            obrigatorio
            conferirMinimo
            autoComplete="new-password"
            descricao="Mínimo de 8 caracteres."
            valor={senha}
            aoMudar={setSenha}
            erro={estado.campo === "senha" ? estado.erro : null}
          />

          <CampoSenha
            id="confirmacao"
            rotulo="Confirmar nova senha"
            obrigatorio
            conferirMinimo
            nomeVisibilidade="a confirmação"
            autoComplete="new-password"
            valor={confirmacao}
            aoMudar={setConfirmacao}
            erro={estado.campo === "confirmacao" ? estado.erro : null}
          />

          <Button type="submit" disabled={pendente}>
            {pendente ? "Salvando…" : "Salvar nova senha"}
          </Button>

          <p className="text-muted-foreground text-center text-xs">
            <Link className="underline" href="/login">
              Voltar para o login
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
