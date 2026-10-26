"use client";

import { InfoIcon } from "lucide-react";

import { CampoDescritor, LarguraCampo } from "@/components/documentos/campo-descritor";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  classificacaoDoCampo,
  fonteParecer,
  type CampoDescriptor,
} from "@/lib/templates/descriptors";
import type { DescriptorDocumento } from "@/lib/templates/descriptors";
import { idsDoGrupo } from "@/lib/templates/grupos-endereco";
import { GrupoEnderecoFormulario } from "./grupo-endereco-formulario";

/**
 * Formulário dirigido pelo descritor (8.5). Recebe os valores como estado
 * controlado e devolve cada alteração por `aoMudar`, de modo que a mesma peça
 * sirva para o preenchimento do aluno, o registro da coordenação e a página de
 * laboratório. A ordem, os rótulos e os tipos vêm do descritor; nada aqui
 * conhece um documento específico.
 */

export interface FormularioDocumentoProps {
  descriptor: DescriptorDocumento;
  valores: Record<string, unknown>;
  aoMudar: (campoId: string, valor: unknown) => void;
  aoMudarGrupo?: (alteracoes: Record<string, unknown>) => void;
  revisaoEndereco?: number;
  /** Erros de validação por campo, exibidos sob o respectivo controle. */
  erros?: Record<string, string>;
  desabilitado?: boolean;
}

function vazio(valor: unknown): boolean {
  return valor === undefined || valor === null || String(valor).trim() === "";
}

export function FormularioDocumento({
  descriptor,
  valores,
  aoMudar,
  aoMudarGrupo,
  revisaoEndereco = 0,
  erros = {},
  desabilitado = false,
}: FormularioDocumentoProps) {
  const grupos = descriptor.gruposEndereco ?? [];
  const idsEndereco = new Set(grupos.flatMap(idsDoGrupo));
  const automaticos = (descriptor.auto ?? []).filter(
    (campo) => !idsEndereco.has(campo.id) && !fonteParecer(descriptor.templateId, campo),
  );
  const todos = [...(descriptor.auto ?? []), ...descriptor.secoes.flatMap((s) => s.campos)];

  return (
    <div className="flex flex-col gap-8">
      {descriptor.observacao ? (
        <Alert variant="info">
          <InfoIcon aria-hidden="true" />
          <AlertTitle>Observação sobre este documento</AlertTitle>
          <AlertDescription>{descriptor.observacao}</AlertDescription>
        </Alert>
      ) : null}

      {automaticos.length > 0 ? (
        <SecaoFormulario titulo="Identificação (preenchida pelo sistema)">
          {automaticos.map((campo) => (
            <CampoDescritor
              key={campo.id}
              campo={campo}
              valor={valores[campo.id]}
              aoMudar={aoMudar}
              erro={erros[campo.id]}
              desabilitado
              pendente={vazio(valores[campo.id])}
            />
          ))}
        </SecaoFormulario>
      ) : null}

      {grupos.map((grupo) => (
        <GrupoEnderecoFormulario
          key={`${descriptor.templateId}-${grupo.id}-${revisaoEndereco}`}
          grupo={grupo}
          campos={todos}
          valores={valores}
          erros={erros}
          desabilitado={desabilitado}
          aoMudar={
            aoMudarGrupo ??
            ((novos) => {
              for (const [id, valor] of Object.entries(novos)) aoMudar(id, valor);
            })
          }
        />
      ))}

      {descriptor.secoes
        .filter(
          (secao) => descriptor.templateId !== "tpl-formulario-liberacao" || secao.id !== "parecer",
        )
        .map((secao) => (
          <SecaoFormulario key={secao.id} titulo={secao.titulo} descricao={secao.descricao}>
            {secao.campos
              .filter(
                (campo) =>
                  !idsEndereco.has(campo.id) && !fonteParecer(descriptor.templateId, campo),
              )
              .map((campo) => (
                <TrechoDaSecao
                  key={campo.id}
                  campo={campo}
                  valor={valores[campo.id]}
                  aoMudar={aoMudar}
                  erro={erros[campo.id]}
                  desabilitado={desabilitado}
                />
              ))}
          </SecaoFormulario>
        ))}
    </div>
  );
}

function SecaoFormulario({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <legend className="text-base font-semibold tracking-tight">{titulo}</legend>
        {descricao ? <p className="text-muted-foreground text-sm">{descricao}</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </fieldset>
  );
}

/** Campo, texto fixo ou instrução de preenchimento da seção. */
function TrechoDaSecao({
  campo,
  valor,
  aoMudar,
  erro,
  desabilitado,
}: {
  campo: CampoDescriptor;
  valor: unknown;
  aoMudar: (campoId: string, valor: unknown) => void;
  erro?: string;
  desabilitado: boolean;
}) {
  const classificacao = classificacaoDoCampo(campo);

  if (classificacao === "instrucao") {
    return (
      <Alert variant="info">
        <InfoIcon aria-hidden="true" />
        <AlertTitle>{campo.rotulo}</AlertTitle>
        <AlertDescription>{campo.ajuda}</AlertDescription>
      </Alert>
    );
  }

  if (classificacao === "fixo") {
    return (
      <LarguraCampo largura="completa">
        <div className="border-border bg-muted/40 rounded-md border px-3 py-2">
          <p className="text-foreground text-sm">{campo.ajuda ?? campo.rotulo}</p>
          <Badge variant="outline" className="mt-2">
            Texto fixo do documento
          </Badge>
        </div>
      </LarguraCampo>
    );
  }

  return (
    <CampoDescritor
      campo={campo}
      valor={valor}
      aoMudar={aoMudar}
      erro={erro}
      desabilitado={desabilitado}
      pendente={(campo.origem === "aluno" || campo.origem === "estagio") && vazio(valor)}
    />
  );
}
