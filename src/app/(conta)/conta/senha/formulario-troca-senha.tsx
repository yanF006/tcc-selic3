"use client";

import * as React from "react";
import { useActionState } from "react";

import { CampoSenha, LegendaObrigatorios } from "@/components/formularios/campo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2Icon } from "lucide-react";

import { trocarSenhaAction, type EstadoTrocaSenha } from "@/app/(conta)/conta/senha/acoes";

const estadoInicial: EstadoTrocaSenha = { ok: false };

/**
 * Troca de senha do usuário autenticado (5.9). A senha atual é exigida e o erro
 * fica no campo correspondente; como a gravação só acontece quando a senha atual
 * confere, uma senha atual errada mantém a anterior.
 */
export function FormularioTrocaSenha() {
  const [senhaAtual, setSenhaAtual] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [confirmacao, setConfirmacao] = React.useState("");

  const [estado, enviar, pendente] = useActionState(
    async (_anterior: EstadoTrocaSenha, formData: FormData): Promise<EstadoTrocaSenha> =>
      trocarSenhaAction(
        String(formData.get("senhaAtual") ?? ""),
        String(formData.get("senha") ?? ""),
        String(formData.get("confirmacao") ?? ""),
      ),
    estadoInicial,
  );

  function erroDoCampo(campo: "senha" | "confirmacao" | "senhaAtual"): string | null {
    return !estado.ok && estado.campo === campo ? (estado.erro ?? null) : null;
  }

  if (estado.ok) {
    return (
      <Card className="w-full max-w-xl">
        <CardContent className="pt-6">
          <Alert role="status">
            <CheckCircle2Icon aria-hidden="true" />
            <AlertTitle>Senha alterada</AlertTitle>
            <AlertDescription>{estado.mensagem}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-xl">
      <CardContent className="pt-6">
        <form action={enviar} className="flex flex-col gap-4">
          <LegendaObrigatorios />

          <CampoSenha
            id="senhaAtual"
            rotulo="Senha atual"
            obrigatorio
            autoComplete="current-password"
            valor={senhaAtual}
            aoMudar={setSenhaAtual}
            erro={erroDoCampo("senhaAtual")}
          />

          <CampoSenha
            id="senha"
            rotulo="Nova senha"
            obrigatorio
            conferirMinimo
            autoComplete="new-password"
            descricao="Mínimo de 8 caracteres."
            valor={senha}
            aoMudar={setSenha}
            erro={erroDoCampo("senha")}
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
            erro={erroDoCampo("confirmacao")}
          />

          <div>
            <Button type="submit" disabled={pendente}>
              {pendente ? "Alterando…" : "Alterar senha"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
