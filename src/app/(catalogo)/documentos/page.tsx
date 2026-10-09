import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon, FileTextIcon, PenLineIcon } from "lucide-react";

import { PaginaArea } from "@/components/layout/pagina-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usuarioDaRequisicao } from "@/lib/auth/sessao-servidor";
import { rotuloPapel } from "@/lib/domain/status";
import { catalogoDocumentos, type ItemCatalogo } from "@/lib/services/documentos";

export const metadata: Metadata = {
  title: "Documentos",
  description: "Catálogo dos documentos do Kit de Estágio.",
};

export default async function Page() {
  const [usuario, catalogo] = await Promise.all([usuarioDaRequisicao(), catalogoDocumentos()]);
  const papeis = usuario?.papeis ?? [];

  return (
    <PaginaArea titulo="Documentos" descricao="Catálogo dos documentos do Kit de Estágio.">
      <ul aria-label="Catálogo dos documentos do Kit de Estágio" className="grid gap-4 md:grid-cols-2">
        {catalogo.map((item) => (
          <li key={item.id}>
            <CartaoDocumento item={item} podePreencher={item.papeisPreenchimento.some((papel) => papeis.includes(papel))} />
          </li>
        ))}
      </ul>
    </PaginaArea>
  );
}

/**
 * Um documento do catálogo. A distinção entre preencher e baixar vem do
 * descritor (D5): o cartão de preenchimento aponta para o formulário e o
 * cartão de download nunca leva a um formulário.
 */
function CartaoDocumento({ item, podePreencher }: { item: ItemCatalogo; podePreencher: boolean }) {
  const preenchivel = item.tipo === "preenchivel";

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">
            <h2>{item.nome}</h2>
          </CardTitle>
          <Badge variant={preenchivel ? "info" : "outline"}>
            {preenchivel ? "Preenchível" : "Apenas download"}
          </Badge>
        </div>
        <CardDescription>{item.descricao}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {preenchivel ? (
            <>
              <PenLineIcon aria-hidden="true" className="h-3.5 w-3.5" />
              <span>Preenchimento: {item.papeisPreenchimento.map(rotuloPapel).join(", ")}</span>
            </>
          ) : (
            <>
              <DownloadIcon aria-hidden="true" className="h-3.5 w-3.5" />
              <span>Uso exclusivo para download, sem formulário de preenchimento.</span>
            </>
          )}
          {item.exigeEstagio ? (
            <>
              <span aria-hidden="true">·</span>
              <span>Requer estágio cadastrado</span>
            </>
          ) : null}
          {item.versaoVigente ? (
            <span aria-hidden="true">·</span>
          ) : null}
          {item.versaoVigente ? <span>Versão vigente: {item.versaoVigente}</span> : null}
        </p>

        {preenchivel ? (
          podePreencher ? (
            <Link
              href={`/documentos/${item.id}`}
              className="text-primary inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
            >
              <FileTextIcon aria-hidden="true" className="h-4 w-4" />
              Preencher documento
            </Link>
          ) : (
            <p className="text-muted-foreground text-sm">
              O preenchimento deste documento cabe a outro perfil.
            </p>
          )
        ) : (
          <Link
            href={`/documentos/${item.id}/baixar`}
            className="text-primary inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
          >
            <DownloadIcon aria-hidden="true" className="h-4 w-4" />
            Baixar documento
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
