"use client";

import * as React from "react";
import { useController } from "react-hook-form";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { LinhaMensagem, MensagemCampo, RotuloCampo } from "@/components/formularios/campo";
import { Input } from "@/components/ui/input";

import { MASCARAS, type NomeMascara } from "@/lib/mask";

import { cn } from "@/lib/utils";

interface CampoMascaradoProps {
  id: string;
  rotulo: string;
  /** Máscara aplicada enquanto a pessoa digita (D7). */
  mascara: NomeMascara;
  valor: string;
  aoMudar: (valor: string) => void;
  /** Disparado ao sair do campo: é onde a validação de formato acontece. */
  aoSair?: () => void;
  obrigatorio?: boolean;
  descricao?: string;
  /** Erro vindo do servidor ou da validação do formulário. */
  erro?: string | null;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  /** Nome enviado no FormData; por padrão, o mesmo do `id`. */
  name?: string;
  /** Controle à direita do campo, como o botão de busca do CEP. */
  acao?: React.ReactNode;
  className?: string;
}

/**
 * Campo de texto com máscara, controlado (D7, tarefa 6.1).
 *
 * A máscara é uma função pura de `lib/mask` aplicada no `onChange`: por isso
 * colar um valor já formatado, digitar rápido e colar de um e-mail funcionam
 * igual, e qualquer caractere fora do padrão é descartado no lugar de chegar
 * ao formulário. O campo guarda o valor **com** a máscara, porque é o que a
 * pessoa enxerga; quem valida recebe os esquemas de `lib/domain/schemas`, que
 * removem a máscara antes de conferir.
 *
 * A linha de mensagem fica reservada desde o começo (como no campo de e-mail)
 * para a mensagem que aparece no `blur` não empurrar o botão de envio.
 */
export function CampoMascarado({
  id,
  rotulo,
  mascara,
  valor,
  aoMudar,
  aoSair,
  obrigatorio = false,
  descricao,
  erro,
  placeholder,
  autoComplete,
  disabled,
  name,
  acao,
  className,
}: CampoMascaradoProps) {
  const idDescricao = descricao ? `${id}-descricao` : undefined;
  const idMensagem = `${id}-mensagem`;
  const descricoes = [idDescricao, erro ? idMensagem : null].filter(Boolean).join(" ");
  const aplicarMascara = MASCARAS[mascara];

  return (
    <div className="flex flex-col gap-2">
      <RotuloCampo htmlFor={id} obrigatorio={obrigatorio}>
        {rotulo}
      </RotuloCampo>

      {descricao ? (
        <p id={idDescricao} className="text-muted-foreground text-xs">
          {descricao}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Input
          id={id}
          name={name ?? id}
          value={valor}
          onChange={(evento) => aoMudar(aplicarMascara(evento.target.value))}
          onBlur={aoSair}
          inputMode="numeric"
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          required={obrigatorio}
          aria-required={obrigatorio || undefined}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descricoes || undefined}
          className={cn(acao && "flex-1", className)}
        />

        {acao}
      </div>

      <LinhaMensagem reservada vazia={!erro}>
        {erro ? (
          <MensagemCampo id={idMensagem} tipo="erro">
            {erro}
          </MensagemCampo>
        ) : null}
      </LinhaMensagem>
    </div>
  );
}

interface AdaptadorCampoMascaradoProps<TFieldValues extends FieldValues>
  extends Omit<CampoMascaradoProps, "valor" | "aoMudar" | "aoSair" | "name"> {
  control: Control<TFieldValues>;
  /** Nome do campo no formulário do React Hook Form. */
  name: FieldPath<TFieldValues>;
}

/**
 * O mesmo campo ligado ao React Hook Form: o `Controller` entrega o valor, a
 * escrita de volta e o erro do campo, e o `CampoMascarado` cuida da máscara.
 * É esse adaptador que os formulários de dados pessoais usam, para que a
 * máscara não precise ser repetida em cada formulário.
 */
export function AdaptadorCampoMascarado<TFieldValues extends FieldValues>({
  control,
  name,
  erro,
  ...campo
}: AdaptadorCampoMascaradoProps<TFieldValues>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <CampoMascarado
      {...campo}
      name={name}
      valor={typeof field.value === "string" ? field.value : ""}
      aoMudar={field.onChange}
      aoSair={field.onBlur}
      erro={erro ?? fieldState.error?.message ?? null}
    />
  );
}