"use client";

import * as React from "react";
import { useConsultaEndereco } from "@/hooks/use-consulta-endereco";
import { CampoTexto } from "@/components/formularios/campo";
import { CampoMascarado } from "@/components/formularios/campo-mascarado";
import { Button } from "@/components/ui/button";
import type { CampoDescriptor } from "@/lib/templates/descriptors";
import {
  enderecoDoGrupo,
  estruturaSuficiente,
  type GrupoEndereco,
} from "@/lib/templates/grupos-endereco";
import type { Endereco } from "@/lib/domain/types";
import { esquemaCep } from "@/lib/domain/schemas";

export function GrupoEnderecoFormulario({
  grupo,
  campos,
  valores,
  aoMudar,
  erros,
  desabilitado,
}: {
  grupo: GrupoEndereco;
  campos: CampoDescriptor[];
  valores: Record<string, unknown>;
  aoMudar: (alteracoes: Record<string, unknown>) => void;
  erros: Record<string, string>;
  desabilitado: boolean;
}) {
  const [editando, setEditando] = React.useState(false);
  const [erroCep, setErroCep] = React.useState<string | null>(null);
  const endereco = enderecoDoGrupo(grupo, valores);
  const consulta = useConsultaEndereco({
    valores: endereco,
    habilitado: editando && !desabilitado,
    aoMudar: (novos) => {
      aoMudar(
        Object.fromEntries(
          Object.entries(novos).map(([chave, valor]) => [
            grupo.campos[chave as keyof Endereco],
            valor,
          ]),
        ),
      );
    },
  });
  const legado =
    typeof valores[grupo.composto] === "string" ? (valores[grupo.composto] as string) : "";

  return (
    <fieldset className="border-border flex min-w-0 flex-col gap-4 rounded-lg border p-4">
      <legend className="px-1 text-base font-semibold">{grupo.rotulo}</legend>
      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={desabilitado}
        aria-expanded={editando}
        onClick={() => setEditando(true)}
      >
        Alterar endereço
      </Button>
      {legado && !estruturaSuficiente(endereco) ? (
        <CampoTexto
          id={grupo.composto}
          rotulo="Endereço anterior"
          valor={legado}
          disabled={!editando || desabilitado}
          descricao="Preservado até completar logradouro e número. Transcreva número e complemento para os campos abaixo; a consulta não preenche esses dados."
          aoMudar={(valor) => aoMudar({ [grupo.composto]: valor })}
          erro={erros[grupo.composto]}
        />
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(Object.entries(grupo.campos) as [keyof Endereco, string][]).map(([chave, id]) => {
          const campo = campos.find((c) => c.id === id)!;
          if (chave === "cep")
            return (
              <CampoMascarado
                key={id}
                id={id}
                rotulo="CEP"
                mascara="cep"
                valor={endereco.cep}
                obrigatorio={campo.obrigatorio}
                disabled={!editando || desabilitado}
                erro={erros[id] ?? erroCep}
                aoMudar={(valor) => {
                  setErroCep(null);
                  consulta.mudar("cep", valor);
                }}
                aoSair={() =>
                  setErroCep(
                    endereco.cep && !esquemaCep.safeParse(endereco.cep).success
                      ? "O CEP deve ter 8 dígitos."
                      : null,
                  )
                }
                acao={
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!editando || desabilitado}
                    onClick={() => void consulta.consultar()}
                  >
                    Consultar CEP
                  </Button>
                }
              />
            );
          return (
            <CampoTexto
              key={id}
              id={id}
              rotulo={campo.rotulo}
              valor={endereco[chave] ?? ""}
              obrigatorio={campo.obrigatorio}
              disabled={!editando || desabilitado}
              erro={erros[id]}
              maxLength={chave === "estado" ? 2 : undefined}
              aoMudar={(valor) =>
                consulta.mudar(chave, chave === "estado" ? valor.toUpperCase() : valor)
              }
            />
          );
        })}
      </div>
      <p role="status" aria-atomic="true" className="text-muted-foreground text-sm">
        {editando && !desabilitado ? consulta.mensagem : ""}
      </p>
      {erros[grupo.composto] && !legado ? (
        <p className="text-destructive text-sm">{erros[grupo.composto]}</p>
      ) : null}
    </fieldset>
  );
}
