"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2Icon, DownloadIcon, ListChecksIcon, SaveIcon } from "lucide-react";

import {
  salvarDocumentoAction,
  baixarDocumentoAction,
  submeterDocumentoAction,
} from "@/app/(catalogo)/documentos/acoes";
import { FormularioDocumento } from "@/components/documentos/formulario-documento";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DocumentoPreenchido, SituacaoDocumento } from "@/lib/domain/types";
import { conceitoGlobalDasNotas } from "@/lib/domain/avaliacao";
import { rotuloSituacaoDocumento, varianteSituacaoDocumento } from "@/lib/domain/status";
import { descritorPorTemplate, type DescriptorDocumento } from "@/lib/templates/descriptors";

interface DocumentoResumo {
  id: string;
  templateId: string;
  situacao: SituacaoDocumento;
}

export function ConteudoDocumento({
  descriptor,
  documento,
  preenchidos,
  estagioId,
  consultaApenas = false,
}: {
  descriptor: DescriptorDocumento;
  documento: DocumentoPreenchido;
  preenchidos: DocumentoResumo[];
  estagioId?: string;
  consultaApenas?: boolean;
}) {
  const [valores, setValores] = React.useState<Record<string, unknown>>(documento.valores);
  const [erros, setErros] = React.useState<Record<string, string>>({});
  const [mensagem, setMensagem] = React.useState<{
    tipo: "sucesso" | "erro";
    texto: string;
  } | null>(null);
  const [salvando, iniciar] = React.useTransition();
  const [situacao, setSituacao] = React.useState(documento.situacao);
  const editavel = situacao === "rascunho" && !consultaApenas;

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

  function salvar() {
    setMensagem(null);
    setErros({});

    iniciar(async () => {
      const resultado = await salvarDocumentoAction(documento.id, valores);

      if (!resultado.ok) {
        const problemas = Object.fromEntries(
          (resultado.problemas ?? []).map((problema) => [problema.campo, problema.mensagem]),
        );

        setErros(problemas);
        setMensagem({ tipo: "erro", texto: resultado.erro ?? "Não foi possível salvar." });
        return;
      }

      if (resultado.valores) setValores(resultado.valores);
      setMensagem({ tipo: "sucesso", texto: "Rascunho salvo." });
    });
  }

  async function baixar(formato: "docx" | "pdf") {
    setMensagem(null);
    setErros({});

    const resultado = await baixarDocumentoAction(documento.id, descriptor.templateId, formato);

    if (!resultado.ok) {
      setErros(
        Object.fromEntries(
          (resultado.problemas ?? []).map((problema) => [problema.campo, problema.mensagem]),
        ),
      );
      setMensagem({ tipo: "erro", texto: resultado.erro ?? "Não foi possível gerar o documento." });
      return;
    }

    const binario = atob(resultado.base64 as string);
    const bytes = new Uint8Array(binario.length);

    for (let indice = 0; indice < binario.length; indice += 1) {
      bytes[indice] = binario.charCodeAt(indice);
    }

    const blob = new Blob([bytes], { type: resultado.tipoConteudo });
    const endereco = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = endereco;
    link.download = resultado.nomeArquivo as string;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(endereco);
  }

  function enviarParecer() {
    setMensagem(null);
    setErros({});
    iniciar(async () => {
      const resultado = await submeterDocumentoAction(documento.id, valores);
      if (!resultado.ok) {
        setErros(
          Object.fromEntries(
            (resultado.problemas ?? []).map((problema) => [problema.campo, problema.mensagem]),
          ),
        );
        setMensagem({ tipo: "erro", texto: resultado.erro ?? "Não foi possível submeter." });
        return;
      }
      if (resultado.valores) setValores(resultado.valores);
      setSituacao("submetido");
      setMensagem({ tipo: "sucesso", texto: "Documento submetido a parecer." });
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {!editavel ? (
        <Alert variant="info">
          <ListChecksIcon aria-hidden="true" />
          <AlertTitle>
            {consultaApenas
              ? "Documento apenas para consulta"
              : `Documento ${rotuloSituacaoDocumento(situacao)}`}
          </AlertTitle>
          <AlertDescription>
            {consultaApenas
              ? "O cadastro de origem está inativo; o preenchimento histórico foi preservado para consulta e download."
              : "Um documento fora de rascunho não pode mais ser editado; o conteúdo fica disponível para consulta e download."}
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
          <AlertTitle>
            {mensagem.tipo === "sucesso" ? "Tudo certo" : "Corrija o documento"}
          </AlertTitle>
          <AlertDescription>{mensagem.texto}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={varianteSituacaoDocumento(situacao)}>
          {rotuloSituacaoDocumento(situacao)}
        </Badge>
        <span className="text-muted-foreground text-xs">Versão {documento.versaoTemplate}</span>
      </div>

      <FormularioDocumento
        descriptor={descriptor}
        valores={valores}
        aoMudar={aoMudar}
        erros={erros}
        desabilitado={!editavel}
      />

      <div className="sem-impressao flex flex-wrap items-center gap-2">
        {descriptor.metadados?.tipoParecer !== "nenhum" &&
        descriptor.metadados?.papeisPreenchimento.includes("aluno") ? (
          <Button type="button" onClick={enviarParecer} disabled={!editavel || salvando}>
            Submeter a parecer
          </Button>
        ) : null}
        <Button type="button" onClick={salvar} disabled={!editavel || salvando}>
          <SaveIcon aria-hidden="true" className="size-4" />
          {salvando ? "Salvando…" : "Salvar rascunho"}
        </Button>
        <Button type="button" variant="outline" onClick={() => baixar("docx")}>
          <DownloadIcon aria-hidden="true" className="size-4" />
          Baixar docx
        </Button>
        <Button type="button" variant="outline" onClick={() => baixar("pdf")}>
          <DownloadIcon aria-hidden="true" className="size-4" />
          Baixar pdf
        </Button>
      </div>

      {estagioId && preenchidos.length > 0 ? (
        <Card className="sem-impressao">
          <CardHeader>
            <CardTitle className="text-base">Documentos preenchidos deste estágio</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {preenchidos.map((item) => {
                const doTemplate = descritorPorTemplate(item.templateId);

                return (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <Link
                      href={`/documentos/${item.templateId}?estagio=${estagioId}`}
                      className="text-primary text-sm underline-offset-4 hover:underline"
                    >
                      {doTemplate?.titulo ?? item.templateId}
                    </Link>
                    <Badge variant={varianteSituacaoDocumento(item.situacao)}>
                      {rotuloSituacaoDocumento(item.situacao)}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
