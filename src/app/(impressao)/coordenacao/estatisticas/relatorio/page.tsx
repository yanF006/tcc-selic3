import type { Metadata } from "next";
import Link from "next/link";

import { BotaoSalvarPdf } from "@/app/(impressao)/coordenacao/estatisticas/relatorio/botao-salvar-pdf";
import { Button } from "@/components/ui/button";
import {
  filtrosDosParametros,
  queryString,
  type ParametrosBusca,
} from "@/features/estatisticas/filtros";
import { exigirArea } from "@/lib/auth/guard";
import { rotuloSituacaoEstagio } from "@/lib/domain/status";
import {
  pesquisarEstatisticas,
  type GrupoHoras,
  type OpcaoFiltro,
} from "@/lib/services/estatisticas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Relatório de estatísticas",
};

const ROTULOS_SITUACAO = {
  em_preparacao: "Em preparação",
  em_andamento: "Em andamento",
  concluido: "Concluído",
} as const;

function rotuloDe(opcoes: OpcaoFiltro[], valor: string | undefined): string | undefined {
  if (!valor) return undefined;

  return opcoes.find((opcao) => opcao.valor === valor)?.rotulo ?? valor;
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid-page">
      <h2 className="mb-2 border-b border-black/40 pb-1 text-sm font-semibold uppercase">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Tabela({
  colunas,
  linhas,
  vazio,
}: {
  colunas: string[];
  linhas: (string | number)[][];
  vazio: string;
}) {
  if (linhas.length === 0) return <p className="text-xs italic">{vazio}</p>;

  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          {colunas.map((coluna) => (
            <th key={coluna} className="border border-black/40 bg-black/5 px-2 py-1 text-left">
              {coluna}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha, indice) => (
          <tr key={indice} className="break-inside-avoid">
            {linha.map((celula, coluna) => (
              <td key={coluna} className="border border-black/40 px-2 py-1 align-top">
                {celula}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function linhasHoras(grupos: GrupoHoras[]): (string | number)[][] {
  return grupos.map((grupo) => [grupo.rotulo, grupo.estagios, `${grupo.horas} h`]);
}

/**
 * Relatório da coordenação com as estatísticas do recorte filtrado. A página
 * fica fora da casca com navbar para que apenas a folha vá ao PDF; o arquivo é
 * gerado pelo próprio navegador ("Salvar como PDF" no diálogo de impressão).
 */
export default async function Page({
  searchParams,
}: PageProps<"/coordenacao/estatisticas/relatorio">) {
  const usuario = await exigirArea({
    papeisExigidos: ["coordenador_estagio", "coordenador_curso"],
    destino: "/coordenacao/estatisticas",
    qualquerPapel: true,
  });
  const filtros = filtrosDosParametros((await searchParams) as ParametrosBusca);
  const pesquisa = await pesquisarEstatisticas(usuario, filtros);
  const { recorte, opcoes, itens, indicadores, totaisHoras } = pesquisa;
  const geradoEm = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  const filtrosAplicados = [
    ["Aluno", rotuloDe(opcoes.alunos, filtros.aluno)],
    ["Orientador", rotuloDe(opcoes.orientadores, filtros.orientador)],
    ["Supervisor", rotuloDe(opcoes.supervisores, filtros.supervisor)],
    ["Instituição", rotuloDe(opcoes.instituicoes, filtros.instituicao)],
    ["Curso", rotuloDe(opcoes.cursos, filtros.cursoId)],
    ["Turma", rotuloDe(opcoes.turmas, filtros.turmaId)],
    [
      "Situação",
      filtros.situacao && filtros.situacao !== "todas"
        ? ROTULOS_SITUACAO[filtros.situacao]
        : undefined,
    ],
    ["Ano", filtros.ano ? String(filtros.ano) : undefined],
    ["Semestre", filtros.semestre ? `${filtros.semestre}º` : undefined],
  ].filter((par): par is [string, string] => Boolean(par[1]));

  return (
    <main className="bg-muted/40 min-h-full p-4 print:bg-white print:p-0">
      <div className="sem-impressao mx-auto mb-4 flex w-full max-w-[210mm] flex-wrap items-center justify-end gap-2">
        <p className="text-muted-foreground mr-auto text-sm">
          No diálogo de impressão, escolha o destino “Salvar como PDF”.
        </p>
        <Button asChild variant="outline">
          <Link href={`/coordenacao/estatisticas${queryString(filtros)}`}>
            Voltar às estatísticas
          </Link>
        </Button>
        <BotaoSalvarPdf />
      </div>

      <article className="mx-auto w-full max-w-[210mm] bg-white px-[12mm] py-[12mm] text-black shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-black pb-3 text-center">
          <p className="text-xs uppercase">
            Instituto Federal do Rio de Janeiro — Campus Pinheiral
          </p>
          <h1 className="mt-1 text-lg font-bold">Relatório de Estatísticas de Estágio</h1>
          <p className="text-xs">
            {recorte.titulo} · Gerado em {geradoEm} por {usuario.nome}
          </p>
        </header>

        <Secao titulo="Filtros aplicados">
          {filtrosAplicados.length === 0 ? (
            <p className="text-xs">Nenhum filtro: todos os estágios do recorte.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-x-6 text-xs">
              {filtrosAplicados.map(([rotulo, valor]) => (
                <li key={rotulo}>
                  <strong>{rotulo}:</strong> {valor}
                </li>
              ))}
            </ul>
          )}
        </Secao>

        <Secao titulo="Resumo">
          <Tabela
            colunas={["Indicador", "Valor"]}
            vazio=""
            linhas={[
              ["Estágios no recorte", pesquisa.total],
              ["Em preparação", indicadores.situacoes.em_preparacao],
              ["Em andamento", indicadores.situacoes.em_andamento],
              ["Concluídos", indicadores.situacoes.concluido],
              ["Convênios ativos", indicadores.convenios.ativos.length],
              ["Convênios expirados", indicadores.convenios.expirados.length],
              ["Aproveitamentos deferidos", indicadores.aproveitamento.deferidos],
              ["Aproveitamentos indeferidos", indicadores.aproveitamento.indeferidos],
              ["Taxa de aproveitamento", `${indicadores.aproveitamento.taxa}%`],
              ["Pendências de parecer final", indicadores.totalPendencias],
            ]}
          />
        </Secao>

        <Secao titulo="Documentos por tipo">
          <Tabela
            colunas={["Tipo", "Em preenchimento", "Aprovados", "Indeferidos", "Total"]}
            vazio="Nenhum documento no recorte."
            linhas={indicadores.documentos.map((documento) => [
              documento.nome,
              documento.emPreenchimento,
              documento.aprovados,
              documento.indeferidos,
              documento.total,
            ])}
          />
        </Secao>

        <Secao titulo="Horas por curso">
          <Tabela
            colunas={["Curso", "Estágios", "Horas"]}
            vazio="Sem registros."
            linhas={linhasHoras(totaisHoras.porCurso)}
          />
        </Secao>
        <Secao titulo="Horas por turma">
          <Tabela
            colunas={["Turma", "Estágios", "Horas"]}
            vazio="Sem registros."
            linhas={linhasHoras(totaisHoras.porTurma)}
          />
        </Secao>
        <Secao titulo="Horas por período">
          <Tabela
            colunas={["Período", "Estágios", "Horas"]}
            vazio="Sem registros."
            linhas={linhasHoras(totaisHoras.porPeriodo)}
          />
        </Secao>
        <Secao titulo="Horas por instituição">
          <Tabela
            colunas={["Instituição", "Estágios", "Horas"]}
            vazio="Sem registros."
            linhas={linhasHoras(totaisHoras.porInstituicao)}
          />
        </Secao>
        <Secao titulo="Horas por aluno">
          <Tabela
            colunas={["Aluno", "Estágios", "Horas"]}
            vazio="Sem registros."
            linhas={linhasHoras(totaisHoras.porAluno)}
          />
        </Secao>

        <Secao titulo="Pendências de parecer final">
          <Tabela
            colunas={["Aluno", "Documentos sem parecer"]}
            vazio="Nenhuma pendência de parecer final."
            linhas={indicadores.pendencias.map((pendencia) => [
              pendencia.alunoNome,
              pendencia.documentos,
            ])}
          />
        </Secao>

        <Secao titulo="Convênios">
          <Tabela
            colunas={["Instituição", "Vigência", "Situação"]}
            vazio="Nenhum convênio no recorte."
            linhas={[
              ...indicadores.convenios.ativos.map((c) => [
                c.instituicao,
                `${c.inicioVigencia} a ${c.fimVigencia}`,
                "Ativo",
              ]),
              ...indicadores.convenios.expirados.map((c) => [
                c.instituicao,
                `${c.inicioVigencia} a ${c.fimVigencia}`,
                "Expirado",
              ]),
            ]}
          />
        </Secao>

        <Secao titulo="Estágios">
          <Tabela
            colunas={[
              "Aluno",
              "Instituição",
              "Supervisor",
              "Orientador",
              "Curso / turma",
              "Início",
              "Fim",
              "Situação",
              "Horas",
            ]}
            vazio="Nenhum estágio para os filtros informados."
            linhas={itens.map((item) => [
              item.alunoNome,
              item.instituicao,
              item.supervisorNome,
              item.orientadorNome,
              `${item.cursoNome} / ${item.turmaNome}`,
              item.estagio.dataInicio,
              item.estagio.dataFim,
              rotuloSituacaoEstagio(item.estagio.situacao),
              `${item.horas} h`,
            ])}
          />
        </Secao>
      </article>
    </main>
  );
}
