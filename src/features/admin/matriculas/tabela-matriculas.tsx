"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

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

interface FiltrosMatriculas {
  busca: string;
  origem: string;
}

interface Props {
  matriculas: MatriculaImportada[];
  total: number;
  paginaAtual: number;
  tamanhoPagina: number;
  filtros: FiltrosMatriculas;
  cursos: Curso[];
}

const ORIGENS: { valor: string; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas as origens" },
  { valor: "importacao", rotulo: "Importação" },
  { valor: "cadastro_administrador", rotulo: "Lançamento do administrador" },
];

export function TabelaMatriculas({
  matriculas,
  total,
  paginaAtual,
  tamanhoPagina,
  filtros,
  cursos,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [busca, setBusca] = React.useState(filtros.busca);
  const [matricula, setMatricula] = React.useState("");
  const [nome, setNome] = React.useState("");
  const [curso, setCurso] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  const envioEmAndamento = React.useRef(false);
  const [arquivoImportacao, setArquivoImportacao] = React.useState<{
    arquivo: string;
    linhas: LinhaImportacao[];
  } | null>(null);
  const [resultadoImportacao, setResultadoImportacao] = React.useState<ResultadoImportacao | null>(
    null,
  );
  const [erroImportacao, setErroImportacao] = React.useState<string | null>(null);
  const [importando, setImportando] = React.useState(false);
  const importacaoEmAndamento = React.useRef(false);
  const [navegando, iniciarNavegacao] = React.useTransition();

  const totalPaginas = Math.max(1, Math.ceil(total / tamanhoPagina));
  const paginaCorrente = Math.min(Math.max(1, paginaAtual), totalPaginas);

  function navegar(alteracoes: Partial<FiltrosMatriculas> & { pagina?: number }) {
    const proximos = { ...filtros, pagina: paginaCorrente, ...alteracoes };
    const parametros = new URLSearchParams();

    if (proximos.busca.trim()) parametros.set("busca", proximos.busca.trim());
    if (proximos.origem !== "todas") parametros.set("origem", proximos.origem);
    if ((proximos.pagina ?? 1) > 1) parametros.set("pagina", String(proximos.pagina));

    const consulta = parametros.toString();

    iniciarNavegacao(() => {
      router.push(consulta ? `${pathname}?${consulta}` : pathname);
    });
  }

  function buscar(evento: React.FormEvent) {
    evento.preventDefault();
    navegar({ busca, pagina: 1 });
  }

  function limpar() {
    setBusca("");
    navegar({ busca: "", origem: "todas", pagina: 1 });
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
    if (importacaoEmAndamento.current) return;

    setErroImportacao(null);
    setResultadoImportacao(null);

    if (!arquivoImportacao) {
      setErroImportacao("Selecione um arquivo .csv com as matrículas.");
      return;
    }

    importacaoEmAndamento.current = true;
    setImportando(true);

    try {
      const resposta = await importarMatriculasAction(
        arquivoImportacao.arquivo,
        arquivoImportacao.linhas,
      );

      if (!resposta.ok) {
        setErroImportacao(resposta.erro ?? "Não foi possível importar o arquivo.");
        return;
      }

      setResultadoImportacao(resposta.resultado ?? null);
      router.refresh();
    } finally {
      importacaoEmAndamento.current = false;
      setImportando(false);
    }
  }

  async function registrar(evento: React.FormEvent) {
    evento.preventDefault();
    if (envioEmAndamento.current) return;

    envioEmAndamento.current = true;
    setErro(null);
    setAviso(null);
    setEnviando(true);

    try {
      const resultado = await registrarMatriculaAction({ matricula, nome, curso });

      if (!resultado.ok) {
        setErro(resultado.erro ?? "Não foi possível registrar a matrícula.");

        return;
      }

      setAviso(`Matrícula ${matricula.trim()} registrada como válida.`);
      setMatricula("");
      setNome("");
      setCurso("");
      router.refresh();
    } finally {
      envioEmAndamento.current = false;
      setEnviando(false);
    }
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
            <Select
              value={filtros.origem}
              onValueChange={(valor) => navegar({ origem: valor, pagina: 1 })}
            >
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

        <p
          className="text-muted-foreground text-sm"
          data-testid="total-matriculas"
          aria-busy={navegando}
        >
          {total === 0
            ? "Nenhuma matrícula encontrada com os filtros informados."
            : `${matriculas.length} de ${total} matrícula(s) encontrada(s).`}
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
              {matriculas.map((registro) => (
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

        {totalPaginas > 1 ? (
          <nav aria-label="Paginação de matrículas" className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={paginaCorrente === 1 || navegando}
              onClick={() => navegar({ pagina: paginaCorrente - 1 })}
            >
              Anterior
            </Button>
            <span className="text-muted-foreground text-sm">
              Página {paginaCorrente} de {totalPaginas}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={paginaCorrente === totalPaginas || navegando}
              onClick={() => navegar({ pagina: paginaCorrente + 1 })}
            >
              Próxima
            </Button>
          </nav>
        ) : null}
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
