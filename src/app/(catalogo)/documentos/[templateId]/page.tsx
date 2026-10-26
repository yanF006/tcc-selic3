import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertCircleIcon, DownloadIcon, FileWarningIcon } from "lucide-react";

import { ConteudoDocumento } from "@/app/(catalogo)/documentos/[templateId]/conteudo-documento";
import { PaginaArea } from "@/components/layout/pagina-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { podeAcessarAlgum } from "@/lib/auth/permissions";
import { usuarioDaRequisicao } from "@/lib/auth/sessao-servidor";
import { rotuloPapel } from "@/lib/domain/status";
import {
  criarRascunho,
  documentoDoTemplate,
  documentoPorId,
  podeConsultarDocumento,
  descritorDoDocumento,
  documentosDoEstagio,
  templatePorId,
} from "@/lib/services/documentos";
import { descritorDaVersao } from "@/lib/services/templates";
import {
  estagioPorId,
  podeConsultarEstagio,
  estagiosDoAluno,
  listarEstagios,
} from "@/lib/services/estagios";
import { descritorPorTemplate } from "@/lib/templates/descriptors";
import { usuarioPorId } from "@/lib/services/administracao";
import { documentoInicial, estagioEncerrado, estagioLiberado } from "@/lib/domain/fluxo-estagio";
import { correcaoInicialPermitida } from "@/lib/services/estagios";
import { observacoesDoDocumento, podeAcrescentarObservacao } from "@/lib/services/observacoes";
import { ObservacoesDocumento } from "@/components/documentos/observacoes-documento";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/documentos/[templateId]">): Promise<Metadata> {
  const { templateId } = await params;
  const descriptor = descritorPorTemplate(templateId);

  return {
    title: descriptor?.titulo ?? "Documento",
    description: descriptor?.descricao,
  };
}

export default async function Page({
  params,
  searchParams,
}: PageProps<"/documentos/[templateId]">) {
  const usuario = await usuarioDaRequisicao();

  if (!usuario) redirect("/login");

  const { templateId } = await params;
  const { estagio: estagioBruto, documento: documentoBruto } = await searchParams;
  const documentoEscolhido =
    typeof documentoBruto === "string" ? await documentoPorId(documentoBruto) : null;
  if (
    documentoBruto &&
    (!documentoEscolhido ||
      documentoEscolhido.templateId !== templateId ||
      !(await podeConsultarDocumento(usuario, documentoEscolhido)))
  )
    notFound();
  if (
    documentoEscolhido &&
    typeof estagioBruto === "string" &&
    documentoEscolhido.estagioId !== estagioBruto
  )
    notFound();
  const estagioParam =
    documentoEscolhido?.estagioId ?? (typeof estagioBruto === "string" ? estagioBruto : undefined);
  const descriptor = descritorDaVersao(templateId);
  const template = await templatePorId(templateId);

  if (!descriptor || !template) notFound();

  // Documento apenas para download não abre formulário (8.3).
  if (!descriptor.preenchivel || !descriptor.metadados) {
    return (
      <PaginaArea titulo={descriptor.titulo} descricao={descriptor.descricao}>
        <Alert>
          <DownloadIcon aria-hidden="true" />
          <AlertTitle>Uso exclusivo para download</AlertTitle>
          <AlertDescription>
            Este documento não tem formulário de preenchimento.
            <Button asChild variant="link" className="px-1">
              <Link href={`/documentos/${templateId}/baixar`}>Baixar documento</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </PaginaArea>
    );
  }

  const metadados = descriptor.metadados;
  const estagioSelecionado = estagioParam ? await estagioPorId(estagioParam) : null;
  const documentoExistente =
    documentoEscolhido ??
    (estagioSelecionado && podeConsultarEstagio(usuario, estagioSelecionado)
      ? (await documentosDoEstagio(estagioSelecionado.id)).find(
          (doc) => doc.templateId === templateId && doc.situacao !== "inativo",
        )
      : !metadados.exigeEstagio
        ? await documentoDoTemplate(templateId, usuario.id)
        : undefined);

  // 8.11: só os perfis da matriz de preenchimento abrem o formulário.
  if (!podeAcessarAlgum(usuario, metadados.papeisPreenchimento) && !documentoExistente) {
    return (
      <PaginaArea titulo={descriptor.titulo} descricao={descriptor.descricao}>
        <Alert variant="destructive">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>Preenchimento de outro perfil</AlertTitle>
          <AlertDescription>
            O preenchimento deste documento cabe a:{" "}
            {metadados.papeisPreenchimento.map(rotuloPapel).join(", ")}. Você não pode abri-lo.
          </AlertDescription>
        </Alert>
      </PaginaArea>
    );
  }

  const vigente = template.versoes.find((versao) => versao.vigente);

  if ((!vigente || template.situacao !== "ativo") && !documentoExistente) {
    return (
      <PaginaArea titulo={descriptor.titulo} descricao={descriptor.descricao}>
        <Alert variant="warning">
          <FileWarningIcon aria-hidden="true" />
          <AlertTitle>
            {template.situacao !== "ativo" ? "Template inativo" : "Documento sem versão vigente"}
          </AlertTitle>
          <AlertDescription>
            O preenchimento está indisponível enquanto não houver uma versão vigente cadastrada.
            {template.tipo === "download" ? (
              <Button asChild variant="link" className="px-1">
                <Link href={`/documentos/${templateId}/baixar`}>Baixar documento</Link>
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      </PaginaArea>
    );
  }

  // 8.10: documentos vinculados exigem a seleção do estágio.
  if (metadados.exigeEstagio) {
    const estagios = usuario.papeis.includes("aluno")
      ? await estagiosDoAluno(usuario.id)
      : (await listarEstagios({ tamanho: 100 })).itens.filter((estagio) =>
          podeConsultarEstagio(usuario, estagio),
        );

    if (estagios.length === 0) {
      return (
        <PaginaArea titulo={descriptor.titulo} descricao={descriptor.descricao}>
          <Alert variant="warning">
            <AlertCircleIcon aria-hidden="true" />
            <AlertTitle>Nenhum estágio cadastrado</AlertTitle>
            <AlertDescription>
              Cadastre um estágio antes de preencher este documento.
            </AlertDescription>
          </Alert>
        </PaginaArea>
      );
    }

    if (!estagioParam) {
      return (
        <PaginaArea
          titulo={descriptor.titulo}
          descricao="Selecione o estágio a que este documento se refere."
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Selecione o estágio</CardTitle>
              <CardDescription>O documento fica vinculado ao estágio escolhido.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {estagios.map((estagio) => (
                  <li key={estagio.id}>
                    <Button
                      asChild
                      variant="outline"
                      className="h-auto w-full min-w-0 items-start justify-between gap-3 py-2.5 text-left whitespace-normal"
                    >
                      <Link href={`/documentos/${templateId}?estagio=${estagio.id}`}>
                        <span className="min-w-0 break-words">Estágio #{estagio.id.slice(-6)}</span>
                        <span className="text-muted-foreground text-xs">
                          {estagio.dataInicio} a {estagio.dataFim}
                        </span>
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </PaginaArea>
      );
    }

    const estagio = await estagioPorId(estagioParam);

    if (!estagio || !podeConsultarEstagio(usuario, estagio)) {
      return (
        <PaginaArea titulo={descriptor.titulo} descricao={descriptor.descricao}>
          <Alert variant="destructive">
            <AlertCircleIcon aria-hidden="true" />
            <AlertTitle>Estágio não encontrado</AlertTitle>
            <AlertDescription>
              <Button asChild variant="link" className="px-1">
                <Link href={`/documentos/${templateId}`}>Escolher outro estágio</Link>
              </Button>
            </AlertDescription>
          </Alert>
        </PaginaArea>
      );
    }
    if (
      !documentoEscolhido &&
      (estagioEncerrado(estagio) || (!documentoInicial(templateId) && !estagioLiberado(estagio)))
    ) {
      return (
        <PaginaArea titulo={descriptor.titulo} descricao={descriptor.descricao}>
          <Alert variant="warning">
            <AlertTitle>Documento indisponível nesta etapa</AlertTitle>
            <AlertDescription>
              O estágio aguarda liberação ou foi cancelado/excluído. Consulte o acompanhamento do
              estágio.
            </AlertDescription>
          </Alert>
        </PaginaArea>
      );
    }
  }

  const documento =
    documentoExistente ??
    (await criarRascunho(usuario, templateId, metadados.exigeEstagio ? estagioParam : undefined));

  const preenchidos = documento.estagioId ? await documentosDoEstagio(documento.estagioId) : [];
  const titular = await usuarioPorId(documento.alunoId);
  const observacoes = await observacoesDoDocumento(documento.id, usuario);
  const nomesAutores = Object.fromEntries(
    await Promise.all(
      [...new Set(observacoes.map((observacao) => observacao.autorId))].map(async (id) => [
        id,
        (await usuarioPorId(id))?.nome ?? "Coordenação",
      ]),
    ),
  );

  return (
    <PaginaArea titulo={descriptor.titulo} descricao={descriptor.descricao}>
      <ConteudoDocumento
        descriptor={descritorDoDocumento(documento) ?? descriptor}
        documento={documento}
        preenchidos={preenchidos.map((item) => ({
          id: item.id,
          templateId: item.templateId,
          situacao: item.situacao,
        }))}
        estagioId={documento.estagioId}
        consultaApenas={
          template.situacao !== "ativo" ||
          documento.situacao === "inativo" ||
          Boolean(estagioSelecionado && estagioEncerrado(estagioSelecionado)) ||
          Boolean(
            estagioSelecionado &&
            !documentoInicial(templateId) &&
            !estagioLiberado(estagioSelecionado),
          ) ||
          titular?.situacao !== "ativo" ||
          !podeAcessarAlgum(usuario, metadados.papeisPreenchimento) ||
          Boolean(
            estagioSelecionado &&
            documentoInicial(templateId) &&
            !correcaoInicialPermitida(estagioSelecionado),
          )
        }
      />
      {documento.estagioId ? (
        <div>
          <Badge variant="outline">Estágio #{documento.estagioId.slice(-6)}</Badge>
        </div>
      ) : null}
      <ObservacoesDocumento
        documentoId={documento.id}
        observacoes={observacoes}
        nomesAutores={nomesAutores}
        podeAcrescentar={podeAcrescentarObservacao(usuario, documento)}
      />
    </PaginaArea>
  );
}
