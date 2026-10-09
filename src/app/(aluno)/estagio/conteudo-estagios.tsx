"use client";

import * as R from "react";
import * as React from "react";

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
import { PlusIcon, SearchIcon, AlertCircleIcon, FileTextIcon, ClockIcon } from "lucide-react";

import { criarEstagioAction, selecionarDocumentosAction, removerDocumentoEstagioAction, lancarHorasAction, corrigirLancamentoAction } from "./acoes";
import type { Convenio, Estagio, LancamentoHoras, Pessoa, TemplateDocumento } from "@/lib/domain/types";
import { rotuloSituacaoEstagio, varianteSituacaoEstagio } from "@/lib/domain/status";
import { LIMITE_HORAS_DIA, calcularHorasDia } from "@/lib/domain/schemas";
import { formatarData, formatarHoras } from "@/lib/format";

export function ConteudoEstagios({
  alunoId,
  estagiosIniciais,
  convenios,
  orientadores,
  supervisores,
  templates,
  resumosHoras,
}: {
  alunoId: string;
  estagiosIniciais: Estagio[];
  convenios: Convenio[];
  orientadores: Pessoa[];
  supervisores: Pessoa[];
  templates: TemplateDocumento[];
  resumosHoras: Record<string, { total: number; lancamentos: LancamentoHoras[] }>;
}) {
  const [estagios, setEstagios] = React.useState<Estagio[]>(estagiosIniciais);
  const [busca, setBusca] = React.useState("");
  const [filtroSituacao, setFiltroSituacao] = React.useState<string>("todos");
  const [estagioSelecionadoId, setEstagioSelecionadoId] = React.useState<string | null>(null);
  const [criando, setCriando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
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
    const matchBusca = !busca || e.id.toLowerCase().includes(busca.toLowerCase());
    const matchSit = filtroSituacao === "todos" || e.situacao === filtroSituacao;
    return matchBusca && matchSit;
  });

  function lidarComCriacao(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    iniciar(async () => {
      const res = await criarEstagioAction({
        convenioId,
        supervisorId,
        orientadorId,
        dataInicio,
        dataFim,
        documentosSelecionados,
      });

      if (!res.ok) {
        setErro(res.erro ?? "Erro ao cadastrar estágio.");
        return;
      }

      setCriando(false);
      setSucesso("Estágio cadastrado com sucesso.");
      // Recarregar / atualizar lista simulada ou atualizar estado
      window.location.reload();
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
      window.location.reload();
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

      window.location.reload();
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

      window.location.reload();
    });
  }

  if (estagiandoDetalhe(estagioAtual)) {
    return (
      <div className="flex flex-col gap-6">
        <Button variant="ghost" onClick={() => setEstagioSelecionadoId(null)} className="w-fit">
          ← Voltar para o histórico
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Detalhes do Estágio</CardTitle>
              <Badge variant={varianteSituacaoEstagio(estagioAtual.situacao)}>
                {rotuloSituacaoEstagio(estagioAtual.situacao)}
              </Badge>
            </div>
            <CardDescription>
              Período: {estagioAtual.dataInicio} a {estagioAtual.dataFim}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
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
                <p className="text-sm font-semibold">{rotuloSituacaoEstagio(estagioAtual.situacao)}</p>
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

                {estagioAtual.situacao === "em_andamento" ? (
                  <form
                    onSubmit={lidarComLancamento}
                    className="border rounded p-4 flex flex-col gap-4"
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
                        <span className="text-sm text-muted-foreground" data-testid="previa-horas">
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
                          className="border rounded p-3 flex flex-col gap-3"
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
                              <span className="text-sm text-muted-foreground">
                                {lancamento.entrada}–{lancamento.saida} ·{" "}
                                {formatarHoras(lancamento.horas)}
                                {lancamento.almocoDesligado ? " · sem almoço" : ""}
                              </span>
                            </div>

                            {lancamento.tipo === "lancamento" &&
                            estagioAtual.situacao === "em_andamento" ? (
                              corrigindoId === lancamento.id ? (
                                <form
                                  onSubmit={lidarComCorrecao}
                                  className="w-full border-t pt-3 flex flex-col gap-3"
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
                    return (
                      <div key={docId} className="flex items-center justify-between border rounded p-3">
                        <span className="text-sm font-medium">{tmpl?.nome ?? docId}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Selecionado</Badge>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={pendente}
                            onClick={() => lidarComRemocaoDoc(docId)}
                          >
                            Remover
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Meus Estágios</h2>
          <p className="text-muted-foreground text-sm">Histórico e cadastro de novos estágios.</p>
        </div>
        <Button onClick={() => setCriando(true)}>
          <PlusIcon className="mr-2 h-4 w-4" /> Cadastrar Estágio
        </Button>
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
            <CardTitle>Novo Estágio</CardTitle>
            <CardDescription>Preencha os dados do convênio, orientador, supervisor e datas.</CardDescription>
          </CardHeader>
          <CardContent>
            {conveniosAtivos.length === 0 ? (
              <Alert variant="destructive" className="mb-4">
                <AlertCircleIcon aria-hidden="true" />
                <AlertTitle>Nenhum convênio ativo</AlertTitle>
                <AlertDescription>
                  Não há convênios ativos cadastrados no momento. Solicite à coordenação o cadastro de um convênio.
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
                    {conveniosAtivos.map((c) => (
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
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="dataFim">Data de Fim</Label>
                  <Input
                    id="dataFim"
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Documentos Iniciais</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {templates
                    .filter((t) => t.tipo === "preenchivel" && t.metadados?.papeisPreenchimento.includes("aluno"))
                    .map((t) => (
                      <div key={t.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`tmpl-${t.id}`}
                          checked={documentosSelecionados.includes(t.id)}
                          onCheckedChange={() => toggleDocumento(t.id)}
                        />
                        <Label htmlFor={`tmpl-${t.id}`} className="text-sm font-normal">
                          {t.nome}
                        </Label>
                      </div>
                    ))}
                </div>
              </div>

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
          <SearchIcon className="text-muted-foreground absolute left-3 top-2.5 h-4 w-4" />
          <Input
            placeholder="Buscar por ID..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroSituacao} onValueChange={setFiltroSituacao}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
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
            <p className="text-muted-foreground text-sm mt-1 mb-4">
              {estagios.length === 0
                ? "Você ainda não possui estágios cadastrados."
                : "Nenhum estágio corresponde aos filtros aplicados."}
            </p>
            {estagios.length === 0 ? (
              <Button onClick={() => setCriando(true)}>
                <PlusIcon className="mr-2 h-4 w-4" /> Cadastrar primeiro estágio
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {estagiosFiltrados.map((estagio) => (
            <Card
              key={estagio.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => setEstagioSelecionadoId(estagio.id)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Estágio #{estagio.id.slice(-6)}</CardTitle>
                <Badge variant={varianteSituacaoEstagio(estagio.situacao)}>
                  {rotuloSituacaoEstagio(estagio.situacao)}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>Início: {estagio.dataInicio}</span>
                  <span>Fim: {estagio.dataFim}</span>
                  <span>Documentos: {estagio.documentosSelecionados.length}</span>
                </div>
              </CardContent>
            </Card>
          ))}
          <p className="text-muted-foreground text-xs text-right">
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
