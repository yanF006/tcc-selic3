"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { alterarCadastroAction } from "@/app/(coordenacao)/coordenacao/cadastros/acoes";
import type { consultarCadastros, TipoCadastro } from "@/lib/services/cadastros";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const rotulos: Record<TipoCadastro, string> = {
  convenio: "Convênios",
  curso: "Cursos",
  turma: "Turmas",
  periodo: "Períodos",
  orientador: "Orientadores",
  supervisor: "Supervisores",
};

export function Cadastros({
  dados,
  apenasConvenios = false,
}: {
  dados: Awaited<ReturnType<typeof consultarCadastros>>;
  apenasConvenios?: boolean;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoCadastro>("convenio");
  const [id, setId] = useState<string | undefined>();
  const [campos, setCampos] = useState<Record<string, unknown>>({});
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("todos");
  const [mensagem, setMensagem] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const texto = (chave: string) => String(campos[chave] ?? "");
  const mudar = (chave: string, valor: unknown) =>
    setCampos((atual) => ({ ...atual, [chave]: valor }));
  const registros: {
    id: string;
    nome: string;
    situacao: string;
    descricao: string;
    dados: Record<string, unknown>;
  }[] =
    tipo === "convenio"
      ? dados.convenios.map((convenio) => ({
          id: convenio.id,
          nome: convenio.nome,
          situacao: convenio.classificacao,
          descricao: `${convenio.instituicao} · ${convenio.totalEstagios} estágios vinculados · Vigência: ${convenio.inicioVigencia} a ${convenio.fimVigencia}`,
          dados: { ...convenio },
        }))
      : tipo === "curso"
        ? dados.cursos.map((curso) => ({
            id: curso.id,
            nome: curso.nome,
            situacao: curso.situacao,
            descricao: curso.codigo,
            dados: { ...curso },
          }))
        : tipo === "turma"
          ? dados.turmas.map((turma) => ({
              id: turma.id,
              nome: turma.nome,
              situacao: turma.situacao,
              descricao: `Curso: ${dados.cursos.find((curso) => curso.id === turma.cursoId)?.nome ?? "Inativo"}`,
              dados: {
                ...turma,
                periodoIds:
                  turma.periodoIds ??
                  dados.periodos
                    .filter((periodo) => periodo.situacao === "ativo")
                    .map((periodo) => periodo.id),
              },
            }))
          : tipo === "periodo"
            ? dados.periodos.map((periodo) => ({
                id: periodo.id,
                nome: periodo.rotulo,
                situacao: periodo.situacao,
                descricao: `${periodo.ano}, ${periodo.semestre}º semestre`,
                dados: { ...periodo },
              }))
            : dados.pessoas
                .filter((pessoa) => pessoa.papel === tipo)
                .map((pessoa) => ({
                  id: pessoa.id,
                  nome: pessoa.nome,
                  situacao: pessoa.situacao,
                  descricao: [pessoa.email || "E-mail não informado", pessoa.telefone]
                    .filter(Boolean)
                    .join(" · "),
                  dados: { ...pessoa },
                }));
  const filtrados = registros.filter(
    (registro) =>
      (situacao === "todos" || registro.situacao === situacao) &&
      `${registro.nome} ${registro.descricao}`
        .toLocaleLowerCase("pt-BR")
        .includes(busca.toLocaleLowerCase("pt-BR")),
  );

  function executar(operacao: "salvar" | "excluir" | "inativar" | "ativar", registroId = id) {
    if (
      operacao === "excluir" &&
      !window.confirm(
        "Excluir este cadastro? Registros com vínculos devem ser inativados para preservar o histórico.",
      )
    )
      return;
    iniciar(async () => {
      const resultado = await alterarCadastroAction(tipo, campos, registroId, operacao);
      setMensagem(resultado);
      if (resultado.ok) {
        setId(undefined);
        setCampos({});
        router.refresh();
      }
    });
  }

  function campo(chave: string, rotulo: string, inputTipo = "text", obrigatorio = true) {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={`cadastro-${chave}`}>{rotulo}</Label>
        <Input
          id={`cadastro-${chave}`}
          type={inputTipo}
          value={texto(chave)}
          required={obrigatorio}
          onChange={(evento) => mudar(chave, evento.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {!apenasConvenios && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="tipo-cadastro">Tipo de cadastro</Label>
          <select
            id="tipo-cadastro"
            className="bg-background rounded border p-2"
            value={tipo}
            onChange={(evento) => {
              setTipo(evento.target.value as TipoCadastro);
              setId(undefined);
              setCampos({});
              setSituacao("todos");
              setBusca("");
              setMensagem(null);
            }}
          >
            {Object.entries(rotulos).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>
      )}
      {mensagem && (
        <Alert variant={mensagem.ok ? "default" : "destructive"}>
          <AlertTitle>{mensagem.ok ? "Operação concluída" : "Operação recusada"}</AlertTitle>
          <AlertDescription>{mensagem.mensagem}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{id ? "Editar cadastro" : `Novo cadastro — ${rotulos[tipo]}`}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(evento) => {
              evento.preventDefault();
              executar("salvar");
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {tipo !== "periodo" && campo("nome", "Nome do cadastro")}
              {tipo === "curso" && campo("codigo", "Código do curso")}
              {tipo === "convenio" && (
                <>
                  {campo("instituicao", "Instituição")}
                  {campo("cnpj", "CNPJ")}
                  {campo("inicioVigencia", "Data de assinatura", "date")}
                  <p className="text-muted-foreground text-sm">
                    Campus Pinheiral. Vigência de cinco anos a partir da assinatura.
                  </p>
                </>
              )}
              {tipo === "periodo" && (
                <>
                  {campo("ano", "Ano", "number")}
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="cadastro-semestre">Semestre</Label>
                    <select
                      id="cadastro-semestre"
                      className="bg-background rounded border p-2"
                      value={texto("semestre")}
                      onChange={(evento) => mudar("semestre", evento.target.value)}
                      required
                    >
                      <option value="">Selecione</option>
                      <option value="1">1º semestre</option>
                      <option value="2">2º semestre</option>
                    </select>
                  </div>
                </>
              )}
              {tipo === "turma" && (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="cadastro-cursoId">Curso da turma</Label>
                    <select
                      className="bg-background rounded border p-2"
                      id="cadastro-cursoId"
                      value={texto("cursoId")}
                      onChange={(evento) => mudar("cursoId", evento.target.value)}
                      required
                    >
                      <option value="">Selecione o curso</option>
                      {dados.cursos
                        .filter((curso) => curso.situacao === "ativo")
                        .map((curso) => (
                          <option key={curso.id} value={curso.id}>
                            {curso.nome}
                          </option>
                        ))}
                    </select>
                  </div>
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-sm font-medium">Períodos da turma</legend>
                    {dados.periodos
                      .filter((periodo) => periodo.situacao === "ativo")
                      .map((periodo) => (
                        <Label className="flex items-center gap-2" key={periodo.id}>
                          <Checkbox
                            checked={
                              Array.isArray(campos.periodoIds) &&
                              campos.periodoIds.includes(periodo.id)
                            }
                            onCheckedChange={(valor) => {
                              const selecionados = Array.isArray(campos.periodoIds)
                                ? campos.periodoIds
                                : [];
                              mudar(
                                "periodoIds",
                                valor === true
                                  ? [...selecionados, periodo.id]
                                  : selecionados.filter((id) => id !== periodo.id),
                              );
                            }}
                          />
                          {periodo.rotulo}
                        </Label>
                      ))}
                  </fieldset>
                </>
              )}
              {(tipo === "orientador" || tipo === "supervisor") && (
                <>
                  {campo("email", "E-mail do responsável", "email", false)}
                  {campo("telefone", "Telefone do responsável", "tel", false)}
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pendente}>
                Salvar cadastro
              </Button>
              {id && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setId(undefined);
                    setCampos({});
                  }}
                >
                  Cancelar edição
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
      {tipo === "convenio" && (
        <p>
          Ativos: {dados.convenios.filter((convenio) => convenio.classificacao === "ativo").length}{" "}
          · Expirados:{" "}
          {dados.convenios.filter((convenio) => convenio.classificacao === "expirado").length}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="busca-cadastros">Buscar cadastros</Label>
          <Input
            id="busca-cadastros"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="situacao-cadastros">Filtrar classificação</Label>
          <select
            id="situacao-cadastros"
            className="bg-background rounded border p-2"
            value={situacao}
            onChange={(evento) => setSituacao(evento.target.value)}
          >
            <option value="todos">Todas</option>
            <option value="ativo">Ativos</option>
            <option value={tipo === "convenio" ? "expirado" : "inativo"}>
              {tipo === "convenio" ? "Expirados" : "Inativos"}
            </option>
          </select>
        </div>
      </div>
      <p>Total de resultados: {filtrados.length}</p>
      {filtrados.length === 0 && (
        <p className="text-muted-foreground text-sm">Nenhum cadastro corresponde aos filtros.</p>
      )}
      {filtrados.map((registro) => (
        <Card key={registro.id} data-testid={`cadastro-${registro.id}`}>
          <CardHeader>
            <CardTitle className="text-base">{registro.nome}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Badge variant={registro.situacao === "ativo" ? "success" : "secondary"}>
              {registro.situacao === "ativo"
                ? "Ativo"
                : tipo === "convenio"
                  ? "Expirado"
                  : "Inativo"}
            </Badge>
            <p className="text-muted-foreground text-sm">{registro.descricao}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={pendente}
                onClick={() => {
                  setId(registro.id);
                  setCampos(registro.dados);
                  window.scrollTo({ top: 0, behavior: "instant" });
                }}
              >
                Editar cadastro
              </Button>
              <Button
                variant="outline"
                disabled={pendente || registro.situacao !== "ativo"}
                onClick={() => executar("inativar", registro.id)}
              >
                {tipo === "convenio" ? "Classificar como expirado" : "Inativar cadastro"}
              </Button>
              {registro.situacao !== "ativo" && (
                <Button
                  variant="outline"
                  disabled={pendente}
                  onClick={() => executar("ativar", registro.id)}
                >
                  Ativar cadastro
                </Button>
              )}
              <Button
                variant="destructive"
                disabled={pendente}
                onClick={() => executar("excluir", registro.id)}
              >
                Excluir cadastro
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
