"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { decidirExclusaoAction } from "@/app/(admin)/admin/exclusoes/acoes";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PedidoExclusaoPendente } from "@/lib/services/estagios";

function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function ListaExclusoes({ pedidos }: { pedidos: PedidoExclusaoPendente[] }) {
  const router = useRouter();
  const [pendente, iniciar] = React.useTransition();
  const [erro, setErro] = React.useState<string | null>(null);

  function decidir(pedido: PedidoExclusaoPendente, autorizar: boolean) {
    const pergunta = autorizar
      ? `Excluir o estágio de ${pedido.nomeAluno}? O estágio, seus documentos, anexos e horas serão apagados definitivamente.`
      : `Recusar o pedido de exclusão do estágio de ${pedido.nomeAluno}? O estágio será mantido.`;
    if (!window.confirm(pergunta)) return;
    iniciar(async () => {
      const resultado = await decidirExclusaoAction(pedido.id, autorizar);
      if (!resultado.ok) {
        setErro(resultado.erro ?? "Não foi possível registrar a decisão.");
        return;
      }
      setErro(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {erro ? (
        <Alert variant="destructive">
          <AlertTitle>Operação recusada</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      ) : null}
      {pedidos.length === 0 ? (
        <p className="text-muted-foreground">Nenhum pedido de exclusão aguardando decisão.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Solicitado por</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Decisão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidos.map((pedido) => (
                <TableRow key={pedido.id}>
                  <TableCell>
                    <Link
                      className="underline underline-offset-4"
                      href={`/coordenacao/estagios?estagio=${pedido.estagioId}`}
                    >
                      {pedido.nomeAluno}
                    </Link>
                  </TableCell>
                  <TableCell>{pedido.nomeSolicitante}</TableCell>
                  <TableCell className="max-w-xs whitespace-normal break-words">
                    {pedido.motivo ?? "—"}
                  </TableCell>
                  <TableCell>{dataHora(pedido.criadoEm)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={pendente}
                        onClick={() => decidir(pedido, true)}
                      >
                        Autorizar exclusão
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendente}
                        onClick={() => decidir(pedido, false)}
                      >
                        Recusar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
