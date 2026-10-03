"use client";

import * as React from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";

import { decidirSolicitacaoAction } from "@/app/(gestao)/solicitacoes/acoes";

import { metadadoSolicitud } from "@/lib/domain/status";

import type { SolicitacaoAcesso } from "@/lib/domain/types";

/**
 * Fila de cadastros pendentes (5.6): a coordenação e a administração autorizam
 * ou recusam com motivo. Autorizar libera o acesso; recusar mantém o cadastro
 * inativo.
 */
export function TabelaSolicitacoes({ solicitacoes }: { solicitacoes: SolicitacaoAcesso[] }) {
  const [situacao, setSituacao] = React.useState("pendente");
  const [busca, setBusca] = React.useState("");
  const [motivos, setMotivos] = React.useState<Record<string, string>>({});
  const [erros, setErros] = React.useState<Record<string, string>>({});
  const [avisos, setAvisos] = React.useState<Record<string, string>>({});
  const [pendente, iniciar] = React.useTransition();

  const filtradas = solicitacoes.filter((solicitacao) => {
    const combinaSituacao = situacao === "todas" || solicitacao.situacao === situacao;
    const termo = busca.trim().toLowerCase();

    const combinaBusca =
      termo === "" ||
      [solicitacao.nome, solicitacao.email, solicitacao.matricula].some((campo) =>
        campo.toLowerCase().includes(termo),
      );

    return combinaSituacao && combinaBusca;
  });

  function decidir(id: string, decisao: "autorizado" | "recusado") {
    setErros((anterior) => ({ ...anterior, [id]: "" }));
    setAvisos((anterior) => ({ ...anterior, [id]: "" }));

    iniciar(async () => {
      const resultado = await decidirSolicitacaoAction(id, decisao, motivos[id] ?? "");

      if (!resultado.ok) {
        setErros((anterior) => ({ ...anterior, [id]: resultado.erro ?? "Falha na decisão." }));

        return;
      }

      setAvisos((anterior) => ({
        ...anterior,
        [id]: decisao === "autorizado" ? "Acesso liberado." : "Cadastro recusado.",
      }));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-64 flex-1 flex-col gap-2">
          <Label htmlFor="solicitacao-busca">Buscar por nome, e-mail ou matrícula</Label>
          <Input
            id="solicitacao-busca"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Rafaela"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="solicitacao-situacao">Situação</Label>
          <Select value={situacao} onValueChange={setSituacao}>
            <SelectTrigger id="solicitacao-situacao" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="autorizado">Autorizadas</SelectItem>
              <SelectItem value="recusado">Recusadas</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <p data-testid="total-solicitacoes" className="text-muted-foreground text-sm">
        {filtradas.length === 0
          ? "Nenhuma solicitação encontrada com os filtros informados."
          : `${filtradas.length} solicitação(ões) encontrada(s).`}
      </p>

      <div className="border-border w-full overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Motivo registrado</TableHead>
              <TableHead>Decisão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.map((solicitacao) => {
              const metadado = metadadoSolicitud(solicitacao.situacao);

              return (
                <TableRow key={solicitacao.id}>
                  <TableCell className="font-medium">{solicitacao.nome}</TableCell>
                  <TableCell>{solicitacao.email}</TableCell>
                  <TableCell>{solicitacao.matricula}</TableCell>
                  <TableCell>
                    <span className="text-xs font-medium">{metadado.rotulo}</span>
                  </TableCell>
                  <TableCell className="max-w-64 text-xs">{solicitacao.motivo ?? "—"}</TableCell>
                  <TableCell>
                    {solicitacao.situacao === "pendente" ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs" htmlFor={`motivo-${solicitacao.id}`}>
                            Motivo da decisão
                          </Label>
                          <Input
                            id={`motivo-${solicitacao.id}`}
                            value={motivos[solicitacao.id] ?? ""}
                            onChange={(evento) =>
                              setMotivos((anterior) => ({
                                ...anterior,
                                [solicitacao.id]: evento.target.value,
                              }))
                            }
                            placeholder="Obrigatório ao recusar"
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={pendente}
                            onClick={() => decidir(solicitacao.id, "autorizado")}
                          >
                            Autorizar acesso
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pendente}
                            onClick={() => decidir(solicitacao.id, "recusado")}
                          >
                            Recusar cadastro
                          </Button>
                        </div>

                        {avisos[solicitacao.id] ? (
                          <p className="flex items-center gap-1 text-xs" role="status">
                            <CheckCircle2Icon aria-hidden="true" />
                            {avisos[solicitacao.id]}
                          </p>
                        ) : null}

                        {erros[solicitacao.id] ? (
                          <p className="flex items-center gap-1 text-xs" role="alert">
                            <AlertCircleIcon aria-hidden="true" />
                            {erros[solicitacao.id]}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {solicitacao.decididoEm
                          ? `Decidida em ${solicitacao.decididoEm.slice(0, 10)}`
                          : "—"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Alert>
        <AlertCircleIcon aria-hidden="true" />
        <AlertDescription>
          Autorizar libera o acesso do aluno e a recusa mantém o cadastro inativo, com o motivo
          registrado para consulta.
        </AlertDescription>
      </Alert>
    </div>
  );
}
