"use client";

import * as React from "react";

import { CampoTexto, LegendaObrigatorios, RotuloCampo } from "@/components/formularios/campo";
import { CampoMascarado } from "@/components/formularios/campo-mascarado";
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

import { atualizarPerfilAction } from "@/app/(aluno)/perfil/acoes";
import {
  esquemaCep,
  esquemaCpf,
  esquemaData,
  esquemaRg,
  esquemaTelefone,
  esquemaCelular,
} from "@/lib/domain/schemas";
import { mensagemDeErro } from "@/lib/domain/validar-campo";
import { useConsultaEndereco } from "@/hooks/use-consulta-endereco";
import type { Curso, DadosPessoais, Periodo, Turma, Usuario } from "@/lib/domain/types";
import { periodosDoCurso } from "@/lib/domain/selecoes";

export function FormularioPerfil({
  usuario,
  dadosIniciais,
  cursos,
  turmas,
  periodos,
}: {
  usuario: Usuario;
  dadosIniciais: DadosPessoais | null;
  cursos: Curso[];
  turmas: Turma[];
  periodos: Periodo[];
}) {
  const [erro, setErro] = React.useState<{ campo?: string; texto: string } | null>(null);
  const [errosCampo, setErrosCampo] = React.useState<Record<string, string>>({});
  const [sucesso, setSucesso] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();

  const [nomeCompleto, setNomeCompleto] = React.useState(
    dadosIniciais?.nomeCompleto ?? usuario.nome,
  );
  const [email, setEmail] = React.useState(dadosIniciais?.email ?? usuario.email);
  const [cpf, setCpf] = React.useState(dadosIniciais?.cpf ?? "");
  const [rg, setRg] = React.useState(dadosIniciais?.rg ?? "");
  const [dataNascimento, setDataNascimento] = React.useState(dadosIniciais?.dataNascimento ?? "");
  const [telefone, setTelefone] = React.useState(dadosIniciais?.telefone ?? "");
  const [celular, setCelular] = React.useState(dadosIniciais?.celular ?? "");
  const [logradouro, setLogradouro] = React.useState(dadosIniciais?.endereco.logradouro ?? "");
  const [numero, setNumero] = React.useState(dadosIniciais?.endereco.numero ?? "");
  const [complemento, setComplemento] = React.useState(dadosIniciais?.endereco.complemento ?? "");
  const [bairro, setBairro] = React.useState(dadosIniciais?.endereco.bairro ?? "");
  const [cidade, setCidade] = React.useState(dadosIniciais?.endereco.cidade ?? "");
  const [uf, setUf] = React.useState(dadosIniciais?.endereco.estado ?? "RJ");
  const [cep, setCep] = React.useState(dadosIniciais?.endereco.cep ?? "");
  const [cursoId, setCursoId] = React.useState(dadosIniciais?.cursoId ?? "");
  const [turmaId, setTurmaId] = React.useState(dadosIniciais?.turmaId ?? "");
  const [periodoId, setPeriodoId] = React.useState(dadosIniciais?.periodoId ?? "");

  const consultaEndereco = useConsultaEndereco({
    valores: { cep, logradouro, numero, complemento, bairro, cidade, estado: uf },
    aoMudar: (valores) => {
      if (valores.cep !== undefined) setCep(valores.cep);
      if (valores.logradouro !== undefined) setLogradouro(valores.logradouro);
      if (valores.bairro !== undefined) setBairro(valores.bairro);
      if (valores.cidade !== undefined) setCidade(valores.cidade);
      if (valores.estado !== undefined) setUf(valores.estado);
    },
  });

  const cursosDisponiveis = cursos.filter(
    (curso) => curso.situacao === "ativo" || curso.id === dadosIniciais?.cursoId,
  );
  const turmasDoCurso = turmas.filter(
    (turma) =>
      turma.cursoId === cursoId &&
      (turma.situacao === "ativo" || turma.id === dadosIniciais?.turmaId),
  );
  const periodosDisponiveis = periodosDoCurso(
    cursoId,
    turmasDoCurso,
    periodos.filter(
      (periodo) =>
        periodo.situacao === "ativo" ||
        (cursoId === dadosIniciais?.cursoId && periodo.id === dadosIniciais?.periodoId),
    ),
    dadosIniciais?.turmaId,
  );

  function erroDoCampo(campo: string): string | null {
    if (erro?.campo === campo) return erro.texto;
    return errosCampo[campo] ?? null;
  }

  function conferirAoSair(
    campo: string,
    esquema: Parameters<typeof mensagemDeErro>[0],
    valor: string,
  ) {
    const mensagem = valor.trim().length === 0 ? null : mensagemDeErro(esquema, valor);
    setErrosCampo((atual) => {
      const proximo = { ...atual };
      if (mensagem) {
        proximo[campo] = mensagem;
      } else {
        delete proximo[campo];
      }
      return proximo;
    });
  }

  function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSucesso(null);

    iniciar(async () => {
      const resultado = await atualizarPerfilAction({
        nomeCompleto,
        email,
        cpf,
        rg,
        dataNascimento,
        telefone,
        celular,
        endereco: {
          logradouro,
          numero,
          complemento,
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
        setErro({ campo: Object.keys(resultado.erros)[0], texto: resultado.erro });
        setErrosCampo(resultado.erros);
        return;
      }

      consultaEndereco.invalidar();
      setSucesso(resultado.mensagem);
    });
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">Dados Pessoais e Perfil</h2>
        </CardTitle>
        <CardDescription>
          Mantenha seus dados atualizados. A matrícula é exibida em modo somente leitura.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sucesso ? (
          <Alert className="mb-4">
            <CheckCircle2Icon aria-hidden="true" />
            <AlertTitle>Sucesso</AlertTitle>
            <AlertDescription>{sucesso}</AlertDescription>
          </Alert>
        ) : null}

        {erro ? (
          <Alert variant="destructive" className="mb-4">
            <AlertCircleIcon aria-hidden="true" />
            <AlertTitle>Não foi possível salvar</AlertTitle>
            <AlertDescription>{erro.texto}</AlertDescription>
          </Alert>
        ) : null}

        <LegendaObrigatorios />

        <form onSubmit={salvar} className="mt-4 flex flex-col gap-4">
          <CampoTexto
            id="perfil-matricula"
            rotulo="Matrícula"
            descricao="Matrícula do SIGAA (somente leitura)."
            valor={usuario.matricula ?? ""}
            aoMudar={() => {}}
            disabled
          />

          <CampoTexto
            id="perfil-email"
            rotulo="E-mail"
            obrigatorio
            tipo="email"
            valor={email}
            aoMudar={setEmail}
            erro={erroDoCampo("email")}
          />

          <CampoTexto
            id="perfil-nome"
            rotulo="Nome completo"
            obrigatorio
            valor={nomeCompleto}
            aoMudar={setNomeCompleto}
            erro={erroDoCampo("nomeCompleto")}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoMascarado
              id="perfil-cpf"
              rotulo="CPF"
              obrigatorio
              mascara="cpf"
              valor={cpf}
              aoMudar={setCpf}
              aoSair={() => conferirAoSair("cpf", esquemaCpf, cpf)}
              erro={erroDoCampo("cpf")}
            />
            <CampoMascarado
              id="perfil-rg"
              rotulo="RG"
              mascara="rg"
              valor={rg}
              aoMudar={setRg}
              aoSair={() => conferirAoSair("rg", esquemaRg, rg)}
              erro={erroDoCampo("rg")}
            />
            <CampoMascarado
              id="perfil-nascimento"
              rotulo="Data de nascimento"
              obrigatorio
              mascara="data"
              valor={dataNascimento}
              aoMudar={setDataNascimento}
              aoSair={() => conferirAoSair("dataNascimento", esquemaData, dataNascimento)}
              erro={erroDoCampo("dataNascimento")}
            />
            <CampoMascarado
              id="perfil-celular"
              rotulo="Celular"
              obrigatorio
              mascara="celular"
              valor={celular}
              aoMudar={setCelular}
              aoSair={() => conferirAoSair("celular", esquemaCelular, celular)}
              erro={erroDoCampo("celular")}
            />
            <CampoMascarado
              id="perfil-telefone"
              rotulo="Telefone"
              mascara="telefone"
              valor={telefone}
              aoMudar={setTelefone}
              aoSair={() => conferirAoSair("telefone", esquemaTelefone, telefone)}
              erro={erroDoCampo("telefone")}
            />
            <CampoMascarado
              id="perfil-cep"
              rotulo="CEP"
              obrigatorio
              mascara="cep"
              valor={cep}
              aoMudar={(valor) => consultaEndereco.mudar("cep", valor)}
              aoSair={() => conferirAoSair("cep", esquemaCep, cep)}
              erro={erroDoCampo("cep")}
              acao={
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void consultaEndereco.consultar()}
                >
                  Buscar
                </Button>
              }
            />
          </div>

          <p role="status" aria-atomic="true" className="text-muted-foreground text-sm">
            {consultaEndereco.mensagem}
          </p>
          <CampoTexto
            id="perfil-logradouro"
            rotulo="Endereço"
            obrigatorio
            valor={logradouro}
            aoMudar={(valor) => consultaEndereco.mudar("logradouro", valor)}
            erro={erroDoCampo("endereco.logradouro")}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <CampoTexto
              id="perfil-numero"
              rotulo="Número"
              obrigatorio
              valor={numero}
              aoMudar={setNumero}
              erro={erroDoCampo("endereco.numero")}
            />
            <CampoTexto
              id="perfil-complemento"
              rotulo="Complemento"
              className="sm:col-span-2"
              valor={complemento}
              aoMudar={setComplemento}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <CampoTexto
              id="perfil-bairro"
              rotulo="Bairro"
              obrigatorio
              valor={bairro}
              aoMudar={(valor) => consultaEndereco.mudar("bairro", valor)}
              erro={erroDoCampo("endereco.bairro")}
            />
            <CampoTexto
              id="perfil-cidade"
              rotulo="Cidade"
              obrigatorio
              valor={cidade}
              aoMudar={(valor) => consultaEndereco.mudar("cidade", valor)}
              erro={erroDoCampo("endereco.cidade")}
            />
            <CampoTexto
              id="perfil-uf"
              rotulo="UF"
              obrigatorio
              maxLength={2}
              valor={uf}
              aoMudar={(valor) => consultaEndereco.mudar("estado", valor.toUpperCase().slice(0, 2))}
              erro={erroDoCampo("endereco.estado")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <RotuloCampo htmlFor="perfil-curso" obrigatorio>
                Curso
              </RotuloCampo>
              <Select value={cursoId} onValueChange={setCursoId}>
                <SelectTrigger id="perfil-curso">
                  <SelectValue placeholder="Selecione o curso" />
                </SelectTrigger>
                <SelectContent>
                  {cursosDisponiveis.map((curso) => (
                    <SelectItem key={curso.id} value={curso.id}>
                      {curso.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <RotuloCampo htmlFor="perfil-turma" obrigatorio>
                Turma
              </RotuloCampo>
              <Select value={turmaId} onValueChange={setTurmaId} disabled={!cursoId}>
                <SelectTrigger id="perfil-turma">
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
              <RotuloCampo htmlFor="perfil-periodo" obrigatorio>
                Período
              </RotuloCampo>
              <Select value={periodoId} onValueChange={setPeriodoId} disabled={!turmaId}>
                <SelectTrigger id="perfil-periodo">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  {periodosDisponiveis.map((periodo) => (
                    <SelectItem key={periodo.id} value={periodo.id}>
                      {periodo.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={pendente}>
            Salvar alterações
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
