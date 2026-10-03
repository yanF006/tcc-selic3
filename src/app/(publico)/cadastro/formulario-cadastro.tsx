"use client";

import * as React from "react";

import {
  CampoSenha,
  CampoTexto,
  LegendaObrigatorios,
  MensagemCampo,
  RotuloCampo,
} from "@/components/formularios/campo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
 *
 * Cada campo obrigatório é marcado com `*`, a senha pode ser exibida enquanto é
 * digitada e o e-mail mostra se o formato está válido. Matrícula registrada
 * libera o cadastro; matrícula desconhecida leva à espera pela autorização.
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
  const [confirmacaoTocada, setConfirmacaoTocada] = React.useState(false);

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

  /** Mensagem do servidor para o campo correspondente, quando houver. */
  function erroDoCampo(campo: string): string | null {
    return erro?.campo === campo ? erro.texto : null;
  }

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
              ? "Sua matrícula ainda não está registrada no sistema, então o cadastro ficou pendente até a conferência da coordenação."
              : "Sua matrícula está registrada no sistema e o acesso já está liberado."}
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
            ? "Primeira etapa: matrícula, e-mail e senha."
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

        <LegendaObrigatorios />

        {etapa === 1 ? (
          <form onSubmit={enviarPrimeiraEtapa} className="mt-4 flex flex-col gap-4">
            <CampoTexto
              id="cadastro-matricula"
              rotulo="Matrícula"
              obrigatorio
              descricao="Os 10 dígitos da matrícula do SIGAA."
              inputMode="numeric"
              maxLength={10}
              placeholder="2023100457"
              valor={matricula}
              aoMudar={setMatricula}
              erro={erroDoCampo("matricula")}
            />

            <CampoTexto
              id="cadastro-email"
              rotulo="E-mail"
              obrigatorio
              tipo="email"
              autoComplete="email"
              placeholder="nome@aluno.ifrj.edu.br"
              valor={email}
              aoMudar={setEmail}
              erro={erroDoCampo("email")}
            />

            <CampoSenha
              id="cadastro-senha"
              rotulo="Senha"
              obrigatorio
              autoComplete="new-password"
              descricao="Mínimo de 8 caracteres."
              conferirMinimo
              valor={senha}
              aoMudar={setSenha}
              erro={erroDoCampo("senha")}
            />

            <CampoSenha
              id="cadastro-confirmacao"
              rotulo="Confirmar senha"
              obrigatorio
              nomeVisibilidade="a confirmação"
              autoComplete="new-password"
              valor={confirmacao}
              aoMudar={(valor) => {
                setConfirmacao(valor);
                setConfirmacaoTocada(true);
              }}
              erro={
                erroDoCampo("confirmacao") ??
                (confirmacaoTocada && confirmacao.length > 0 && confirmacao !== senha
                  ? "A confirmação não bate com a senha."
                  : null)
              }
            />

            <Button type="submit" disabled={pendente}>
              Continuar
            </Button>
          </form>
        ) : (
          <form onSubmit={enviarSegundaEtapa} className="mt-4 flex flex-col gap-4">
            <CampoTexto
              id="cadastro-nome"
              rotulo="Nome completo"
              obrigatorio
              autoComplete="name"
              valor={nomeCompleto}
              aoMudar={setNomeCompleto}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto
                id="cadastro-cpf"
                rotulo="CPF"
                obrigatorio
                inputMode="numeric"
                valor={cpf}
                aoMudar={setCpf}
              />
              <CampoTexto id="cadastro-rg" rotulo="RG" valor={rg} aoMudar={setRg} />
              <CampoTexto
                id="cadastro-nascimento"
                rotulo="Data de nascimento"
                obrigatorio
                tipo="date"
                valor={dataNascimento}
                aoMudar={setDataNascimento}
              />
              <CampoTexto
                id="cadastro-celular"
                rotulo="Celular"
                inputMode="tel"
                valor={celular}
                aoMudar={setCelular}
              />
              <CampoTexto
                id="cadastro-telefone"
                rotulo="Telefone"
                inputMode="tel"
                valor={telefone}
                aoMudar={setTelefone}
              />
              <CampoTexto
                id="cadastro-cep"
                rotulo="CEP"
                inputMode="numeric"
                valor={cep}
                aoMudar={setCep}
              />
            </div>

            <CampoTexto
              id="cadastro-logradouro"
              rotulo="Endereço"
              obrigatorio
              autoComplete="street-address"
              valor={logradouro}
              aoMudar={setLogradouro}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <CampoTexto
                id="cadastro-bairro"
                rotulo="Bairro"
                obrigatorio
                valor={bairro}
                aoMudar={setBairro}
              />
              <CampoTexto
                id="cadastro-cidade"
                rotulo="Cidade"
                obrigatorio
                valor={cidade}
                aoMudar={setCidade}
              />
              <CampoTexto
                id="cadastro-uf"
                rotulo="UF"
                obrigatorio
                maxLength={2}
                valor={uf}
                aoMudar={(valor) => setUf(valor.toUpperCase().slice(0, 2))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <RotuloCampo htmlFor="cadastro-curso" obrigatorio>
                  Curso
                </RotuloCampo>
                <Select value={cursoId} onValueChange={trocarCurso}>
                  <SelectTrigger id="cadastro-curso" aria-required="true">
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
                {erroDoCampo("dados") ? (
                  <MensagemCampo id="cadastro-curso-mensagem" tipo="erro">
                    {erro?.texto}
                  </MensagemCampo>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <RotuloCampo htmlFor="cadastro-turma" obrigatorio>
                  Turma
                </RotuloCampo>
                <Select value={turmaId} onValueChange={setTurmaId} disabled={!cursoId}>
                  <SelectTrigger id="cadastro-turma" aria-required="true">
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
                <RotuloCampo htmlFor="cadastro-periodo" obrigatorio>
                  Período
                </RotuloCampo>
                <Select value={periodoId} onValueChange={setPeriodoId} disabled={!turmaId}>
                  <SelectTrigger id="cadastro-periodo" aria-required="true">
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
