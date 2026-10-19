"use client";

import * as React from "react";
import { CheckCircle2Icon, ClipboardCheckIcon, ListChecksIcon } from "lucide-react";

import { registrarFichaAction, type ResumoFicha } from "./acoes";
import { FormularioDocumento } from "@/components/documentos/formulario-documento";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { conceitoGlobalDasNotas } from "@/lib/domain/avaliacao";
import { rotuloSituacaoDocumento, varianteSituacaoDocumento } from "@/lib/domain/status";
import type { DescriptorDocumento } from "@/lib/templates/descriptors";

/**
 * Formulário de registro da Ficha de Frequência pela coordenação (8.12). O
 * lançamento de horas e de avaliações usa o mesmo descritor do preenchimento e
 * um novo registro substitui os valores já gravados no estágio.
 */
export function RegistroFrequencia({
  descriptor,
  estagioId,
  ficha,
  valoresIniciais,
  versaoTemplate,
}: {
  descriptor: DescriptorDocumento;
  estagioId: string;
  ficha: ResumoFicha | null;
  valoresIniciais: Record<string, unknown>;
  versaoTemplate: number | null;
}) {
  const [valores, setValores] = React.useState<Record<string, unknown>>(valoresIniciais);
  const [erros, setErros] = React.useState<Record<string, string>>({});
  const [mensagem, setMensagem] = React.useState<{
    tipo: "sucesso" | "erro";
    texto: string;
  } | null>(null);
  const [fichaAtual, setFichaAtual] = React.useState<ResumoFicha | null>(ficha);
  const [registrando, iniciar] = React.useTransition();

  function aoMudar(campoId: string, valor: unknown) {
    setValores((atual) => {
      const proximo = { ...atual, [campoId]: valor };
      if (descriptor.templateId === "tpl-ficha-frequencia" && /^criterio_\d+$/.test(campoId)) {
        const notas = Object.entries(proximo)
          .filter(([id]) => /^criterio_\d+$/.test(id))
          .map(([, nota]) => nota)
          .filter(
            (nota): nota is number =>
              typeof nota === "number" && Number.isFinite(nota) && nota >= 0 && nota <= 10,
          );
        proximo.conceitoGlobal = notas.length ? conceitoGlobalDasNotas(notas) : "";
      }
      return proximo;
    });
    setErros((atual) => {
      if (!atual[campoId]) return atual;

      const proximo = { ...atual };
      delete proximo[campoId];

      return proximo;
    });
  }

  function registrar() {
    setMensagem(null);
    setErros({});

    iniciar(async () => {
      const resultado = await registrarFichaAction(estagioId, valores);

      if (!resultado.ok) {
        setErros(
          Object.fromEntries(
            (resultado.problemas ?? []).map((problema) => [problema.campo, problema.mensagem]),
          ),
        );
        setMensagem({ tipo: "erro", texto: resultado.erro ?? "Não foi possível registrar." });
        return;
      }

      if (resultado.valores) setValores(resultado.valores);
      setFichaAtual(resultado.ficha);
      setMensagem({
        tipo: "sucesso",
        texto: "Ficha de Frequência registrada e associada ao estágio.",
      });
    });
  }

  const jaRegistrada = fichaAtual?.situacao === "registrada";

  return (
    <div className="flex flex-col gap-6">
      {jaRegistrada && fichaAtual ? (
        <Alert variant="info">
          <ClipboardCheckIcon aria-hidden="true" />
          <AlertTitle>Documento {rotuloSituacaoDocumento(fichaAtual.situacao)}</AlertTitle>
          <AlertDescription>
            A ficha deste estágio já foi registrada pela coordenação
            {fichaAtual.registradoEm
              ? ` em ${new Date(fichaAtual.registradoEm).toLocaleString("pt-BR")}`
              : ""}
            ; um novo registro substitui os valores lançados.
          </AlertDescription>
        </Alert>
      ) : null}

      {mensagem ? (
        <Alert variant={mensagem.tipo === "sucesso" ? "success" : "destructive"}>
          {mensagem.tipo === "sucesso" ? (
            <CheckCircle2Icon aria-hidden="true" />
          ) : (
            <ListChecksIcon aria-hidden="true" />
          )}
          <AlertTitle>{mensagem.tipo === "sucesso" ? "Tudo certo" : "Corrija a ficha"}</AlertTitle>
          <AlertDescription>{mensagem.texto}</AlertDescription>
        </Alert>
      ) : null}

      {fichaAtual ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={varianteSituacaoDocumento(fichaAtual.situacao)}>
            {rotuloSituacaoDocumento(fichaAtual.situacao)}
          </Badge>
          {versaoTemplate ? (
            <span className="text-muted-foreground text-xs">Versão {versaoTemplate}</span>
          ) : null}
        </div>
      ) : null}

      <FormularioDocumento
        descriptor={descriptor}
        valores={valores}
        aoMudar={aoMudar}
        erros={erros}
      />

      <div className="sem-impressao flex flex-wrap items-center gap-2">
        <Button type="button" onClick={registrar} disabled={registrando}>
          <ClipboardCheckIcon aria-hidden="true" className="size-4" />
          {registrando ? "Registrando…" : "Registrar ficha assinada"}
        </Button>
      </div>
    </div>
  );
}
