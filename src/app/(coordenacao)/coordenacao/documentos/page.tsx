import type { Metadata } from "next";

import { PaginaArea } from "@/components/layout/pagina-area";
import Link from "next/link";
import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import {
  documentosDaCoordenacao,
  documentosParaParecer,
  templatePorId,
} from "@/lib/services/documentos";
import { estagioPorId } from "@/lib/services/estagios";
import { usuarioPorId } from "@/lib/services/administracao";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ParecerDocumento } from "@/components/documentos/parecer-documento";
import {
  rotuloSituacaoDocumento,
  varianteSituacaoDocumento,
  ROTULOS_TODAS_SITUACOES,
} from "@/lib/domain/status";
import type { SituacaoDocumento } from "@/lib/domain/types";

export const metadata: Metadata = {
  title: "Documentos do curso",
  description: "Filtrar a fila de documentos por curso e situação.",
};

export default async function Page({ searchParams }: PageProps<"/coordenacao/documentos">) {
  const usuario = await usuarioDaRequisicaoObrigatorio();
  const params = await searchParams;
  const busca = typeof params.busca === "string" ? params.busca : "";
  const situacao =
    typeof params.situacao === "string" &&
    ROTULOS_TODAS_SITUACOES.documento.includes(params.situacao as SituacaoDocumento)
      ? (params.situacao as SituacaoDocumento)
      : undefined;
  const [consulta, curso, comissao] = await Promise.all([
    documentosDaCoordenacao(usuario, { busca, situacao, tamanho: 1000 }),
    documentosParaParecer("coordenador_curso", usuario, { tamanho: 1000 }),
    documentosParaParecer("comissao_estagio", usuario, { tamanho: 1000 }),
  ]);
  const pendentes = new Set([...curso.itens, ...comissao.itens].map((doc) => doc.id));
  const apenasPendentes = params.visao !== "todos";
  const documentos = apenasPendentes
    ? consulta.itens.filter((doc) => pendentes.has(doc.id))
    : consulta.itens;
  const linhas = await Promise.all(
    documentos.map(async (documento) => ({
      documento,
      aluno: await usuarioPorId(documento.alunoId),
      template: await templatePorId(documento.templateId),
      estagio: documento.estagioId ? await estagioPorId(documento.estagioId) : null,
    })),
  );
  return (
    <PaginaArea
      titulo="Documentos do curso"
      descricao="Filtrar a fila de documentos por curso e situação."
    >
      <p className="text-muted-foreground text-sm">
        Pareceres pendentes: {pendentes.size}.{" "}
        {usuario.papeis.includes("coordenador_estagio")
          ? "Documentos do campus."
          : "Documentos dos alunos do seu curso."}
      </p>
      <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="busca-documentos">Buscar documentos</Label>
          <Input
            id="busca-documentos"
            name="busca"
            defaultValue={busca}
            placeholder="Aluno, orientador, supervisor ou instituição"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="visao-documentos">Visualização</Label>
          <select
            className="bg-background rounded border p-2"
            id="visao-documentos"
            name="visao"
            defaultValue={apenasPendentes ? "pendentes" : "todos"}
          >
            <option value="pendentes">Pareceres pendentes</option>
            <option value="todos">Todos os documentos</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="situacao-documentos">Situação do documento</Label>
          <select
            className="bg-background rounded border p-2"
            id="situacao-documentos"
            name="situacao"
            defaultValue={situacao ?? ""}
          >
            <option value="">Todas</option>
            {ROTULOS_TODAS_SITUACOES.documento.map((valor) => (
              <option key={valor} value={valor}>
                {rotuloSituacaoDocumento(valor)}
              </option>
            ))}
          </select>
        </div>
        <Button className="self-end" type="submit">
          Pesquisar
        </Button>
      </form>
      <p>Total de resultados: {linhas.length}</p>
      {linhas.length === 0 && (
        <p className="text-muted-foreground">Nenhum documento corresponde aos filtros aplicados.</p>
      )}
      {linhas.map(({ documento, aluno, template, estagio }) => (
        <Card key={documento.id} data-testid={`documento-${documento.id}`}>
          <CardHeader>
            <CardTitle className="text-base">{template?.nome ?? documento.templateId}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p>
              {estagio ? "Aluno" : "Responsável"}:{" "}
              {estagio?.excluidoEm
                ? estagio.nomeAlunoHistorico
                : (aluno?.nome ?? "Cadastro excluído")}
            </p>
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href={`/documentos/${documento.templateId}?documento=${documento.id}`}
            >
              Consultar preenchimento
            </Link>
            <Badge variant={varianteSituacaoDocumento(documento.situacao)}>
              {rotuloSituacaoDocumento(documento.situacao)}
            </Badge>
            {template?.metadados?.tipoParecer === "comissao_estagio" && (
              <p>Total de horas solicitado: {String(documento.valores.cargaHorariaTotal ?? 0)} h</p>
            )}
            {estagio && (
              <Link
                className="text-primary underline-offset-4 hover:underline"
                href={`/coordenacao/estagios?estagio=${estagio.id}`}
              >
                Consultar estágio e documentos
              </Link>
            )}
            {pendentes.has(documento.id) && <ParecerDocumento documentoId={documento.id} />}
          </CardContent>
        </Card>
      ))}
    </PaginaArea>
  );
}
