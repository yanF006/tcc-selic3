import type { Metadata } from "next";
import Link from "next/link";

import { PaginaArea } from "@/components/layout/pagina-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import { rotuloSituacaoEstagio, varianteSituacaoEstagio } from "@/lib/domain/status";
import {
  documentosDoIndicador,
  pesquisarEstatisticas,
  type FiltrosEstatisticas,
  type FiltroSituacaoEstatistica,
  type GrupoHoras,
  type OpcaoFiltro,
} from "@/lib/services/estatisticas";

export const metadata: Metadata = {
  title: "Estatísticas",
  description: "Pesquisar estágios e indicadores por curso, período e instituição.",
};

type Parametros = Record<string, string | string[] | undefined>;

function umParam(valor: string | string[] | undefined): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor.trim() : undefined;
}

function situacaoValida(valor: string | undefined): FiltroSituacaoEstatistica {
  return valor === "em_preparacao" || valor === "em_andamento" || valor === "concluido"
    ? valor
    : "todas";
}

function queryString(filtros: FiltrosEstatisticas, extras: Record<string, string> = {}): string {
  const parametros = new URLSearchParams();

  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === "" || valor === "todas") continue;
    parametros.set(chave, String(valor));
  }
  for (const [chave, valor] of Object.entries(extras)) parametros.set(chave, valor);

  const texto = parametros.toString();

  return texto ? `?${texto}` : "";
}

function Opcoes({
  id,
  rotulo,
  opcoes,
  valor,
  vazio,
}: {
  id: string;
  rotulo: string;
  opcoes: OpcaoFiltro[];
  valor: string;
  vazio?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={valor}
        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
      >
        {vazio === undefined ? null : <option value="">{vazio}</option>}
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo} ({opcao.total})
          </option>
        ))}
      </select>
    </div>
  );
}

function TabelaHoras({ titulo, grupos }: { titulo: string; grupos: GrupoHoras[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        {grupos.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sem registros para o recorte.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recorte</TableHead>
                  <TableHead>Estágios</TableHead>
                  <TableHead>Horas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupos.map((grupo) => (
                  <TableRow key={grupo.chave}>
                    <TableCell>{grupo.rotulo}</TableCell>
                    <TableCell>{grupo.estagios}</TableCell>
                    <TableCell>{grupo.horas} h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function Page({ searchParams }: PageProps<"/coordenacao/estatisticas">) {
  const usuario = await usuarioDaRequisicaoObrigatorio();
  const parametros = (await searchParams) as Parametros;
  const situacao = situacaoValida(umParam(parametros.situacao));
  const ano = Number(umParam(parametros.ano)) || undefined;
  const semestreBruto = Number(umParam(parametros.semestre));
  const semestre = semestreBruto === 1 || semestreBruto === 2 ? semestreBruto : undefined;
  const filtros: FiltrosEstatisticas = {
    aluno: umParam(parametros.aluno),
    orientador: umParam(parametros.orientador),
    supervisor: umParam(parametros.supervisor),
    instituicao: umParam(parametros.instituicao),
    cursoId: umParam(parametros.cursoId),
    turmaId: umParam(parametros.turmaId),
    situacao,
    ano,
    semestre,
  };
  const pesquisa = await pesquisarEstatisticas(usuario, filtros);
  const { recorte, opcoes, itens, indicadores, totaisHoras } = pesquisa;
  const documentoSelecionado = umParam(parametros.documentoTemplate);
  const convenioSelecionado = umParam(parametros.convenios);
  const documentosIndicador = documentoSelecionado
    ? await documentosDoIndicador(usuario, documentoSelecionado, filtros)
    : null;
  const conveniosIndicador =
    convenioSelecionado === "ativo"
      ? indicadores.convenios.ativos
      : convenioSelecionado === "expirado"
        ? indicadores.convenios.expirados
        : null;

  return (
    <PaginaArea
      titulo={recorte.titulo}
      descricao="Pesquise estágios, acompanhe indicadores e abra a lista de registros de cada valor."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pesquisar estágios</CardTitle>
          <CardDescription>
            {recorte.escopo === "campus"
              ? "Recorte do campus: todos os cursos e alunos do Campus Pinheiral."
              : "Recorte do curso: apenas os alunos vinculados ao seu curso."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form key={JSON.stringify(filtros)} className="flex flex-col gap-4" method="get">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
              <Opcoes
                id="aluno"
                rotulo="Aluno"
                opcoes={opcoes.alunos}
                valor={filtros.aluno ?? ""}
                vazio="Todos os alunos"
              />
              <Opcoes
                id="orientador"
                rotulo="Orientador"
                opcoes={opcoes.orientadores}
                valor={filtros.orientador ?? ""}
                vazio="Todos os orientadores"
              />
              <Opcoes
                id="supervisor"
                rotulo="Supervisor"
                opcoes={opcoes.supervisores}
                valor={filtros.supervisor ?? ""}
                vazio="Todos os supervisores"
              />
              <Opcoes
                id="instituicao"
                rotulo="Instituição"
                opcoes={opcoes.instituicoes}
                valor={filtros.instituicao ?? ""}
                vazio="Todas as instituições"
              />
              <div className="flex flex-col gap-2">
                <label htmlFor="situacao" className="text-sm font-medium">
                  Situação
                </label>
                <select
                  id="situacao"
                  name="situacao"
                  defaultValue={filtros.situacao ?? "todas"}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="todas">Todas as situações</option>
                  <option value="em_preparacao">Em preparação</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="concluido">Concluído</option>
                </select>
              </div>
              <Opcoes
                id="cursoId"
                rotulo="Curso"
                opcoes={opcoes.cursos}
                valor={filtros.cursoId ?? ""}
                vazio="Todos os cursos"
              />
              <Opcoes
                id="turmaId"
                rotulo="Turma"
                opcoes={opcoes.turmas}
                valor={filtros.turmaId ?? ""}
                vazio="Todas as turmas"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label htmlFor="ano" className="text-sm font-medium">
                    Ano
                  </label>
                  <select
                    id="ano"
                    name="ano"
                    defaultValue={filtros.ano ? String(filtros.ano) : ""}
                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="">Todos</option>
                    {opcoes.anos.map((valor) => (
                      <option key={valor} value={valor}>
                        {valor}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="semestre" className="text-sm font-medium">
                    Semestre
                  </label>
                  <select
                    id="semestre"
                    name="semestre"
                    defaultValue={filtros.semestre ? String(filtros.semestre) : ""}
                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="">Todos</option>
                    <option value="1">1º</option>
                    <option value="2">2º</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Aplicar filtros</Button>
              <Button asChild variant="ghost">
                <Link href="/coordenacao/estatisticas">Limpar filtros</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-sm" data-testid="total-estatisticas">
        Total de resultados: {pesquisa.total}
      </p>

      {itens.length === 0 ? (
        <Alert>
          <AlertTitle>Nenhum estágio encontrado</AlertTitle>
          <AlertDescription>
            Não há estágios para os filtros informados. Ajuste os filtros para consultar outro
            recorte.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <Table aria-label="Estágios da pesquisa">
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Instituição</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Orientador</TableHead>
                <TableHead>Curso / turma</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Horas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item) => (
                <TableRow key={item.estagio.id} data-estagio={item.estagio.id}>
                  <TableCell>{item.alunoNome}</TableCell>
                  <TableCell>{item.instituicao}</TableCell>
                  <TableCell>{item.supervisorNome}</TableCell>
                  <TableCell>{item.orientadorNome}</TableCell>
                  <TableCell>
                    {item.cursoNome} / {item.turmaNome}
                  </TableCell>
                  <TableCell data-coluna="inicio">{item.estagio.dataInicio}</TableCell>
                  <TableCell>{item.estagio.dataFim}</TableCell>
                  <TableCell>
                    <Badge variant={varianteSituacaoEstagio(item.estagio.situacao)}>
                      {rotuloSituacaoEstagio(item.estagio.situacao)}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.horas} h</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <section
        className="grid gap-4 sm:grid-cols-3 [&>*]:min-w-0"
        aria-label="Estágios por situação"
      >
        {(
          [
            ["em_preparacao", "Em preparação"],
            ["em_andamento", "Em andamento"],
            ["concluido", "Concluídos"],
          ] as const
        ).map(([chave, rotulo]) => (
          <Card key={chave}>
            <CardHeader>
              <CardDescription>{rotulo}</CardDescription>
              <CardTitle className="text-3xl">
                <Link
                  className="underline-offset-4 hover:underline"
                  href={`/coordenacao/estatisticas${queryString(filtros, { situacao: chave })}`}
                >
                  {indicadores.situacoes[chave]}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              {chave === "em_preparacao"
                ? "Solicitações ainda não liberadas; não entram nos totais de andamento e conclusão."
                : "Estágios liberados nesta situação."}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0" aria-label="Convênios">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Convênios ativos</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <span className="text-3xl font-semibold">
              <Link
                className="underline-offset-4 hover:underline"
                href={`/coordenacao/estatisticas${queryString(filtros, { convenios: "ativo" })}`}
              >
                {indicadores.convenios.ativos.length}
              </Link>
            </span>
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/coordenacao/estatisticas${queryString(filtros, { convenios: "ativo" })}`}
              >
                Abrir lista
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Convênios expirados</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <span className="text-3xl font-semibold">
              <Link
                className="underline-offset-4 hover:underline"
                href={`/coordenacao/estatisticas${queryString(filtros, { convenios: "expirado" })}`}
              >
                {indicadores.convenios.expirados.length}
              </Link>
            </span>
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/coordenacao/estatisticas${queryString(filtros, { convenios: "expirado" })}`}
              >
                Abrir lista
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {conveniosIndicador ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Convênios {convenioSelecionado === "ativo" ? "ativos" : "expirados"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {conveniosIndicador.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum convênio neste recorte.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table aria-label="Convênios do indicador">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instituição</TableHead>
                      <TableHead>Vigência</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conveniosIndicador.map((convenio) => (
                      <TableRow key={convenio.id}>
                        <TableCell>{convenio.instituicao}</TableCell>
                        <TableCell>
                          {convenio.inicioVigencia} a {convenio.fimVigencia}
                        </TableCell>
                        <TableCell>{convenio.situacao === "ativo" ? "Ativo" : "Inativo"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentos gerados por tipo</CardTitle>
          <CardDescription>
            Documentos em preenchimento, aprovados e indeferidos no recorte filtrado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {indicadores.documentos.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum documento no recorte.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table aria-label="Documentos por tipo">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo de documento</TableHead>
                    <TableHead>Em preenchimento</TableHead>
                    <TableHead>Aprovados</TableHead>
                    <TableHead>Indeferidos</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {indicadores.documentos.map((documento) => (
                    <TableRow key={documento.templateId}>
                      <TableCell>
                        <Link
                          className="text-primary underline-offset-4 hover:underline"
                          href={`/coordenacao/estatisticas${queryString(filtros, {
                            documentoTemplate: documento.templateId,
                          })}`}
                        >
                          {documento.nome}
                        </Link>
                      </TableCell>
                      <TableCell>{documento.emPreenchimento}</TableCell>
                      <TableCell>{documento.aprovados}</TableCell>
                      <TableCell>{documento.indeferidos}</TableCell>
                      <TableCell>{documento.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {documentosIndicador ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documentos do tipo selecionado</CardTitle>
          </CardHeader>
          <CardContent>
            {documentosIndicador.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum documento neste recorte.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table aria-label="Documentos do indicador">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Atualizado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentosIndicador.map((item) => (
                      <TableRow key={item.documento.id}>
                        <TableCell>{item.alunoNome}</TableCell>
                        <TableCell>{item.documento.situacao}</TableCell>
                        <TableCell>{item.documento.atualizadoEm.slice(0, 10)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aproveitamento de horas</CardTitle>
            <CardDescription>
              Requerimentos deferidos e indeferidos no recorte filtrado.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-muted-foreground text-sm">Deferidos</p>
              <p className="text-2xl font-semibold" data-testid="deferidos">
                {indicadores.aproveitamento.deferidos}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Indeferidos</p>
              <p className="text-2xl font-semibold" data-testid="indeferidos">
                {indicadores.aproveitamento.indeferidos}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Taxa de aproveitamento</p>
              <p className="text-2xl font-semibold" data-testid="taxa-aproveitamento">
                {indicadores.aproveitamento.taxa}%
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pendências de parecer final</CardTitle>
            <CardDescription>
              Estágios concluídos com documentos ainda sem parecer registrado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {indicadores.pendencias.length === 0 ? (
              <p className="text-muted-foreground text-sm" data-testid="pendencias">
                Nenhuma pendência de parecer final.
              </p>
            ) : (
              <>
                <p className="text-sm" data-testid="pendencias">
                  {indicadores.totalPendencias} pendência(s) em {indicadores.pendencias.length}{" "}
                  estágio(s).
                </p>
                <ul className="mt-3 flex flex-col gap-2 text-sm">
                  {indicadores.pendencias.map((pendencia) => (
                    <li key={pendencia.estagioId}>
                      <Link
                        className="text-primary underline-offset-4 hover:underline"
                        href={`/coordenacao/estagios?estagio=${pendencia.estagioId}`}
                      >
                        {pendencia.alunoNome}
                      </Link>{" "}
                      — {pendencia.documentos} documento(s)
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0" aria-label="Totais de horas">
        <TabelaHoras titulo="Horas por aluno" grupos={totaisHoras.porAluno} />
        <TabelaHoras titulo="Horas por curso" grupos={totaisHoras.porCurso} />
        <TabelaHoras titulo="Horas por turma" grupos={totaisHoras.porTurma} />
        <TabelaHoras titulo="Horas por período" grupos={totaisHoras.porPeriodo} />
        <TabelaHoras titulo="Horas por instituição" grupos={totaisHoras.porInstituicao} />
      </section>
    </PaginaArea>
  );
}
