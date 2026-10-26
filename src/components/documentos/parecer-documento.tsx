"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { emitirParecerAction } from "@/app/(aluno)/estagio/acoes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ParecerDocumento({ documentoId }: { documentoId: string }) {
  const router = useRouter();
  const [decisao, setDecisao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(evento) => {
        evento.preventDefault();
        iniciar(async () => {
          const resultado = await emitirParecerAction(
            documentoId,
            decisao as "aprovado" | "indeferido",
            observacao,
          );
          setErro(
            resultado.ok ? null : (resultado.erro ?? "Não foi possível registrar o parecer."),
          );
          if (resultado.ok) router.refresh();
        });
      }}
    >
      <Label htmlFor={`decisao-${documentoId}`}>Decisão do parecer</Label>
      <select
        className="bg-background rounded border p-2"
        id={`decisao-${documentoId}`}
        value={decisao}
        onChange={(evento) => setDecisao(evento.target.value)}
        required
      >
        <option value="">Selecione a decisão</option>
        <option value="aprovado">Aprovar</option>
        <option value="indeferido">Indeferir</option>
      </select>
      <Label htmlFor={`consideracoes-${documentoId}`}>Observações do parecer</Label>
      <Textarea
        id={`consideracoes-${documentoId}`}
        value={observacao}
        onChange={(evento) => setObservacao(evento.target.value)}
      />
      {erro && (
        <Alert variant="destructive">
          <AlertTitle>Parecer recusado</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <Button disabled={pendente} type="submit">
        Emitir parecer
      </Button>
    </form>
  );
}
