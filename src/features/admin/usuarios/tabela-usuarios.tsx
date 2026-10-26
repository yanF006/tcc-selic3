"use client";

import * as React from "react";

import { CampoTexto, LegendaObrigatorios, RotuloCampo } from "@/components/formularios/campo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, EyeIcon, MoreVerticalIcon, UserPlusIcon } from "lucide-react";

import { metadadoUsuario, rotuloPapel, varianteSituacaoUsuario } from "@/lib/domain/status";
import { cursoDoUsuario } from "@/lib/domain/usuario";
import type { Papel, Usuario } from "@/lib/domain/types";

import { PerfilUsuario } from "@/features/admin/usuarios/perfil-usuario";

import {
  cadastrarUsuarioAction,
  editarUsuarioAction,
  excluirUsuarioAction,
  inativarUsuarioAction,
  reativarUsuarioAction,
} from "@/app/(admin)/admin/usuarios/acoes";

/**
 * Lista de usuários (8.2, 8.3): filtro por papel, situação e curso, busca por
 * nome, e-mail ou matrícula, total de resultados, perfil completo e as mutações
 * de criar, editar, inativar e excluir. Toda escrita passa por Server Action com
 * guarda de papel.
 */

interface Props {
  usuarios: Usuario[];
  total: number;
  cursos: { id: string; nome: string }[];
  turmas: { id: string; nome: string }[];
  periodos: { id: string; rotulo: string }[];
  situacoes: { situacao: Usuario["situacao"]; total: number }[];
}

const PAPEIS_FILTRO: { valor: string; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos os papéis" },
  { valor: "aluno", rotulo: "Aluno" },
  { valor: "coordenador_estagio", rotulo: "Coordenador de Estágio" },
  { valor: "coordenador_curso", rotulo: "Coordenador de Curso" },
  { valor: "administrador", rotulo: "Administrador" },
];

const SITUACOES_FILTRO: { valor: string; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas as situações" },
  { valor: "ativo", rotulo: "Ativo" },
  { valor: "pendente", rotulo: "Pendente" },
  { valor: "inativo", rotulo: "Inativo" },
];

export function TabelaUsuarios({ usuarios, total, cursos, turmas, periodos, situacoes }: Props) {
  const [busca, setBusca] = React.useState("");
  const [consulta, setConsulta] = React.useState("");
  const [papel, setPapel] = React.useState("todos");
  const [situacao, setSituacao] = React.useState("todas");
  const [curso, setCurso] = React.useState("todos");
  const [pagina, setPagina] = React.useState(1);
  const [formularioAberto, setFormularioAberto] = React.useState(false);
  const [editando, setEditando] = React.useState<Usuario | null>(null);
  const ultimoGatilho = React.useRef<HTMLElement | null>(null);
  const [perfil, setPerfil] = React.useState<Usuario | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);

  const tamanho = 10;
  const filtrados = React.useMemo(() => {
    const alvo = consulta.trim().toLowerCase();

    return usuarios.filter((usuario) => {
      if (papel !== "todos" && !usuario.papeis.includes(papel as Papel)) return false;
      if (situacao !== "todas" && usuario.situacao !== situacao) return false;
      if (curso !== "todos" && cursoDoUsuario(usuario) !== curso) return false;
      if (!alvo) return true;

      return (
        usuario.nome.toLowerCase().includes(alvo) ||
        usuario.email.toLowerCase().includes(alvo) ||
        (usuario.matricula ?? "").includes(alvo)
      );
    });
  }, [consulta, curso, papel, situacao, usuarios]);

  const paginaAtual = Math.min(pagina, Math.max(1, Math.ceil(filtrados.length / tamanho)));
  const visiveis = filtrados.slice((paginaAtual - 1) * tamanho, paginaAtual * tamanho);

  function buscar(evento: React.FormEvent) {
    evento.preventDefault();
    setConsulta(busca);
    setPagina(1);
  }

  function limpar() {
    setBusca("");
    setConsulta("");
    setPapel("todos");
    setSituacao("todas");
    setCurso("todos");
    setPagina(1);
  }

  async function executar(acao: () => Promise<{ ok: boolean; erro?: string }>, sucesso: string) {
    setErro(null);
    const resultado = await acao();

    if (!resultado.ok) {
      setErro(resultado.erro ?? "Não foi possível concluir a operação.");
      return;
    }

    setAviso(sucesso);
  }

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-wrap items-end gap-3" onSubmit={buscar}>
        <div className="flex min-w-64 flex-1 flex-col gap-2">
          <Label htmlFor="busca">Buscar por nome, e-mail ou matrícula</Label>
          <Input
            id="busca"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Ex.: Maria"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-papel">Papel</Label>
          <Select
            value={papel}
            onValueChange={(valor) => {
              setPapel(valor);
              setPagina(1);
            }}
          >
            <SelectTrigger id="filtro-papel" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAPEIS_FILTRO.map((opcao) => (
                <SelectItem key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-situacao">Situação</Label>
          <Select
            value={situacao}
            onValueChange={(valor) => {
              setSituacao(valor);
              setPagina(1);
            }}
          >
            <SelectTrigger id="filtro-situacao" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SITUACOES_FILTRO.map((opcao) => (
                <SelectItem key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-curso">Curso</Label>
          <Select
            value={curso}
            onValueChange={(valor) => {
              setCurso(valor);
              setPagina(1);
            }}
          >
            <SelectTrigger id="filtro-curso" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os cursos</SelectItem>
              {cursos.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.nome}
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

        <Button
          type="button"
          className="ml-auto"
          onClick={() => {
            ultimoGatilho.current = document.activeElement as HTMLElement;
            setEditando(null);
            setFormularioAberto(true);
          }}
        >
          <UserPlusIcon className="size-4" aria-hidden="true" />
          Novo usuário
        </Button>
      </form>

      {erro ? (
        <Alert variant="destructive" role="alert">
          <AlertCircleIcon className="size-4" aria-hidden="true" />
          <AlertTitle>Operação recusada</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      ) : null}

      {aviso ? (
        <Alert role="status">
          <AlertTitle>Concluído</AlertTitle>
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      ) : null}

      <p className="text-muted-foreground text-sm" data-testid="total-usuarios">
        {filtrados.length === 0
          ? "Nenhum usuário encontrado com os filtros informados."
          : `${filtrados.length} de ${total} usuário(s) encontrado(s).`}
      </p>

      <div className="border-border overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papéis</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.map((usuario) => (
              <TableRow key={usuario.id} data-usuario-id={usuario.id}>
                <TableCell className="font-medium">{usuario.nome}</TableCell>
                <TableCell>{usuario.email}</TableCell>
                <TableCell className="flex flex-wrap gap-1">
                  {usuario.papeis.map((papelUsuario) => (
                    <Badge key={papelUsuario} variant="outline">
                      {rotuloPapel(papelUsuario)}
                    </Badge>
                  ))}
                </TableCell>
                <TableCell>
                  <Badge variant={varianteSituacaoUsuario(usuario.situacao)}>
                    {metadadoUsuario(usuario.situacao).rotulo}
                  </Badge>
                </TableCell>
                <TableCell>
                  {cursos.find((item) => item.id === cursoDoUsuario(usuario))?.nome ?? "—"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Ações de ${usuario.nome}`}>
                        <MoreVerticalIcon className="size-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => {
                          ultimoGatilho.current = document.activeElement as HTMLElement;
                          setPerfil(usuario);
                        }}
                      >
                        <EyeIcon className="size-4 shrink-0" aria-hidden="true" />
                        Ver perfil completo
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          ultimoGatilho.current = document.activeElement as HTMLElement;
                          setEditando(usuario);
                          setFormularioAberto(true);
                        }}
                      >
                        Editar cadastro
                      </DropdownMenuItem>
                      {usuario.situacao === "inativo" ? (
                        <DropdownMenuItem
                          onSelect={() =>
                            executar(
                              () => reativarUsuarioAction(usuario.id),
                              `Acesso de ${usuario.nome} reativado.`,
                            )
                          }
                        >
                          Reativar acesso
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onSelect={() =>
                            executar(
                              () => inativarUsuarioAction(usuario.id),
                              `Acesso de ${usuario.nome} inativado; os registros foram preservados.`,
                            )
                          }
                        >
                          Inativar acesso
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={() =>
                          executar(
                            () => excluirUsuarioAction(usuario.id),
                            `Cadastro de ${usuario.nome} excluído.`,
                          )
                        }
                      >
                        Excluir cadastro
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filtrados.length > tamanho ? (
        <nav aria-label="Paginação de usuários" className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={paginaAtual === 1}
            onClick={() => setPagina(paginaAtual - 1)}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground text-sm">
            Página {paginaAtual} de {Math.ceil(filtrados.length / tamanho)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={paginaAtual === Math.ceil(filtrados.length / tamanho)}
            onClick={() => setPagina(paginaAtual + 1)}
          >
            Próxima
          </Button>
        </nav>
      ) : null}

      <dl className="flex flex-wrap gap-4 text-sm">
        {situacoes.map((item) => (
          <div key={item.situacao} className="flex items-center gap-2">
            <dt className="text-muted-foreground">{metadadoUsuario(item.situacao).rotulo}</dt>
            <dd className="font-medium">{item.total}</dd>
          </div>
        ))}
      </dl>

      <FormularioUsuario
        // A key remonta o formulário a cada cadastro editado, sem efeito.
        key={editando?.id ?? "novo"}
        aberto={formularioAberto}
        aoFechar={() => setFormularioAberto(false)}
        usuario={editando}
        cursos={cursos}
        gatilhoRef={ultimoGatilho}
      />

      <PerfilUsuario
        usuario={perfil}
        aberto={Boolean(perfil)}
        aoFechar={() => setPerfil(null)}
        cursos={cursos}
        turmas={turmas}
        periodos={periodos}
        gatilhoRef={ultimoGatilho}
      />
    </div>
  );
}

function FormularioUsuario({
  aberto,
  aoFechar,
  usuario,
  cursos,
  gatilhoRef,
}: {
  aberto: boolean;
  aoFechar: () => void;
  usuario: Usuario | null;
  cursos: { id: string; nome: string }[];
  gatilhoRef: React.RefObject<HTMLElement | null>;
}) {
  const editando = Boolean(usuario);
  const [nome, setNome] = React.useState(usuario?.nome ?? "");
  const [email, setEmail] = React.useState(usuario?.email ?? "");
  const [matricula, setMatricula] = React.useState(usuario?.matricula ?? "");
  const [papel, setPapel] = React.useState<Papel | "">(usuario?.papeis[0] ?? "");
  const [cursoId, setCursoId] = React.useState(usuario?.cursoId ?? "");
  const [erro, setErro] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);

  async function confirmar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);

    if (!papel) {
      setEnviando(false);
      setErro("Escolha o papel antes de concluir o cadastro.");

      return;
    }

    const cadastro = {
      nome,
      email,
      matricula: matricula || undefined,
      papeis: [papel] as Papel[],
      cursoId: papel === "coordenador_curso" ? cursoId || undefined : undefined,
    };

    const resultado =
      editando && usuario
        ? await editarUsuarioAction(usuario.id, cadastro)
        : await cadastrarUsuarioAction(cadastro);

    setEnviando(false);

    if (!resultado.ok) {
      setErro(resultado.erro ?? "Não foi possível salvar.");
      return;
    }

    aoFechar();
  }

  return (
    <Dialog open={aberto} onOpenChange={(estado) => (estado ? null : aoFechar())}>
      <DialogContent
        className="sm:max-w-lg"
        onCloseAutoFocus={(evento) => {
          evento.preventDefault();
          gatilhoRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{editando ? "Editar usuário" : "Novo usuário"}</DialogTitle>
          <DialogDescription>
            {editando
              ? "Altere nome, e-mail, papel e curso. A matrícula do aluno é imutável."
              : "O campus é fixo em Pinheiral e o papel define o que a pessoa enxerga."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={confirmar}>
          <LegendaObrigatorios />

          <CampoTexto
            id="usuario-nome"
            rotulo="Nome"
            obrigatorio
            autoComplete="off"
            valor={nome}
            aoMudar={setNome}
          />

          <CampoTexto
            id="usuario-email"
            rotulo="E-mail"
            obrigatorio
            tipo="email"
            autoComplete="off"
            valor={email}
            aoMudar={setEmail}
          />

          <div className="flex flex-col gap-2">
            <RotuloCampo htmlFor="usuario-papel" obrigatorio>
              Papel
            </RotuloCampo>
            {/*
              Sem `required` no Radix Select: dentro de `<form>` ele renderiza um
              `<select>` nativo oculto e o navegador bloquearia o envio sem
              mensagem. A obrigatoriedade é validada em `confirmar`.
            */}
            <Select value={papel} onValueChange={(valor) => setPapel(valor as Papel)}>
              <SelectTrigger id="usuario-papel" aria-required="true">
                <SelectValue placeholder="Selecione o papel" />
              </SelectTrigger>
              <SelectContent>
                {PAPEIS_FILTRO.slice(1).map((opcao) => (
                  <SelectItem key={opcao.valor} value={opcao.valor}>
                    {opcao.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {papel === "aluno" ? (
            <CampoTexto
              id="usuario-matricula"
              rotulo="Matrícula"
              obrigatorio
              inputMode="numeric"
              maxLength={11}
              descricao="Ao salvar, a matrícula é registrada automaticamente se ainda não existir."
              valor={matricula}
              aoMudar={setMatricula}
              disabled={editando}
            />
          ) : null}

          {papel === "coordenador_curso" ? (
            <div className="flex flex-col gap-2">
              <RotuloCampo htmlFor="usuario-curso" obrigatorio>
                Curso
              </RotuloCampo>
              <Select value={cursoId} onValueChange={setCursoId}>
                <SelectTrigger id="usuario-curso">
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
          ) : null}

          {erro ? (
            <Alert variant="destructive" role="alert">
              <AlertCircleIcon className="size-4" aria-hidden="true" />
              <AlertTitle>Cadastro recusado</AlertTitle>
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
