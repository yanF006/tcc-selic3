"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatarData, formatarDataHora } from "@/lib/format";
import { Separator } from "@/components/ui/separator";

import { metadadoUsuario, rotuloPapel } from "@/lib/domain/status";
import { cursoDoUsuario } from "@/lib/domain/usuario";
import type { Endereco, Usuario } from "@/lib/domain/types";

/**
 * Perfil completo do usuário (11.4): a lista mostra o essentials e o perfil abre
 * tudo o que existe no cadastro — papel, matrícula, vínculo com o curso e os
 * dados pessoais informados.
 */

interface Props {
  usuario: Usuario | null;
  aberto: boolean;
  aoFechar: () => void;
  cursos: { id: string; nome: string }[];
  turmas: { id: string; nome: string }[];
  periodos: { id: string; rotulo: string }[];
}

export function PerfilUsuario({ usuario, aberto, aoFechar, cursos, turmas, periodos }: Props) {
  const nome = (lista: { id: string; nome: string }[], id?: string) =>
    lista.find((item) => item.id === id)?.nome ?? "—";
  const rotulo = (lista: { id: string; rotulo: string }[], id?: string) =>
    lista.find((item) => item.id === id)?.rotulo ?? "—";

  return (
    <Dialog open={aberto} onOpenChange={(estado) => (estado ? null : aoFechar())}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        {usuario ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {usuario.nome}
                <Badge variant={metadadoUsuario(usuario.situacao).variante}>
                  {metadadoUsuario(usuario.situacao).rotulo}
                </Badge>
              </DialogTitle>
              <DialogDescription>{metadadoUsuario(usuario.situacao).descricao}</DialogDescription>
            </DialogHeader>

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Acesso</h3>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Campo rotulo="E-mail" valor={usuario.email} />
                <Campo rotulo="Matrícula" valor={usuario.matricula ?? "Não informada"} mono />
                <Campo rotulo="Campus" valor={usuario.campus} />
                <Campo
                  rotulo="Membro da Comissão de Estágio"
                  valor={usuario.membroComissaoEstagio ? "Sim" : "Não"}
                />
                <Campo
                  rotulo="Curso"
                  valor={nome(cursos, cursoDoUsuario(usuario) ?? usuario.cursoId)}
                />
                <Campo rotulo="Turma" valor={nome(turmas, usuario.dadosPessoais?.turmaId)} />
                <Campo
                  rotulo="Período"
                  valor={rotulo(periodos, usuario.dadosPessoais?.periodoId)}
                />
                <Campo rotulo="Cadastrado em" valor={formatarDataHora(usuario.criadoEm)} />
              </dl>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-sm">Papéis:</span>
                {usuario.papeis.map((papel) => (
                  <Badge key={papel} variant="outline">
                    {rotuloPapel(papel)}
                  </Badge>
                ))}
              </div>
            </section>

            <Separator />

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Dados pessoais</h3>

              {usuario.dadosPessoais ? (
                <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <Campo rotulo="Nome completo" valor={usuario.dadosPessoais.nomeCompleto} />
                  <Campo rotulo="CPF" valor={usuario.dadosPessoais.cpf || "—"} mono />
                  <Campo rotulo="RG" valor={usuario.dadosPessoais.rg || "—"} mono />
                  <Campo
                    rotulo="Data de nascimento"
                    valor={formatarData(usuario.dadosPessoais.dataNascimento)}
                  />
                  <Campo rotulo="Telefone" valor={usuario.dadosPessoais.telefone || "—"} mono />
                  <Campo rotulo="Celular" valor={usuario.dadosPessoais.celular || "—"} mono />
                  <Campo
                    rotulo="Endereço"
                    valor={endereco(usuario.dadosPessoais.endereco)}
                    className="sm:col-span-2"
                  />
                </dl>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Este cadastro não possui dados pessoais informados.
                </p>
              )}
            </section>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  rotulo,
  valor,
  mono,
  className,
}: {
  rotulo: string;
  valor: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-muted-foreground text-xs">{rotulo}</dt>
      <dd className={mono ? "font-mono text-sm" : "text-sm font-medium break-words"}>{valor}</dd>
    </div>
  );
}

function endereco(valor: Endereco): string {
  const partes = [
    valor.logradouro,
    valor.bairro,
    `${valor.cidade}/${valor.estado}`,
    valor.cep,
  ].filter(Boolean);

  return partes.length > 0 ? partes.join(" · ") : "—";
}
