"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PlusIcon, SearchIcon, AlertCircleIcon, ClockIcon } from "lucide-react";

import {
  criarEstagioAction,
  editarEstagioAction,
  solicitarExclusaoEstagioAction,
  selecionarDocumentosAction,
  removerDocumentoEstagioAction,
  lancarHorasAction,
  corrigirLancamentoAction,
} from "./acoes";
import type {
  Convenio,
  DocumentoPreenchido,
  Estagio,
  LancamentoHoras,
  Pessoa,
  TemplateDocumento,
} from "@/lib/domain/types";
import {
  rotuloSituacaoDocumento,
  varianteSituacaoDocumento,
  rotuloSituacaoEstagio,
  varianteSituacaoEstagio,
} from "@/lib/domain/status";
import { LIMITE_HORAS_DIA, calcularHorasDia } from "@/lib/domain/schemas";
import { formatarData, formatarHoras } from "@/lib/format";
import {
  DOCUMENTOS_INICIAIS,
  documentoInicial,
  estagioEncerrado,
  estagioLiberado,
} from "@/lib/domain/fluxo-estagio";
import { PainelFluxo, type DadosPainelFluxo } from "@/components/estagios/painel-fluxo";
import { FormularioDocumento } from "@/components/documentos/formulario-documento";
import { descritorPorTemplate, type DescriptorDocumento } from "@/lib/templates/descriptors";
import { encerrarRegistroAction } from "./acoes";

export function ConteudoEstagios({
  estagioInicialId,
  estagiosIniciais,
  convenios,
  orientadores,
  supervisores,
  templates,
  resumosHoras,
  documentos,
  rotaBase = "/estagio",
  gestao = false,
  nomesUsuarios = {},
  exclusoesPendentes = [],
  dadosFluxo,
  valoresIniciaisDocumentos = {},
  descritoresIniciais = {},
}: {
  estagioInicialId?: string;
  estagiosIniciais: Estagio[];
  convenios: Convenio[];
  orientadores: Pessoa[];
  supervisores: Pessoa[];
  templates: TemplateDocumento[];
  resumosHoras: Record<string, { total: number; lancamentos: LancamentoHoras[] }>;
  documentos: (DocumentoPreenchido & { descritor?: DescriptorDocumento })[];
  rotaBase?: string;
  gestao?: boolean;
  nomesUsuarios?: Record<string, string>;
  exclusoesPendentes?: string[];
  dadosFluxo: DadosPainelFluxo;
  valoresIniciaisDocumentos?: Record<string, Record<string, unknown>>;
  descritoresIniciais?: Record<string, DescriptorDocumento | undefined>;
}) {
  const router = useRouter();
  const estagios = estagiosIniciais;
  const [busca, setBusca] = React.useState("");
  const [filtroSituacao, setFiltroSituacao] = React.useState<string>("todos");
  const [estagioSelecionadoId, setEstagioSelecionadoId] = React.useState<string | null>(
    estagioInicialId ?? null,
  );
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const [selecionandoDocs, setSelecionandoDocs] = React.useState(false);
  const [exclusaoPendente, setExclusaoPendente] = React.useState(false);
  const [valoresDocumentos, setValoresDocumentos] = React.useState(valoresIniciaisDocumentos);
  const [documentoAtivo, setDocumentoAtivo] = React.useState<string>(DOCUMENTOS_INICIAIS[0]);
  const [cargaHorariaPrevista, setCargaHorariaPrevista] = React.useState("");
  const [criando, setCriando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [errosCadastro, setErrosCadastro] = React.useState<Record<string, string>>({});
  const [sucesso, setSucesso] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();

  // Formulário de novo estágio
  const conveniosAtivos = convenios.filter((c) => c.situacao === "ativo");
  const [convenioId, setConvenioId] = React.useState("");
  const [supervisorId, setSupervisorId] = React.useState("");
  const [orientadorId, setOrientadorId] = React.useState("");
  const [dataInicio, setDataInicio] = React.useState("");
  const [dataFim, setDataFim] = React.useState("");
  const [documentosSelecionados, setDocumentosSelecionados] = React.useState<string[]>([]);
  const [novaData, setNovaData] = React.useState("");
  const [novaEntrada, setNovaEntrada] = React.useState("");
  const [novaSaida, setNovaSaida] = React.useState("");
  const [novoAlmocoDesligado, setNovoAlmocoDesligado] = React.useState(false);
  const [erroLancamento, setErroLancamento] = React.useState<string | null>(null);
  const [corrigindoId, setCorrigindoId] = React.useState<string | null>(null);
  const [correcaoEntrada, setCorrecaoEntrada] = React.useState("");
  const [correcaoSaida, setCorrecaoSaida] = React.useState("");
  const [correcaoAlmocoDesligado, setCorrecaoAlmocoDesligado] = React.useState(false);
  const [erroCorrecao, setErroCorrecao] = React.useState<string | null>(null);

  const estagioAtual = estagios.find((e) => e.id === estagioSelecionadoId);

  const estagiosFiltrados = estagios.filter((e) => {
    const termos = [
      e.id,
      convenios.find((c) => c.id === e.convenioId)?.instituicao,
      supervisores.find((p) => p.id === e.supervisorId)?.nome,
      orientadores.find((p) => p.id === e.orientadorId)?.nome,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchBusca = !busca || termos.includes(busca.toLowerCase());
    const situacaoEfetiva = e.canceladoEm ? "cancelado" : e.excluidoEm ? "excluido" : e.situacao;
    const matchSit = filtroSituacao === "todos" || situacaoEfetiva === filtroSituacao;
    return matchBusca && matchSit;
  });

  function lidarComCriacao(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setErrosCadastro({});

    iniciar(async () => {
      const dados = {
        convenioId,
        supervisorId,
        orientadorId,
        dataInicio,
        dataFim,
        cargaHorariaPrevista: Number(cargaHorariaPrevista),
        valoresDocumentos: Object.fromEntries(
          DOCUMENTOS_INICIAIS.map((id) => [
            id,
            {
              ...valoresDocumentos[id],
              dataInicioPrevista: dataInicio,
              dataFimPrevista: dataFim,
              cargaHorariaTotal: Number(cargaHorariaPrevista),
            },
          ]),
        ),
      };
      const res = editandoId
        ? await editarEstagioAction(editandoId, dados)
        : await criarEstagioAction(dados);

      if (!res.ok) {
        setErrosCadastro(res.erros ?? {});
        setErro(res.erro ?? "Erro ao cadastrar estágio.");
        return;
      }

      setCriando(false);
      const id = editandoId ?? ("estagioId" in res ? res.estagioId : undefined);
      if (typeof id === "string") setEstagioSelecionadoId(id);
      setEditandoId(null);
      router.push(id ? `${rotaBase}?estagio=${id}` : rotaBase);
    });
  }

  function toggleDocumento(templateId: string) {
    setDocumentosSelecionados((atual) =>
      atual.includes(templateId) ? atual.filter((id) => id !== templateId) : [...atual, templateId],
    );
  }

  function lidarComRemocaoDoc(templateId: string) {
    if (!estagioAtual) return;
    if (!window.confirm("Deseja realmente remover e inativar este documento preenchido?")) {
      return;
    }
    iniciar(async () => {
      const res = await removerDocumentoEstagioAction(estagioAtual.id, templateId);
      if (!res.ok) {
        setErro(res.erro ?? "Erro ao remover documento.");
        return;
      }
      setSucesso("Documento removido da seleção e inativado com sucesso.");
      router.refresh();
    });
  }

  function lidarComLancamento(e: React.FormEvent) {
    e.preventDefault();
    if (!estagioAtual) return;
    setErroLancamento(null);

    iniciar(async () => {
      const res = await lancarHorasAction({
        estagioId: estagioAtual.id,
        data: novaData,
        entrada: novaEntrada,
        saida: novaSaida,
        almocoDesligado: novoAlmocoDesligado,
      });

      if (!res.ok) {
        setErroLancamento(res.erro ?? "Não foi possível lançar as horas.");
        return;
      }

      setNovaData("");
      setNovaEntrada("");
      setNovaSaida("");
      router.refresh();
    });
  }

  function abrirCorrecao(lancamento: LancamentoHoras) {
    setCorrigindoId(lancamento.id);
    setCorrecaoEntrada(lancamento.entrada);
    setCorrecaoSaida(lancamento.saida);
    setCorrecaoAlmocoDesligado(lancamento.almocoDesligado);
    setErroCorrecao(null);
  }

  function fecharCorrecao() {
    setCorrigindoId(null);
    setErroCorrecao(null);
  }

  function lidarComCorrecao(e: React.FormEvent) {
    e.preventDefault();
    if (!corrigindoId) return;
    setErroCorrecao(null);

    iniciar(async () => {
      const res = await corrigirLancamentoAction(corrigindoId, {
        entrada: correcaoEntrada,
        saida: correcaoSaida,
        almocoDesligado: correcaoAlmocoDesligado,
      });

      if (!res.ok) {
        setErroCorrecao(res.erro ?? "Não foi possível corrigir o lançamento.");
        return;
      }

      setCorrigindoId(null);
      router.refresh();
    });
  }

  function abrirEdicao() {
    if (!estagioAtual) return;
    setEditandoId(estagioAtual.id);
    setConvenioId(estagioAtual.convenioId);
    setSupervisorId(estagioAtual.supervisorId);
    setOrientadorId(estagioAtual.orientadorId);
    setDataInicio(estagioAtual.dataInicio);
    setDataFim(estagioAtual.dataFim);
    setCargaHorariaPrevista(String(estagioAtual.cargaHorariaPrevista ?? ""));
    setValoresDocumentos(
      Object.fromEntries(
        documentos
          .filter((doc) => doc.estagioId === estagioAtual.id && documentoInicial(doc.templateId))
          .map((doc) => [doc.templateId, doc.valores]),
      ),
    );
    setCriando(true);
    setErro(null);
  }

  function salvarSelecao() {
    if (!estagioAtual) return;
    iniciar(async () => {
      const resultado = await selecionarDocumentosAction(estagioAtual.id, documentosSelecionados);
      if (!resultado.ok) {
        setErro(resultado.erro ?? "Não foi possível salvar a seleção.");
        return;
      }
      setSelecionandoDocs(false);
      router.push(`${rotaBase}?estagio=${estagioAtual.id}`);
    });
  }

  function pedirExclusao() {
    if (
      !estagioAtual ||
      !window.confirm(
        "Solicitar a exclusão deste estágio? A remoção depende da autorização de cargo superior.",
      )
    )
      return;
    iniciar(async () => {
      const resultado = await solicitarExclusaoEstagioAction(
        estagioAtual.id,
        "Solicitação do aluno pela tela de estágio.",
      );
      if (!resultado.ok) {
        setErro(resultado.erro ?? "Não foi possível solicitar a exclusão.");
        return;
      }
      setExclusaoPendente(true);
    });
  }

  if (estagiandoDetalhe(estagioAtual) && !criando) {
    return (
      <div className="flex flex-col gap-6">
        <Button variant="ghost" onClick={() => setEstagioSelecionadoId(null)} className="w-fit">
          ← Voltar para o histórico
        </Button>

        {erro ? (
          <Alert variant="destructive">
            <AlertTitle>Operação recusada</AlertTitle>
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        ) : null}
        {exclusaoPendente || exclusoesPendentes.includes(estagioAtual.id) ? (
          <Alert>
            <AlertTitle>Exclusão aguardando autorização</AlertTitle>
            <AlertDescription>
              O estágio foi preservado e a solicitação aguarda decisão de cargo superior.
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {(gestao ||
            documentos.some(
              (doc) =>
                doc.estagioId === estagioAtual.id &&
                doc.templateId === DOCUMENTOS_INICIAIS[0] &&
                (doc.situacao === "indeferido" || doc.correcaoAberta),
            )) &&
          !estagioEncerrado(estagioAtual) ? (
            <Button variant="outline" onClick={abrirEdicao}>
              Editar estágio
            </Button>
          ) : null}
          {!gestao && !estagioEncerrado(estagioAtual) && (
            <Button
              variant="destructive"
              disabled={pendente}
              onClick={() => {
                const cancelar = estagioAtual.situacao === "em_preparacao";
                if (
                  !window.confirm(
                    cancelar
                      ? "Cancelar esta solicitação? O histórico será preservado."
                      : "Excluir este estágio? O nome e o histórico serão preservados e os dados pessoais vinculados serão removidos.",
                  )
                )
                  return;
                iniciar(async () => {
                  const resultado = await encerrarRegistroAction(estagioAtual.id, cancelar);
                  if (!resultado.ok) setErro(resultado.erro ?? "Operação recusada.");
                  else router.refresh();
                });
              }}
            >
              {estagioAtual.situacao === "em_preparacao"
                ? "Cancelar solicitação"
                : "Excluir estágio"}
            </Button>
          )}
          {gestao ? (
            <Button
              variant="destructive"
              onClick={pedirExclusao}
              disabled={
                pendente || exclusaoPendente || exclusoesPendentes.includes(estagioAtual.id)
              }
            >
              Solicitar exclusão
            </Button>
          ) : null}
        </div>
        <PainelFluxo
          estagio={estagioAtual}
          documentos={documentos.filter((doc) => doc.estagioId === estagioAtual.id)}
          templates={templates}
          dados={dadosFluxo}
        />
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Detalhes do Estágio</CardTitle>
              <Badge variant={varianteSituacaoEstagio(estagioAtual.situacao)}>
                {estagioAtual.canceladoEm
                  ? "Cancelado"
                  : estagioAtual.excluidoEm
                    ? "Excluído"
                    : rotuloSituacaoEstagio(estagioAtual.situacao)}
              </Badge>
            </div>
            <CardDescription>
              Período: {estagioAtual.dataInicio} a {estagioAtual.dataFim}
              {estagioAtual.editadoPorId ? (
                <span className="block">
                  Última edição por {nomesUsuarios[estagioAtual.editadoPorId] ?? "aluno"} em{" "}
                  {formatarData(estagioAtual.editadoEm)}
                </span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground text-xs">Instituição</dt>
                <dd>
                  {convenios.find((c) => c.id === estagioAtual.convenioId)?.instituicao ??
                    "Instituição inativa"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Supervisor</dt>
                <dd>
                  {supervisores.find((p) => p.id === estagioAtual.supervisorId)?.nome ??
                    "Cadastro excluído"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Orientador</dt>
                <dd>
                  {orientadores.find((p) => p.id === estagioAtual.orientadorId)?.nome ??
                    "Cadastro excluído"}
                </dd>
              </div>
            </dl>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="bg-muted rounded p-4">
                <p className="text-muted-foreground text-xs font-medium">Início</p>
                <p className="text-sm font-semibold">{estagioAtual.dataInicio}</p>
              </div>
              <div className="bg-muted rounded p-4">
                <p className="text-muted-foreground text-xs font-medium">Fim</p>
                <p className="text-sm font-semibold">{estagioAtual.dataFim}</p>
              </div>
              <div className="bg-muted rounded p-4">
                <p className="text-muted-foreground text-xs font-medium">Situação</p>
                <p className="text-sm font-semibold">
                  {estagioAtual.canceladoEm
                    ? "Cancelado"
                    : estagioAtual.excluidoEm
                      ? "Excluído"
                      : rotuloSituacaoEstagio(estagioAtual.situacao)}
                </p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lançamentos de horas</CardTitle>
                <CardDescription>
                  Registre as horas por dia, dentro do período do estágio. A jornada não passa de{" "}
                  {LIMITE_HORAS_DIA} horas, excluído o intervalo de almoço, nem de 30 horas por
                  semana.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Total acumulado</p>
                  <p className="text-2xl font-semibold" data-testid="total-horas">
                    {formatarHoras(resumosHoras[estagioAtual.id]?.total ?? 0)}
                  </p>
                </div>

                {estagioLiberado(estagioAtual) && estagioAtual.situacao === "em_andamento" ? (
                  <form
                    onSubmit={lidarComLancamento}
                    className="flex flex-col gap-4 rounded border p-4"
                  >
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="novaData">Data</Label>
                        <Input
                          id="novaData"
                          type="date"
                          value={novaData}
                          onChange={(e) => setNovaData(e.target.value)}
                          aria-invalid={erroLancamento ? true : undefined}
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="novaEntrada">Entrada</Label>
                        <Input
                          id="novaEntrada"
                          type="time"
                          value={novaEntrada}
                          onChange={(e) => setNovaEntrada(e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="novaSaida">Saída</Label>
                        <Input
                          id="novaSaida"
                          type="time"
                          value={novaSaida}
                          onChange={(e) => setNovaSaida(e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex items-end">
                        <Label className="flex items-center gap-2 text-sm font-normal">
                          <Checkbox
                            checked={novoAlmocoDesligado}
                            onCheckedChange={(estado) => setNovoAlmocoDesligado(estado === true)}
                          />
                          Desligar intervalo de almoço (1 h)
                        </Label>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <Button type="submit" disabled={pendente}>
                        Lançar horas
                      </Button>
                      {novaEntrada && novaSaida ? (
                        <span className="text-muted-foreground text-sm" data-testid="previa-horas">
                          {calcularHorasDia(novaEntrada, novaSaida, novoAlmocoDesligado) > 0
                            ? `Horas a registrar: ${formatarHoras(
                                calcularHorasDia(novaEntrada, novaSaida, novoAlmocoDesligado),
                              )}`
                            : "Horário inválido."}
                        </span>
                      ) : null}
                    </div>

                    {erroLancamento ? (
                      <Alert variant="destructive">
                        <AlertCircleIcon aria-hidden="true" />
                        <AlertTitle>Lançamento recusado</AlertTitle>
                        <AlertDescription>{erroLancamento}</AlertDescription>
                      </Alert>
                    ) : null}
                  </form>
                ) : null}

                <div>
                  <h3 className="mb-3 text-sm font-semibold">Histórico de lançamentos</h3>
                  {(resumosHoras[estagioAtual.id]?.lancamentos ?? []).length === 0 ? (
                    <Alert>
                      <AlertCircleIcon aria-hidden="true" />
                      <AlertTitle>Nenhum lançamento</AlertTitle>
                      <AlertDescription>
                        {estagioAtual.situacao === "em_andamento"
                          ? "Registre o primeiro dia com o formulário acima."
                          : "Este estágio ainda não possui lançamentos de horas."}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <ul className="flex flex-col gap-2" data-testid="historico-lancamentos">
                      {(resumosHoras[estagioAtual.id]?.lancamentos ?? []).map((lancamento) => (
                        <li
                          key={lancamento.id}
                          className="flex flex-col gap-3 rounded border p-3"
                          data-testid={`lancamento-${lancamento.id}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-col gap-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium">
                                  {formatarData(lancamento.data)}
                                </span>
                                <Badge
                                  variant={lancamento.tipo === "correcao" ? "info" : "outline"}
                                  data-testid={`tipo-${lancamento.id}`}
                                >
                                  {lancamento.tipo === "correcao"
                                    ? `Correção de ${lancamento.corrigeId ?? ""}`
                                    : "Lançamento original"}
                                </Badge>
                              </div>
                              <span className="text-muted-foreground text-sm">
                                {lancamento.entrada}–{lancamento.saida} ·{" "}
                                {formatarHoras(lancamento.horas)}
                                {lancamento.almocoDesligado ? " · sem almoço" : ""}
                              </span>
                            </div>

                            {lancamento.tipo === "lancamento" &&
                            estagioLiberado(estagioAtual) &&
                            estagioAtual.situacao === "em_andamento" ? (
                              corrigindoId === lancamento.id ? (
                                <form
                                  onSubmit={lidarComCorrecao}
                                  className="flex w-full flex-col gap-3 border-t pt-3"
                                >
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="flex flex-col gap-2">
                                      <Label htmlFor={`correcaoEntrada-${lancamento.id}`}>
                                        Nova entrada
                                      </Label>
                                      <Input
                                        id={`correcaoEntrada-${lancamento.id}`}
                                        type="time"
                                        value={correcaoEntrada}
                                        onChange={(e) => setCorrecaoEntrada(e.target.value)}
                                        required
                                      />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                      <Label htmlFor={`correcaoSaida-${lancamento.id}`}>
                                        Nova saída
                                      </Label>
                                      <Input
                                        id={`correcaoSaida-${lancamento.id}`}
                                        type="time"
                                        value={correcaoSaida}
                                        onChange={(e) => setCorrecaoSaida(e.target.value)}
                                        required
                                      />
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-4">
                                    <Label
                                      htmlFor={`correcaoAlmoco-${lancamento.id}`}
                                      className="flex items-center gap-2 text-sm font-normal"
                                    >
                                      <Checkbox
                                        id={`correcaoAlmoco-${lancamento.id}`}
                                        checked={correcaoAlmocoDesligado}
                                        onCheckedChange={(estado) =>
                                          setCorrecaoAlmocoDesligado(estado === true)
                                        }
                                      />
                                      Desligar intervalo de almoço (1 h)
                                    </Label>
                                    <Button type="submit" size="sm" disabled={pendente}>
                                      Registrar correção
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={fecharCorrecao}
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                  {erroCorrecao ? (
                                    <Alert variant="destructive">
                                      <AlertCircleIcon aria-hidden="true" />
                                      <AlertTitle>Correção recusada</AlertTitle>
                                      <AlertDescription>{erroCorrecao}</AlertDescription>
                                    </Alert>
                                  ) : null}
                                </form>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => abrirCorrecao(lancamento)}
                                >
                                  Corrigir
                                </Button>
                              )
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>

            <div>
              <h3 className="mb-3 text-sm font-semibold">Documentos do Estágio (Seleção)</h3>
              {estagioLiberado(estagioAtual) && estagioAtual.situacao === "em_andamento" ? (
                <Button
                  variant="outline"
                  className="mb-3"
                  onClick={() => {
                    setDocumentosSelecionados(estagioAtual.documentosSelecionados);
                    setSelecionandoDocs(!selecionandoDocs);
                  }}
                >
                  Selecionar documentos
                </Button>
              ) : null}
              {selecionandoDocs ? (
                <div className="mb-4 flex flex-col gap-3 rounded border p-4">
                  {templates
                    .filter(
                      (t) =>
                        t.tipo === "preenchivel" &&
                        t.metadados?.papeisPreenchimento.includes("aluno"),
                    )
                    .map((t) => (
                      <div key={t.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`selecao-${t.id}`}
                          checked={documentosSelecionados.includes(t.id)}
                          disabled={
                            documentoInicial(t.id) ||
                            estagioAtual.documentosSelecionados.includes(t.id)
                          }
                          onCheckedChange={() => toggleDocumento(t.id)}
                        />
                        <Label htmlFor={`selecao-${t.id}`}>{t.nome}</Label>
                      </div>
                    ))}
                  <p className="text-muted-foreground text-xs">
                    Use Remover na lista abaixo para retirar um documento com confirmação.
                  </p>
                  <Button onClick={salvarSelecao} disabled={pendente}>
                    Salvar seleção
                  </Button>
                </div>
              ) : null}
              {estagioAtual.documentosSelecionados.length === 0 ? (
                <Alert>
                  <AlertCircleIcon aria-hidden="true" />
                  <AlertTitle>Nenhum documento selecionado</AlertTitle>
                  <AlertDescription>
                    Oriente a seleção de documentos necessários para este estágio.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="flex flex-col gap-2">
                  {estagioAtual.documentosSelecionados.map((docId) => {
                    const tmpl = templates.find((t) => t.id === docId);
                    const preenchido = documentos.find(
                      (d) =>
                        d.estagioId === estagioAtual.id &&
                        d.templateId === docId &&
                        d.situacao !== "inativo",
                    );
                    return (
                      <div
                        key={docId}
                        data-template-id={docId}
                        className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
                      >
                        <Link
                          href={`/documentos/${docId}?estagio=${estagioAtual.id}`}
                          className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                        >
                          {tmpl?.nome ?? docId}
                        </Link>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              preenchido
                                ? varianteSituacaoDocumento(preenchido.situacao)
                                : "outline"
                            }
                          >
                            {preenchido
                              ? rotuloSituacaoDocumento(preenchido.situacao)
                              : "Não preenchido"}
                          </Badge>
                          {!documentoInicial(docId) && estagioLiberado(estagioAtual) && (
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={pendente}
                              onClick={() => lidarComRemocaoDoc(docId)}
                            >
                              Remover
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        {gestao &&
        documentos.some(
          (documento) =>
            documento.estagioId === estagioAtual.id && documento.situacao === "inativo",
        ) ? (
          <Card data-testid="documentos-inativos">
            <CardHeader>
              <CardTitle>Documentos inativos preservados</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3">
                {documentos
                  .filter(
                    (documento) =>
                      documento.estagioId === estagioAtual.id && documento.situacao === "inativo",
                  )
                  .map((documento) => (
                    <li
                      key={documento.id}
                      className="flex flex-wrap items-center justify-between gap-3"
                    >
                      <span>
                        {templates.find((template) => template.id === documento.templateId)?.nome ??
                          documento.templateId}
                      </span>
                      <Badge variant={varianteSituacaoDocumento(documento.situacao)}>
                        {rotuloSituacaoDocumento(documento.situacao)}
                      </Badge>
                      <Link
                        className="text-primary text-sm underline-offset-4 hover:underline"
                        href={`/documentos/${documento.templateId}?documento=${documento.id}`}
                      >
                        Consultar documento preservado
                      </Link>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">
            {gestao ? "Gestão de estágios" : "Meus Estágios"}
          </h2>
          <p className="text-muted-foreground text-sm">Histórico e cadastro de novos estágios.</p>
        </div>
        {!gestao ? (
          <Button
            onClick={() => {
              setEditandoId(null);
              setConvenioId("");
              setSupervisorId("");
              setOrientadorId("");
              setDataInicio("");
              setDataFim("");
              setValoresDocumentos(valoresIniciaisDocumentos);
              setCargaHorariaPrevista("");
              setDocumentosSelecionados([]);
              setCriando(true);
            }}
          >
            <PlusIcon className="mr-2 h-4 w-4" /> Solicitar estágio
          </Button>
        ) : null}
      </div>

      {sucesso ? (
        <Alert>
          <AlertTitle>Sucesso</AlertTitle>
          <AlertDescription>{sucesso}</AlertDescription>
        </Alert>
      ) : null}

      {criando ? (
        <Card>
          <CardHeader>
            <CardTitle>{editandoId ? "Editar estágio" : "Novo Estágio"}</CardTitle>
            <CardDescription>
              Preencha os dados do convênio, orientador, supervisor e datas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {conveniosAtivos.length === 0 ? (
              <Alert variant="destructive" className="mb-4">
                <AlertCircleIcon aria-hidden="true" />
                <AlertTitle>Nenhum convênio ativo</AlertTitle>
                <AlertDescription>
                  Não há convênios ativos cadastrados no momento. Solicite à coordenação o cadastro
                  de um convênio.
                </AlertDescription>
              </Alert>
            ) : null}

            {erro ? (
              <Alert variant="destructive" className="mb-4">
                <AlertCircleIcon aria-hidden="true" />
                <AlertTitle>Erro ao cadastrar</AlertTitle>
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            ) : null}

            <form onSubmit={lidarComCriacao} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="convênio">Convênio</Label>
                <Select value={convenioId} onValueChange={setConvenioId} required>
                  <SelectTrigger id="convênio">
                    <SelectValue placeholder="Selecione o convênio ativo" />
                  </SelectTrigger>
                  <SelectContent>
                    {convenios
                      .filter((c) => c.situacao === "ativo" || (editandoId && c.id === convenioId))
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome} - {c.instituicao}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="orientador">Orientador</Label>
                  <Select value={orientadorId} onValueChange={setOrientadorId} required>
                    <SelectTrigger id="orientador">
                      <SelectValue placeholder="Selecione o orientador" />
                    </SelectTrigger>
                    <SelectContent>
                      {orientadores.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="supervisor">Supervisor</Label>
                  <Select value={supervisorId} onValueChange={setSupervisorId} required>
                    <SelectTrigger id="supervisor">
                      <SelectValue placeholder="Selecione o supervisor" />
                    </SelectTrigger>
                    <SelectContent>
                      {supervisores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="dataInicio">Data de Início</Label>
                  <Input
                    id="dataInicio"
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    aria-invalid={errosCadastro.dataInicio ? true : undefined}
                    aria-describedby={errosCadastro.dataInicio ? "dataInicio-erro" : undefined}
                    required
                  />
                  {errosCadastro.dataInicio ? (
                    <p id="dataInicio-erro" className="text-destructive text-xs">
                      {errosCadastro.dataInicio}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="dataFim">Data de Fim</Label>
                  <Input
                    id="dataFim"
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    aria-invalid={errosCadastro.dataFim ? true : undefined}
                    aria-describedby={errosCadastro.dataFim ? "dataFim-erro" : undefined}
                    required
                  />
                  {errosCadastro.dataFim ? (
                    <p id="dataFim-erro" className="text-destructive text-xs">
                      {errosCadastro.dataFim}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="cargaHorariaPrevista">Duração prevista em horas</Label>
                <Input
                  id="cargaHorariaPrevista"
                  type="number"
                  min={1}
                  max={4000}
                  value={cargaHorariaPrevista}
                  onChange={(evento) => setCargaHorariaPrevista(evento.target.value)}
                  required
                />
              </div>
              {!gestao && (
                <div className="flex flex-col gap-4 rounded border p-4">
                  <p className="text-sm">
                    Os três documentos iniciais são obrigatórios. Os dados compartilhados são
                    preenchidos automaticamente; complete as informações específicas antes de salvar
                    a solicitação.
                  </p>
                  <Label htmlFor="documentoInicialAtivo">Dados dos documentos iniciais</Label>
                  <select
                    id="documentoInicialAtivo"
                    className="bg-background max-w-full rounded border p-2"
                    value={documentoAtivo}
                    onChange={(evento) => setDocumentoAtivo(evento.target.value)}
                  >
                    {DOCUMENTOS_INICIAIS.map((id) => (
                      <option key={id} value={id}>
                        {templates.find((template) => template.id === id)?.nome ?? id}
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const existente = editandoId
                      ? documentos.find(
                          (doc) =>
                            doc.estagioId === editandoId &&
                            doc.templateId === documentoAtivo &&
                            doc.situacao !== "inativo",
                        )
                      : undefined;
                    const original =
                      existente?.descritor ??
                      descritoresIniciais[documentoAtivo] ??
                      descritorPorTemplate(documentoAtivo)!;
                    const descriptor = {
                      ...original,
                      auto: original.auto?.filter(
                        (campo) =>
                          !["orientador", "supervisor", "dataInicio", "dataFim"].includes(campo.id),
                      ),
                      secoes: original.secoes
                        .filter((secao) => secao.id !== "parecer")
                        .map((secao) => ({
                          ...secao,
                          campos: secao.campos.filter(
                            (campo) =>
                              ![
                                "dataInicioPrevista",
                                "dataFimPrevista",
                                "cargaHorariaTotal",
                              ].includes(campo.id),
                          ),
                        })),
                    };
                    const contexto = {
                      ...valoresDocumentos[documentoAtivo],
                      instituicao:
                        convenios.find((convenio) => convenio.id === convenioId)?.instituicao ?? "",
                      localEstagio:
                        convenios.find((convenio) => convenio.id === convenioId)?.instituicao ?? "",
                      supervisor:
                        supervisores.find((pessoa) => pessoa.id === supervisorId)?.nome ?? "",
                      orientador:
                        orientadores.find((pessoa) => pessoa.id === orientadorId)?.nome ?? "",
                      dataInicio,
                      dataFim,
                    };
                    return (
                      <FormularioDocumento
                        key={documentoAtivo}
                        descriptor={descriptor}
                        valores={contexto}
                        aoMudar={(id, valor) =>
                          setValoresDocumentos((atual) => ({
                            ...atual,
                            [documentoAtivo]: { ...atual[documentoAtivo], [id]: valor },
                          }))
                        }
                        aoMudarGrupo={(alteracoes) =>
                          setValoresDocumentos((atual) => ({
                            ...atual,
                            [documentoAtivo]: { ...atual[documentoAtivo], ...alteracoes },
                          }))
                        }
                      />
                    );
                  })()}
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={pendente}>
                  Salvar Estágio
                </Button>
                <Button type="button" variant="ghost" onClick={() => setCriando(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1">
          <SearchIcon className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
          <Input
            placeholder="Buscar por instituição, supervisor, orientador ou ID..."
            aria-label="Buscar estágios"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroSituacao} onValueChange={setFiltroSituacao}>
          <SelectTrigger className="w-[180px]" aria-label="Filtrar situação">
            <SelectValue placeholder="Filtrar situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            <SelectItem value="em_preparacao">Em preparação</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {estagiosFiltrados.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ClockIcon className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="text-lg font-semibold">Nenhum estágio encontrado</h3>
            <p className="text-muted-foreground mt-1 mb-4 text-sm">
              {estagios.length === 0
                ? "Você ainda não possui estágios cadastrados."
                : "Nenhum estágio corresponde aos filtros aplicados."}
            </p>
            {estagios.length === 0 && !gestao ? (
              <Button onClick={() => setCriando(true)}>
                <PlusIcon className="mr-2 h-4 w-4" /> Cadastrar primeiro estágio
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {estagiosFiltrados.map((estagio) => (
            <Card key={estagio.id} className="hover:bg-muted/50 cursor-pointer transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => {
                      setEstagioSelecionadoId(estagio.id);
                      setExclusaoPendente(false);
                    }}
                  >
                    Estágio #{estagio.id.slice(-6)}
                  </Button>
                </CardTitle>
                <Badge variant={varianteSituacaoEstagio(estagio.situacao)}>
                  {estagio.canceladoEm
                    ? "Cancelado"
                    : estagio.excluidoEm
                      ? "Excluído"
                      : rotuloSituacaoEstagio(estagio.situacao)}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
                  {gestao ? (
                    <span>
                      Aluno:{" "}
                      {estagio.excluidoEm
                        ? estagio.nomeAlunoHistorico
                        : (nomesUsuarios[estagio.alunoId] ?? "Cadastro excluído")}
                    </span>
                  ) : null}
                  <span>
                    Instituição: {convenios.find((c) => c.id === estagio.convenioId)?.instituicao}
                  </span>
                  <span>
                    Supervisor: {supervisores.find((p) => p.id === estagio.supervisorId)?.nome}
                  </span>
                  <span>
                    Orientador: {orientadores.find((p) => p.id === estagio.orientadorId)?.nome}
                  </span>
                  <span>Início: {estagio.dataInicio}</span>
                  <span>Fim: {estagio.dataFim}</span>
                  <span>Documentos: {estagio.documentosSelecionados.length}</span>
                </div>
              </CardContent>
            </Card>
          ))}
          <p className="text-muted-foreground text-right text-xs">
            Total de resultados: {estagiosFiltrados.length}
          </p>
        </div>
      )}
    </div>
  );
}

function estagiandoDetalhe(estagio?: Estagio): estagio is Estagio {
  return Boolean(estagio);
}
