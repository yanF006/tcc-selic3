"use client";

import * as React from "react";

import { CampoTexto, LegendaObrigatorios, RotuloCampo } from "@/components/formularios/campo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircleIcon, CheckCircle2Icon, GraduationCapIcon, InfoIcon } from "lucide-react";

import type { Curso, MatriculaImportada, ResultadoImportacao } from "@/lib/domain/types";
import type { LinhaImportacao } from "@/lib/services/administracao";

import {
  importarMatriculasAction,
  registrarMatriculaAction,
} from "@/app/(admin)/admin/matriculas/acoes";

/**
 * Matrículas registradas (8.4): lançamento manual de matrícula válida e
 * consulta das matrículas já existentes com a origem do registro.
 *
 * A integração com o SIGAA fica fora do escopo; enquanto ela não existe, o
 * lançamento manual é o que faz a matrícula do aluno valer no cadastro.
 */

interface Props {
  matriculas: MatriculaImportada[];
  total: number;
  cursos: Curso[];
}

const ORIGENS: { valor: string; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas as origens" },
  { valor: "importacao", rotulo: "Importação" },
  { valor: "cadastro_administrador", rotulo: "Lançamento do administrador" },
];

export function TabelaMatriculas({ matriculas, total, cursos }: Props) {
  const [busca, setBusca] = React.useState("");
  const [consulta, setConsulta] = React.useState("");
  const [origem, setOrigem] = React.useState("todas");
  const [matricula, setMatricula] = React.useState("");
  const [nome, setNome] = React.useState("");
  const [curso, setCurso] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  const [arquivoImportacao, setArquivoImportacao] = React.useState<{
    arquivo: string;
    linhas: LinhaImportacao[];
  } | null>(null);
  const [resultadoImportacao, setResultadoImportacao] = React.useState<ResultadoImportacao | null>(
    null,
  );
  const [erroImportacao, setErroImportacao] = React.useState<string | null>(null);
  const [importando, setImportando] = React.useState(false);

  const filtradas = React.useMemo(() => {
    const alvo = consulta.trim().toLowerCase();

    return matriculas.filter((registro) => {
      if (origem !== "todas" && registro.origem !== origem) return false;
      if (!alvo) return true;

      return (
        registro.nome.toLowerCase().includes(alvo) ||
        registro.matricula.includes(alvo) ||
        registro.curso.toLowerCase().includes(alvo)
      );
    });
  }, [consulta, matriculas, origem]);

  function buscar(evento: React.FormEvent) {
    evento.preventDefault();
    setConsulta(busca);
  }

  function limpar() {
    setBusca("");
    setConsulta("");
    setOrigem("todas");
  }

  async function lerArquivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    setResultadoImportacao(null);
    setErroImportacao(null);
    if (!arquivo) {
      setArquivoImportacao(null);
      return;
    }

    const texto = await arquivo.text();
    setArquivoImportacao({ arquivo: arquivo.name, linhas: analisarLinhas(texto) });
  }

  async function importar(evento: React.FormEvent) {
    evento.preventDefault();
    setErroImportacao(null);
    setResultadoImportacao(null);

    if (!arquivoImportacao) {
      setErroImportacao("Selecione um arquivo .csv com as matrículas.");
      return;
    }

    setImportando(true);
    const resposta = await importarMatriculasAction(
      arquivoImportacao.arquivo,
      arquivoImportacao.linhas,
    );
    setImportando(false);

    if (!resposta.ok) {
      setErroImportacao(resposta.erro ?? "Não foi possível importar o arquivo.");
      return;
    }

    setResultadoImportacao(resposta.resultado ?? null);
  }

  async function registrar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setAviso(null);
    setEnviando(true);

    const resultado = await registrarMatriculaAction({ matricula, nome, curso });

    setEnviando(false);

    if (!resultado.ok) {
      setErro(resultado.erro ?? "Não foi possível registrar a matrícula.");

      return;
    }

    setAviso(`Matrícula ${matricula.trim()} registrada como válida.`);
    setMatricula("");
    setNome("");
    setCurso("");
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCapIcon className="size-4" aria-hidden="true" />
            Lançar matrícula válida
          </CardTitle>
          <CardDescription>
            Enquanto não houver integração com o SIGAA, o administrador registra aqui a matrícula
            que passa a valer no sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={registrar}>
            <LegendaObrigatorios />

            <div className="grid gap-4 sm:grid-cols-3">
              <CampoTexto
                id="matricula-nova"
                rotulo="Matrícula"
                obrigatorio
                inputMode="numeric"
                maxLength={11}
                placeholder="20241006904"
                descricao="11 dígitos."
                valor={matricula}
                aoMudar={setMatricula}
              />
              <CampoTexto
                id="matricula-nova-nome"
                rotulo="Nome do aluno"
                obrigatorio
                valor={nome}
                aoMudar={setNome}
              />
              <div className="flex flex-col gap-2">
                <RotuloCampo htmlFor="matricula-nova-curso" obrigatorio>
                  Curso
                </RotuloCampo>
                <Select value={curso} onValueChange={setCurso}>
                  <SelectTrigger id="matricula-nova-curso" aria-required="true">
                    <SelectValue placeholder="Selecione o curso" />
                  </SelectTrigger>
                  <SelectContent>
                    {cursos.map((item) => (
                      <SelectItem key={item.id} value={item.nome}>
                        {item.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {erro ? (
              <Alert variant="destructive" role="alert">
                <AlertCircleIcon className="size-4" aria-hidden="true" />
                <AlertTitle>Matrícula não registrada</AlertTitle>
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            ) : null}

            {aviso ? (
              <Alert role="status">
                <CheckCircle2Icon className="size-4" aria-hidden="true" />
                <AlertTitle>Matrícula registrada</AlertTitle>
                <AlertDescription>{aviso}</AlertDescription>
              </Alert>
            ) : null}

            <div>
              <Button type="submit" disabled={enviando}>
                {enviando ? "Registrando…" : "Registrar matrícula"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCapIcon className="size-4" aria-hidden="true" />
            Importar matrículas por arquivo
          </CardTitle>
          <CardDescription>
            Envie um arquivo .csv com as colunas matrícula, nome e curso. O relatório mostra as
            válidas, as rejeitadas e as ignoradas com o motivo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={importar}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="arquivo-matriculas">Arquivo .csv de matrículas</Label>
              <Input
                id="arquivo-matriculas"
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={lerArquivo}
              />
              {arquivoImportacao ? (
                <p className="text-muted-foreground text-sm" data-testid="linhas-importacao">
                  {arquivoImportacao.arquivo}: {arquivoImportacao.linhas.length} linha(s) pronta(s)
                  para importar.
                </p>
              ) : null}
            </div>

            {erroImportacao ? (
              <Alert variant="destructive" role="alert">
                <AlertCircleIcon className="size-4" aria-hidden="true" />
                <AlertTitle>Importação não realizada</AlertTitle>
                <AlertDescription>{erroImportacao}</AlertDescription>
              </Alert>
            ) : null}

            <div>
              <Button type="submit" disabled={importando}>
                {importando ? "Importando…" : "Importar arquivo"}
              </Button>
            </div>
          </form>

          {resultadoImportacao ? (
            <div className="mt-6 flex flex-col gap-3">
              <p className="text-sm font-medium" data-testid="relatorio-importacao">
                {resultadoImportacao.validas} válida(s), {resultadoImportacao.rejeitadas}{" "}
                rejeitada(s) e {resultadoImportacao.ignoradas} ignorada(s).
              </p>
              <div className="border-border overflow-x-auto rounded-lg border">
                <Table aria-label="Relatório da importação">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultadoImportacao.itens.map((item, indice) => (
                      <TableRow key={`${item.matricula}-${indice}`}>
                        <TableCell>{item.matricula}</TableCell>
                        <TableCell>{item.nome}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.resultado === "valida"
                                ? "success"
                                : item.resultado === "rejeitada"
                                  ? "destructive"
                                  : "warning"
                            }
                          >
                            {rotuloResultado(item.resultado)}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.motivo ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <form className="flex flex-wrap items-end gap-3" onSubmit={buscar}>
          <div className="flex min-w-64 flex-1 flex-col gap-2">
            <Label htmlFor="busca-matricula">Buscar por nome, matrícula ou curso</Label>
            <Input
              id="busca-matricula"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Ex.: Maria"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="filtro-origem">Origem</Label>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger id="filtro-origem" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORIGENS.map((opcao) => (
                  <SelectItem key={opcao.valor} value={opcao.valor}>
                    {opcao.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
          <Button type="button" variant="ghost" onClick={limpar}>
            Limpar
          </Button>
        </form>

        <Alert>
          <InfoIcon className="size-4" aria-hidden="true" />
          <AlertDescription>
            A matrícula registrada vale para o cadastro do aluno e para os próximos cadastros. A
            importação é manual e temporária, pois ainda não há acesso oficial ao SIGAA.
          </AlertDescription>
        </Alert>

        <p className="text-muted-foreground text-sm" data-testid="total-matriculas">
          {filtradas.length === 0
            ? "Nenhuma matrícula encontrada com os filtros informados."
            : `${filtradas.length} de ${total} matrícula(s) encontrada(s).`}
        </p>

        <div className="border-border overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matrícula</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((registro) => (
                <TableRow key={registro.id} data-matricula={registro.matricula}>
                  <TableCell className="font-medium">{registro.matricula}</TableCell>
                  <TableCell>{registro.nome}</TableCell>
                  <TableCell>{registro.curso}</TableCell>
                  <TableCell>
                    <Badge variant={registro.origem === "importacao" ? "info" : "outline"}>
                      {rotuloOrigem(registro.origem)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function rotuloOrigem(origem: MatriculaImportada["origem"]): string {
  return origem === "importacao" ? "Importação" : "Lançamento do administrador";
}

function rotuloResultado(resultado: ResultadoImportacao["itens"][number]["resultado"]): string {
  return resultado === "valida" ? "Válida" : resultado === "rejeitada" ? "Rejeitada" : "Ignorada";
}

function analisarLinhas(texto: string): LinhaImportacao[] {
  const linhas = texto
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);

  if (linhas.length > 0 && /matr[ií]cula/i.test(linhas[0])) linhas.shift();

  return linhas.map((linha) => {
    const separador = linha.includes(";") ? ";" : ",";
    const partes = linha.split(separador).map((parte) => parte.trim().replace(/^"|"$/g, ""));

    return { matricula: partes[0] ?? "", nome: partes[1] ?? "", curso: partes[2] ?? "" };
  });
}
