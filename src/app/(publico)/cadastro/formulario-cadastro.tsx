"use client";

import * as React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";

import {
  concluirCadastroAction,
  validarEtapaUmAction,
  type PreviaCadastro,
} from "@/app/(publico)/cadastro/acoes";

import type { Curso, Periodo, Turma } from "@/lib/domain/types";

/**
 * Cadastro público em duas etapas (5.2 a 5.5): matrícula, e-mail, senha e
 * confirmação; depois dados pessoais e curso, turma e período dependentes.
 * Trocar o curso limpa turma e período.
 */
export function FormularioCadastro({
  cursos,
  turmas,
  periodos,
}: {
  cursos: Curso[];
  turmas: Turma[];
  periodos: Periodo[];
}) {
  const [etapa, setEtapa] = React.useState<1 | 2>(1);
  const [previa, setPrevia] = React.useState<PreviaCadastro | null>(null);
  const [erro, setErro] = React.useState<{ campo?: string; texto: string } | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();
  const [concluido, setConcluido] = React.useState<{ situacao: string } | null>(null);

  const [matricula, setMatricula] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [confirmacao, setConfirmacao] = React.useState("");

  const [nomeCompleto, setNomeCompleto] = React.useState("");
  const [cpf, setCpf] = React.useState("");
  const [rg, setRg] = React.useState("");
  const [dataNascimento, setDataNascimento] = React.useState("");
  const [telefone, setTelefone] = React.useState("");
  const [celular, setCelular] = React.useState("");
  const [logradouro, setLogradouro] = React.useState("");
  const [bairro, setBairro] = React.useState("");
  const [cidade, setCidade] = React.useState("");
  const [uf, setUf] = React.useState("RJ");
  const [cep, setCep] = React.useState("");
  const [cursoId, setCursoId] = React.useState("");
  const [turmaId, setTurmaId] = React.useState("");
  const [periodoId, setPeriodoId] = React.useState("");

  const turmasDoCurso = turmas.filter((turma) => turma.cursoId === cursoId);

  function enviarPrimeiraEtapa(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setAviso(null);

    iniciar(async () => {
      const resultado = await validarEtapaUmAction({ matricula, email, senha, confirmacao });

      if (!resultado.ok) {
        setErro({ campo: resultado.campo, texto: resultado.erro });

        return;
      }

      setPrevia(resultado.previa);
      setAviso(resultado.mensagem);
      setNomeCompleto((nome) => nome || resultado.previa.nome);
      setEtapa(2);
    });
  }

  function trocarCurso(valor: string) {
    // Trocar o curso limpa turma e período, exigindo nova seleção (5.5).
    setCursoId(valor);
    setTurmaId("");
    setPeriodoId("");
  }

  function enviarSegundaEtapa(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);

    if (!previa) return;

    iniciar(async () => {
      const resultado = await concluirCadastroAction(previa.id, {
        nomeCompleto,
        cpf,
        rg,
        dataNascimento,
        telefone,
        celular,
        endereco: {
          logradouro,
          numero: "",
          complemento: "",
          bairro,
          cidade,
          estado: uf,
          cep,
        },
        cursoId,
        turmaId,
        periodoId,
      });

      if (!resultado.ok) {
        setErro({ campo: resultado.campo, texto: resultado.erro });

        return;
      }

      setConcluido({ situacao: resultado.situacao });
    });
  }

  if (concluido) {
    return (
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>
            <h1 className="text-base font-semibold">Cadastro enviado</h1>
          </CardTitle>
          <CardDescription>
            {concluido.situacao === "pendente"
              ? "Seu cadastro ficou pendente: a coordenação precisa autorizar a matrícula antes de liberar o acesso."
              : "Sua matrícula foi confirmada nos registros importados e o acesso já está liberado."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <CheckCircle2Icon aria-hidden="true" />
            <AlertTitle>
              {concluido.situacao === "pendente" ? "Aguarde a autorização" : "Acesso liberado"}
            </AlertTitle>
            <AlertDescription>
              {concluido.situacao === "pendente"
                ? "Você recebe um aviso assim que a coordenação decidir. Enquanto isso, as áreas autenticadas seguem bloqueadas."
                : "Entre com o e-mail e a senha cadastrados para acessar os documentos."}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>
          <h1 className="text-base font-semibold">Criar cadastro</h1>
        </CardTitle>
        <CardDescription>
          {etapa === 1
            ? "Primeira etapa: matrícula do SIGAA, e-mail e senha."
            : "Segunda etapa: seus dados e o vínculo com o curso."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {aviso ? (
          <Alert className="mb-4">
            <CheckCircle2Icon aria-hidden="true" />
            <AlertTitle>Etapa 1 conferida</AlertTitle>
            <AlertDescription>{aviso}</AlertDescription>
          </Alert>
        ) : null}

        {erro ? (
          <Alert variant="destructive" className="mb-4">
            <AlertCircleIcon aria-hidden="true" />
            <AlertTitle>Cadastro recusado</AlertTitle>
            <AlertDescription data-erro-cadastro={erro.campo ?? "dados"}>
              {erro.texto}
            </AlertDescription>
          </Alert>
        ) : null}

        {etapa === 1 ? (
          <form onSubmit={enviarPrimeiraEtapa} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cadastro-matricula">Matrícula (SIGAA)</Label>
              <Input
                id="cadastro-matricula"
                inputMode="numeric"
                value={matricula}
                onChange={(evento) => setMatricula(evento.target.value)}
                placeholder="2023100457"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="cadastro-email">E-mail</Label>
              <Input
                id="cadastro-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(evento) => setEmail(evento.target.value)}
                placeholder="nome@aluno.ifrj.edu.br"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="cadastro-senha">Senha</Label>
              <Input
                id="cadastro-senha"
                type="password"
                autoComplete="new-password"
                value={senha}
                onChange={(evento) => setSenha(evento.target.value)}
                aria-invalid={erro?.campo === "senha"}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="cadastro-confirmacao">Confirmar senha</Label>
              <Input
                id="cadastro-confirmacao"
                type="password"
                autoComplete="new-password"
                value={confirmacao}
                onChange={(evento) => setConfirmacao(evento.target.value)}
                aria-invalid={erro?.campo === "confirmacao"}
                required
              />
            </div>

            <Button type="submit" disabled={pendente}>
              Continuar
            </Button>
          </form>
        ) : (
          <form onSubmit={enviarSegundaEtapa} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cadastro-nome">Nome completo</Label>
              <Input
                id="cadastro-nome"
                value={nomeCompleto}
                onChange={(evento) => setNomeCompleto(evento.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="cadastro-cpf">CPF</Label>
                <Input
                  id="cadastro-cpf"
                  inputMode="numeric"
                  value={cpf}
                  onChange={(evento) => setCpf(evento.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cadastro-rg">RG</Label>
                <Input id="cadastro-rg" value={rg} onChange={(e) => setRg(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cadastro-nascimento">Data de nascimento</Label>
                <Input
                  id="cadastro-nascimento"
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cadastro-celular">Celular</Label>
                <Input
                  id="cadastro-celular"
                  inputMode="tel"
                  value={celular}
                  onChange={(e) => setCelular(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cadastro-telefone">Telefone</Label>
                <Input
                  id="cadastro-telefone"
                  inputMode="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cadastro-cep">CEP</Label>
                <Input
                  id="cadastro-cep"
                  inputMode="numeric"
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="cadastro-logradouro">Endereço</Label>
              <Input
                id="cadastro-logradouro"
                value={logradouro}
                onChange={(e) => setLogradouro(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="cadastro-bairro">Bairro</Label>
                <Input
                  id="cadastro-bairro"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cadastro-cidade">Cidade</Label>
                <Input
                  id="cadastro-cidade"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cadastro-uf">UF</Label>
                <Input
                  id="cadastro-uf"
                  value={uf}
                  onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="cadastro-curso">Curso</Label>
                <Select value={cursoId} onValueChange={trocarCurso}>
                  <SelectTrigger id="cadastro-curso">
                    <SelectValue placeholder="Selecione o curso" />
                  </SelectTrigger>
                  <SelectContent>
                    {cursos.map((curso) => (
                      <SelectItem key={curso.id} value={curso.id}>
                        {curso.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="cadastro-turma">Turma</Label>
                <Select value={turmaId} onValueChange={setTurmaId} disabled={!cursoId}>
                  <SelectTrigger id="cadastro-turma">
                    <SelectValue placeholder="Selecione a turma" />
                  </SelectTrigger>
                  <SelectContent>
                    {turmasDoCurso.map((turma) => (
                      <SelectItem key={turma.id} value={turma.id}>
                        {turma.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="cadastro-periodo">Período</Label>
                <Select value={periodoId} onValueChange={setPeriodoId} disabled={!turmaId}>
                  <SelectTrigger id="cadastro-periodo">
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    {periodos.map((periodo) => (
                      <SelectItem key={periodo.id} value={periodo.id}>
                        {periodo.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pendente}>
                Concluir cadastro
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEtapa(1);
                  setErro(null);
                  setAviso(null);
                }}
              >
                Voltar para a primeira etapa
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
