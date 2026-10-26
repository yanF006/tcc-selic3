"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ObservacaoDocumento } from "@/lib/domain/types";
import { observarDocumentoAction } from "@/app/(aluno)/estagio/acoes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatarData } from "@/lib/format";

export function ObservacoesDocumento({
  documentoId,
  observacoes,
  nomesAutores,
  podeAcrescentar,
}: {
  documentoId: string;
  observacoes: ObservacaoDocumento[];
  nomesAutores: Record<string, string>;
  podeAcrescentar: boolean;
}) {
  const router = useRouter();
  const [conteudo, setConteudo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [pendente, iniciar] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Observações da coordenação</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {observacoes.length === 0 && (
          <p className="text-muted-foreground text-sm">Nenhuma observação registrada.</p>
        )}
        <ul className="flex flex-col gap-3">
          {observacoes.map((observacao) => (
            <li key={observacao.id} className="rounded border p-3">
              <p className="text-sm whitespace-pre-wrap">{observacao.conteudo}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {nomesAutores[observacao.autorId] ?? "Coordenação"} ·{" "}
                {formatarData(observacao.data)}
              </p>
            </li>
          ))}
        </ul>
        {podeAcrescentar && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(evento) => {
              evento.preventDefault();
              iniciar(async () => {
                const resultado = await observarDocumentoAction(documentoId, conteudo);
                setMensagem(
                  resultado.ok
                    ? "Observação acrescentada."
                    : (resultado.erro ?? "Operação recusada."),
                );
                if (resultado.ok) {
                  setConteudo("");
                  router.refresh();
                }
              });
            }}
          >
            <Label htmlFor={`observacao-documento-${documentoId}`}>Nova observação</Label>
            <Textarea
              id={`observacao-documento-${documentoId}`}
              value={conteudo}
              onChange={(evento) => setConteudo(evento.target.value)}
              required
            />
            <Button type="submit" disabled={pendente}>
              Acrescentar observação
            </Button>
          </form>
        )}
        {mensagem && (
          <p role="status" className="text-sm">
            {mensagem}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
