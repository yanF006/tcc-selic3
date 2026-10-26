"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DOCUMENTOS_INICIAIS, estagioEncerrado } from "@/lib/domain/fluxo-estagio";
import type {
  DocumentoPreenchido,
  EnvioExterno,
  Estagio,
  ObservacaoDocumento,
  Papel,
  Parecer,
  TemplateDocumento,
} from "@/lib/domain/types";
import { formatarData } from "@/lib/format";
import {
  alterarSituacaoAction,
  confirmarAssinaturasAction,
  corrigirSolicitacaoAction,
  emitirParecerAction,
  encaminharEstagioAction,
  enviarAssinaturasAction,
  observarDocumentoAction,
} from "@/app/(aluno)/estagio/acoes";

export interface DadosPainelFluxo {
  papeis: Papel[];
  autorId: string;
  observacoes: ObservacaoDocumento[];
  pareceres: Parecer[];
  envios: EnvioExterno[];
  nomesAutores: Record<string, string>;
}

export function PainelFluxo({
  estagio,
  documentos,
  templates,
  dados,
}: {
  estagio: Estagio;
  documentos: DocumentoPreenchido[];
  templates: TemplateDocumento[];
  dados: DadosPainelFluxo;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});
  const [confirmadas, setConfirmadas] = useState<string[]>([]);
  const [decisao, setDecisao] = useState("");
  const iniciais = DOCUMENTOS_INICIAIS.map((id) =>
    documentos.find((doc) => doc.templateId === id && doc.situacao !== "inativo"),
  ).filter((doc): doc is DocumentoPreenchido => Boolean(doc));
  const formulario = iniciais.find((doc) => doc.templateId === DOCUMENTOS_INICIAIS[0]);
  const encerrado = estagioEncerrado(estagio);
  const titular = dados.autorId === estagio.alunoId;
  const coordCurso = dados.papeis.includes("coordenador_curso");
  const coordEstagio = dados.papeis.includes("coordenador_estagio");
  const emPreparacao = estagio.situacao === "em_preparacao" && !encerrado;
  const descricao = encerrado
    ? "Registro encerrado e preservado para histórico."
    : estagio.liberadoEm
      ? "Documentação inicial conferida. Os demais documentos estão disponíveis."
      : formulario?.situacao === "indeferido" || formulario?.correcaoAberta
        ? "Parecer desfavorável: corrija os dados e solicite nova submissão."
        : formulario?.situacao === "aprovado"
          ? "Parecer favorável. Aguarde as assinaturas externas e a conferência do Coordenador de Estágio."
          : estagio.encaminhadoEm
            ? "Solicitação encaminhada. Aguarde o parecer do Coordenador de Curso."
            : "Confira os três documentos iniciais e solicite o encaminhamento. Os demais documentos aguardam liberação.";

  function executar(acao: () => Promise<{ ok: boolean; erro?: string }>, sucesso: string) {
    setMensagem(null);
    iniciar(async () => {
      const resultado = await acao();
      setMensagem({
        ok: resultado.ok,
        texto: resultado.ok ? sucesso : (resultado.erro ?? "Operação recusada."),
      });
      if (resultado.ok) router.refresh();
    });
  }

  return (
    <Card data-testid="fluxo-estagio">
      <CardHeader>
        <CardTitle>Regularização do estágio</CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {mensagem && (
          <Alert variant={mensagem.ok ? "default" : "destructive"}>
            <AlertTitle>{mensagem.ok ? "Operação concluída" : "Operação recusada"}</AlertTitle>
            <AlertDescription>{mensagem.texto}</AlertDescription>
          </Alert>
        )}
        {emPreparacao && titular && formulario?.situacao === "rascunho" && (
          <Button
            disabled={pendente}
            onClick={() =>
              executar(
                () => encaminharEstagioAction(estagio.id),
                "Solicitação encaminhada para parecer.",
              )
            }
          >
            Solicitar encaminhamento
          </Button>
        )}
        {emPreparacao && titular && formulario?.situacao === "indeferido" && (
          <Button
            disabled={pendente}
            onClick={() =>
              executar(
                () => corrigirSolicitacaoAction(estagio.id),
                "Correção liberada para nova submissão.",
              )
            }
          >
            Corrigir indeferimento
          </Button>
        )}
        {emPreparacao &&
          coordCurso &&
          formulario &&
          ["submetido", "em_analise"].includes(formulario.situacao) && (
            <form
              className="flex flex-col gap-3 rounded border p-4"
              onSubmit={(evento) => {
                evento.preventDefault();
                executar(
                  () =>
                    emitirParecerAction(
                      formulario.id,
                      decisao as "aprovado" | "indeferido",
                      observacoes[formulario.id] ?? "",
                    ),
                  "Parecer registrado.",
                );
              }}
            >
              <Label htmlFor={`decisao-${estagio.id}`}>Parecer do Formulário de Liberação</Label>
              <select
                id={`decisao-${estagio.id}`}
                className="bg-background rounded border p-2"
                value={decisao}
                required
                onChange={(evento) => setDecisao(evento.target.value)}
              >
                <option value="">Selecione a decisão</option>
                <option value="aprovado">Aprovar</option>
                <option value="indeferido">Indeferir</option>
              </select>
              <Label htmlFor={`parecer-obs-${formulario.id}`}>Observações do parecer</Label>
              <Textarea
                id={`parecer-obs-${formulario.id}`}
                value={observacoes[formulario.id] ?? ""}
                onChange={(evento) =>
                  setObservacoes({ ...observacoes, [formulario.id]: evento.target.value })
                }
              />
              <Button disabled={pendente} type="submit">
                Emitir parecer
              </Button>
            </form>
          )}
        {documentos
          .filter((doc) => doc.situacao !== "inativo" || encerrado)
          .map((documento) => {
            const nome =
              templates.find((template) => template.id === documento.templateId)?.nome ??
              documento.templateId;
            return (
              <section
                key={documento.id}
                aria-label={nome}
                className="flex flex-col gap-3 rounded border p-4"
              >
                <h3 className="font-medium">{nome}</h3>
                {documento.assinaturasConfirmadasEm && (
                  <p className="text-muted-foreground text-sm">
                    Assinaturas confirmadas por{" "}
                    {dados.nomesAutores[documento.assinaturasConfirmadasPorId ?? ""] ??
                      "coordenação"}{" "}
                    em {formatarData(documento.assinaturasConfirmadasEm)}.
                  </p>
                )}
                {dados.pareceres
                  .filter((parecer) => parecer.documentoId === documento.id)
                  .map((parecer) => (
                    <p className="text-sm" key={parecer.id}>
                      Parecer {parecer.decisao === "aprovado" ? "favorável" : "desfavorável"} por{" "}
                      {dados.nomesAutores[parecer.autorId] ?? "coordenação"} em{" "}
                      {formatarData(parecer.data)}
                      {parecer.consideracoes ? `: ${parecer.consideracoes}` : "."}
                    </p>
                  ))}
                {dados.envios
                  .filter((envio) => envio.documentoId === documento.id)
                  .map((envio) => (
                    <p className="text-muted-foreground text-sm" key={envio.id}>
                      {envio.status === "enviado" ? "Enviado" : "Falha no envio"} para{" "}
                      {envio.destinatario}
                      {envio.destinatarioEmail
                        ? ` (${envio.destinatarioEmail})`
                        : estagio.excluidoEm && envio.destinatarioPapel === "aluno"
                          ? " — contato removido do histórico"
                          : " — e-mail indisponível"}{" "}
                      em {formatarData(envio.enviadoEm)}, por{" "}
                      {dados.nomesAutores[envio.autorId] ?? "Usuário registrado"}. Tentativa{" "}
                      {envio.tentativa}. {envio.erro}
                    </p>
                  ))}
                {!encerrado &&
                  formulario?.situacao === "aprovado" &&
                  (titular || coordCurso || coordEstagio) &&
                  DOCUMENTOS_INICIAIS.some((id) => id === documento.templateId) && (
                    <Button
                      variant="outline"
                      disabled={pendente}
                      onClick={() =>
                        executar(
                          () => enviarAssinaturasAction(documento.id),
                          "Envio registrado. A assinatura acontece fora do sistema.",
                        )
                      }
                    >
                      Reenviar para assinaturas
                    </Button>
                  )}
                {emPreparacao &&
                  coordEstagio &&
                  formulario?.situacao === "aprovado" &&
                  DOCUMENTOS_INICIAIS.some((id) => id === documento.templateId) && (
                    <Label className="flex items-center gap-2">
                      <Checkbox
                        checked={confirmadas.includes(documento.id)}
                        onCheckedChange={(valor) =>
                          setConfirmadas((atual) =>
                            valor === true
                              ? [...atual, documento.id]
                              : atual.filter((id) => id !== documento.id),
                          )
                        }
                      />
                      Assinaturas conferidas — {nome}
                    </Label>
                  )}
                <ul className="flex flex-col gap-2" aria-label={`Observações de ${nome}`}>
                  {dados.observacoes
                    .filter((observacao) => observacao.documentoId === documento.id)
                    .map((observacao) => (
                      <li key={observacao.id} className="text-sm">
                        <p>{observacao.conteudo}</p>
                        <p className="text-muted-foreground text-xs">
                          {dados.nomesAutores[observacao.autorId] ?? "Coordenação"} ·{" "}
                          {formatarData(observacao.data)}
                        </p>
                      </li>
                    ))}
                </ul>
                {(coordCurso || coordEstagio) && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`observacao-${documento.id}`}>Nova observação — {nome}</Label>
                    <Textarea
                      id={`observacao-${documento.id}`}
                      value={observacoes[documento.id] ?? ""}
                      onChange={(evento) =>
                        setObservacoes({ ...observacoes, [documento.id]: evento.target.value })
                      }
                    />
                    <Button
                      variant="outline"
                      disabled={pendente || !observacoes[documento.id]?.trim()}
                      onClick={() =>
                        executar(
                          () =>
                            observarDocumentoAction(documento.id, observacoes[documento.id] ?? ""),
                          "Observação acrescentada ao histórico.",
                        )
                      }
                    >
                      Acrescentar observação
                    </Button>
                  </div>
                )}
              </section>
            );
          })}
        {emPreparacao && coordEstagio && formulario?.situacao === "aprovado" && (
          <Button
            disabled={pendente}
            onClick={() =>
              executar(
                () =>
                  confirmarAssinaturasAction(
                    estagio.id,
                    iniciais.map((doc) => ({
                      documentoId: doc.id,
                      confirmado: confirmadas.includes(doc.id),
                      observacao: observacoes[doc.id],
                    })),
                  ),
                "Assinaturas confirmadas. Estágio liberado e aluno notificado.",
              )
            }
          >
            Confirmar assinaturas e liberar estágio
          </Button>
        )}
        {!encerrado && estagio.liberadoEm && (coordCurso || coordEstagio) && (
          <Button
            variant="outline"
            disabled={pendente}
            onClick={() =>
              executar(
                () => alterarSituacaoAction(estagio.id, estagio.situacao !== "concluido"),
                "Situação atualizada pela coordenação.",
              )
            }
          >
            {estagio.situacao === "concluido" ? "Reabrir estágio" : "Concluir estágio"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
