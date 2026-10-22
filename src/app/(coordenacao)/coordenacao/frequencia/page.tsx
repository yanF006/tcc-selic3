import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertCircleIcon, FileWarningIcon } from "lucide-react";

import { RegistroFrequencia } from "./registro-frequencia";
import { PaginaArea } from "@/components/layout/pagina-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { podeAcessarAlgum } from "@/lib/auth/permissions";
import { usuarioDaRequisicao } from "@/lib/auth/sessao-servidor";
import {
  rotuloPapel,
  rotuloSituacaoDocumento,
  varianteSituacaoDocumento,
} from "@/lib/domain/status";
import { usuarioPorId } from "@/lib/services/administracao";
import { convenioPorId } from "@/lib/services/catalogo";
import { templatePorId } from "@/lib/services/documentos";
import { ErroDeRegra } from "@/lib/services/erros";
import { listarEstagios, podeConsultarEstagio } from "@/lib/services/estagios";
import {
  fichaDoEstagio,
  iniciarRegistroFicha,
  TEMPLATE_FICHA_FREQUENCIA,
  type PreparacaoRegistro,
} from "@/lib/services/frequencia";
import { descritorPorTemplate } from "@/lib/templates/descriptors";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Frequência e avaliação",
  description: "Registrar e conferir a Ficha de Frequência e Avaliação.",
};

const TITULO = "Frequência e avaliação";
const DESCRICAO = "Registre a Ficha de Frequência recebida já assinada pela concedente.";

export default async function Page({ searchParams }: PageProps<"/coordenacao/frequencia">) {
  const usuario = await usuarioDaRequisicao();

  if (!usuario) redirect("/login");

  const { estagio: estagioBruto } = await searchParams;
  const estagioParam = typeof estagioBruto === "string" ? estagioBruto : undefined;
  const descriptor = descritorPorTemplate(TEMPLATE_FICHA_FREQUENCIA);
  const template = await templatePorId(TEMPLATE_FICHA_FREQUENCIA);

  if (!descriptor || !template) notFound();

  const papeisPreenchimento = descriptor.metadados?.papeisPreenchimento ?? [];

  // Só os perfis da matriz de preenchimento registram a ficha (8.11/8.12).
  if (!podeAcessarAlgum(usuario, papeisPreenchimento)) {
    return (
      <PaginaArea titulo={TITULO} descricao={DESCRICAO}>
        <Alert variant="destructive">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>Registro de outro perfil</AlertTitle>
          <AlertDescription>
            O registro desta ficha cabe a: {papeisPreenchimento.map(rotuloPapel).join(", ")}. Você
            não pode abri-lo.
          </AlertDescription>
        </Alert>
      </PaginaArea>
    );
  }

  const vigente = template.versoes.find((versao) => versao.vigente);

  if (!vigente) {
    return (
      <PaginaArea titulo={TITULO} descricao={DESCRICAO}>
        <Alert variant="warning">
          <FileWarningIcon aria-hidden="true" />
          <AlertTitle>Ficha sem versão vigente</AlertTitle>
          <AlertDescription>
            O registro fica indisponível enquanto não houver uma versão vigente cadastrada.
          </AlertDescription>
        </Alert>
      </PaginaArea>
    );
  }

  const estagios = (await listarEstagios({ tamanho: 100 })).itens.filter((estagio) =>
    podeConsultarEstagio(usuario, estagio),
  );

  if (estagios.length === 0) {
    return (
      <PaginaArea titulo={TITULO} descricao={DESCRICAO}>
        <Alert variant="warning">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>Nenhum estágio cadastrado</AlertTitle>
          <AlertDescription>
            Cadastre um estágio antes de registrar a Ficha de Frequência.
          </AlertDescription>
        </Alert>
      </PaginaArea>
    );
  }

  if (!estagioParam) {
    const linhas = await Promise.all(
      estagios.map(async (estagio) => ({
        estagio,
        aluno: await usuarioPorId(estagio.alunoId),
        convenio: await convenioPorId(estagio.convenioId),
        ficha: await fichaDoEstagio(estagio.id),
      })),
    );

    return (
      <PaginaArea titulo={TITULO} descricao={DESCRICAO}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Selecione o estágio</CardTitle>
            <CardDescription>A ficha fica registrada no estágio escolhido.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {linhas.map(({ estagio, aluno, convenio, ficha }) => (
                <li key={estagio.id}>
                  <Button
                    asChild
                    variant="outline"
                    className="h-auto w-full min-w-0 items-start justify-between gap-3 py-2.5 text-left whitespace-normal"
                  >
                    <Link href={`/coordenacao/frequencia?estagio=${estagio.id}`}>
                      <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                        <span className="break-words">
                          {aluno?.nome ?? `Estágio #${estagio.id.slice(-6)}`}
                          {convenio ? ` — ${convenio.instituicao}` : ""}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {estagio.dataInicio} a {estagio.dataFim}
                        </span>
                      </span>
                      {ficha ? (
                        <Badge variant={varianteSituacaoDocumento(ficha.situacao)}>
                          {rotuloSituacaoDocumento(ficha.situacao)}
                        </Badge>
                      ) : null}
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

  const estagio = estagios.find((registro) => registro.id === estagioParam);

  if (!estagio) {
    return (
      <PaginaArea titulo={TITULO} descricao={DESCRICAO}>
        <Alert variant="destructive">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>Estágio não encontrado</AlertTitle>
          <AlertDescription>
            <Button asChild variant="link" className="px-1">
              <Link href="/coordenacao/frequencia">Escolher outro estágio</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </PaginaArea>
    );
  }

  const aluno = await usuarioPorId(estagio.alunoId);
  const convenio = await convenioPorId(estagio.convenioId);

  let preparacao: PreparacaoRegistro | null = null;
  let erroRegistro: ErroDeRegra | null = null;

  try {
    preparacao = await iniciarRegistroFicha(usuario, estagio.id);
  } catch (erro) {
    if (!(erro instanceof ErroDeRegra)) throw erro;
    erroRegistro = erro;
  }

  if (!preparacao) {
    return (
      <PaginaArea titulo={TITULO} descricao={DESCRICAO}>
        <Alert variant="destructive">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>Registro indisponível</AlertTitle>
          <AlertDescription>
            {erroRegistro?.message ?? "A ficha não pode ser aberta agora."}
            <Button asChild variant="link" className="px-1">
              <Link href="/coordenacao/frequencia">Escolher outro estágio</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </PaginaArea>
    );
  }

  const ficha = preparacao.ficha;

  return (
    <PaginaArea titulo={TITULO} descricao={DESCRICAO}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Estágio #{estagio.id.slice(-6)}</Badge>
        <span className="text-muted-foreground min-w-0 text-sm break-words">
          {[aluno?.nome, convenio?.instituicao].filter(Boolean).join(" — ")}
        </span>
      </div>
      <RegistroFrequencia
        descriptor={descriptor}
        estagioId={estagio.id}
        ficha={
          ficha
            ? { id: ficha.id, situacao: ficha.situacao, registradoEm: ficha.registradoEm }
            : null
        }
        valoresIniciais={preparacao.valores}
        versaoTemplate={vigente.versao}
      />
    </PaginaArea>
  );
}
