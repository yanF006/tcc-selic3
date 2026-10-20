import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertCircleIcon } from "lucide-react";

import { BotaoImprimir } from "@/app/(impressao)/documentos/[templateId]/imprimir/botao-imprimir";
import { DocumentoImpressao } from "@/components/documentos/documento-impressao";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PaginaArea } from "@/components/layout/pagina-area";
import { usuarioDaRequisicao } from "@/lib/auth/sessao-servidor";
import {
  documentoPorId,
  podeConsultarDocumento,
  templatePorId,
} from "@/lib/services/documentos";
import { descritorPorTemplate } from "@/lib/templates/descriptors";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/documentos/[templateId]/imprimir">): Promise<Metadata> {
  const { templateId } = await params;
  const descriptor = descritorPorTemplate(templateId);

  return {
    title: descriptor ? `Imprimir — ${descriptor.titulo}` : "Impressão de documento",
  };
}

/**
 * Página de impressão do documento preenchido (8.13). Abre a folha já isolada
 * em tokens de impressão (2.5) e oferece apenas o botão de imprimir; na
 * impressão, a folha sai sozinha, sem a interface ao redor.
 */
export default async function Page({
  params,
  searchParams,
}: PageProps<"/documentos/[templateId]/imprimir">) {
  const usuario = await usuarioDaRequisicao();

  if (!usuario) redirect("/login");

  const { templateId } = await params;
  const { documento: documentoBruto } = await searchParams;
  const documentoId = typeof documentoBruto === "string" ? documentoBruto : undefined;
  const descriptor = descritorPorTemplate(templateId);
  const template = await templatePorId(templateId);

  if (!descriptor || !template) notFound();

  if (!documentoId) {
    return (
      <PaginaArea titulo={descriptor.titulo} descricao="Impressão do documento preenchido.">
        <Alert variant="warning">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>Documento não indicado</AlertTitle>
          <AlertDescription>
            Abra a impressão a partir do preenchimento do documento.
            <Button asChild variant="link" className="px-1">
              <Link href={`/documentos/${templateId}`}>Voltar ao documento</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </PaginaArea>
    );
  }

  const documento = await documentoPorId(documentoId);

  if (!documento || documento.templateId !== templateId) notFound();

  if (!(await podeConsultarDocumento(usuario, documento))) {
    return (
      <PaginaArea titulo={descriptor.titulo} descricao="Impressão do documento preenchido.">
        <Alert variant="destructive">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>Documento indisponível</AlertTitle>
          <AlertDescription>Você não pode imprimir este documento.</AlertDescription>
        </Alert>
      </PaginaArea>
    );
  }

  return (
    <main className="bg-muted/40 min-h-full p-4 print:bg-white print:p-0">
      <div className="sem-impressao mx-auto mb-4 flex w-full max-w-[210mm] justify-end gap-2">
        <Button asChild variant="outline">
          <Link href={`/documentos/${templateId}${documento.estagioId ? `?estagio=${documento.estagioId}` : ""}`}>
            Voltar ao documento
          </Link>
        </Button>
        <BotaoImprimir />
      </div>

      <DocumentoImpressao descriptor={descriptor} valores={documento.valores} />
    </main>
  );
}
