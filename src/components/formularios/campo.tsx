"use client";

import * as React from "react";

import { AlertCircleIcon, CheckCircle2Icon, EyeIcon, EyeOffIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { esquemaEmail, esquemaSenha } from "@/lib/domain/schemas";

/**
 * Peças de formulário compartilhadas pelo login, pelo cadastro público e pela
 * administração.
 *
 * Três garantias vêm daqui, em vez de serem repetidas campo a campo:
 *
 * - **obrigatoriedade visível**: todo campo obrigatório mostra `*` ao lado do
 *   rótulo e recebe `aria-required`, sem alterar o nome acessível do campo;
 * - **erro no próprio campo**: a mensagem fica ligada ao input por
 *   `aria-describedby`, com ícone e texto — cor nunca é o único indicador;
 * - **conferência de formato**: e-mail e senha mostram o resultado da validação
 *   enquanto a pessoa digita, depois do primeiro `blur`.
 */

export type TipoMensagem = "erro" | "sucesso";

interface RotuloCampoProps {
  htmlFor: string;
  children: React.ReactNode;
  /** `true` marca o campo como obrigatório. */
  obrigatorio?: boolean;
}

/**
 * Rótulo com marcador de obrigatoriedade. O `*` fica **fora** do `<Label>` para
 * não alterar o texto do rótulo lido por leitores de tela e por seletores de
 * teste; a obrigatoriedade é anunciada por `aria-required` no controle.
 */
export function RotuloCampo({ htmlFor, children, obrigatorio = false }: RotuloCampoProps) {
  return (
    <div className="flex items-center gap-1">
      <Label htmlFor={htmlFor}>{children}</Label>
      {obrigatorio ? (
        <span aria-hidden="true" className="text-destructive text-base leading-none">
          *
        </span>
      ) : null}
    </div>
  );
}

interface MensagemCampoProps {
  id: string;
  tipo: TipoMensagem;
  children: React.ReactNode;
  /** `invisible` reserva a altura da linha sem exibir nada. */
  className?: string;
}

/** Mensagem de erro ou sucesso ligada ao campo por `aria-describedby`. */
export function MensagemCampo({ id, tipo, children, className }: MensagemCampoProps) {
  const Icone = tipo === "erro" ? AlertCircleIcon : CheckCircle2Icon;

  return (
    <p
      id={id}
      className={cn(
        "flex items-start gap-1 text-xs",
        tipo === "erro" ? "text-destructive" : "text-success",
        className,
      )}
    >
      <Icone className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

interface LinhaMensagemProps {
  /** `true` quando o campo confere o formato: a linha fica reservada desde o início. */
  reservada: boolean;
  /** `true` quando não há mensagem: a linha reservada fica invisível. */
  vazia: boolean;
  children: React.ReactNode;
}

/**
 * Linha de mensagem do campo.
 *
 * Quando o campo pode conferir o formato, a linha é **reservada desde o começo**,
 * só que invisível. Sem isso, a mensagem que aparece no `blur` empurra o botão
 * de envio para baixo: o `mousedown` cai no botão, o `mouseup` já cai no
 * formulário e o navegador descarta o clique — quem digita o e-mail e clica em
 * "Enviar" teria de clicar duas vezes. Reservar a linha evita o deslocamento.
 */
export function LinhaMensagem({ reservada, vazia, children }: LinhaMensagemProps) {
  if (!reservada) {
    return <>{children}</>;
  }

  return (
    <div className={cn(vazia && "invisible")}>
      {vazia ? <span className="text-xs">{"\u00a0"}</span> : children}
    </div>
  );
}

/** Legenda que explica o marcador de obrigatoriedade uma única vez por formulário. */
export function LegendaObrigatorios() {
  return (
    <p className="text-muted-foreground text-xs">
      Campos com <span className="text-destructive">*</span> são obrigatórios.
    </p>
  );
}

interface CampoTextoProps {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  obrigatorio?: boolean;
  descricao?: string;
  tipo?: React.HTMLInputTypeAttribute;
  autoComplete?: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  /** Erro vindo do servidor, exibido abaixo do campo. */
  erro?: string | null;
  /** Nome enviado no FormData; por padrão, o mesmo do `id`. */
  name?: string;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
}

/**
 * Campo de texto com conferência de formato para e-mail e senha de texto livre.
 * A validação só aparece depois do primeiro `blur` (ou quando há erro do
 * servidor), para não corrigir a pessoa enquanto ela ainda digita.
 */
export function CampoTexto({
  id,
  rotulo,
  valor,
  aoMudar,
  obrigatorio = false,
  descricao,
  tipo = "text",
  autoComplete,
  placeholder,
  inputMode,
  erro,
  name,
  disabled,
  maxLength,
  className,
}: CampoTextoProps) {
  const [tocado, setTocado] = React.useState(false);
  const idDescricao = descricao ? `${id}-descricao` : undefined;
  const idMensagem = `${id}-mensagem`;
  const idFormatado = `${id}-formato`;

  const emailInvalido =
    tipo === "email" && tocado && valor.trim().length > 0 && !esquemaEmail.safeParse(valor).success;
  const emailValido = tipo === "email" && tocado && valor.trim().length > 0 && !emailInvalido;

  const confereFormato = tipo === "email";

  const mensagemFormato =
    !erro && emailInvalido ? (
      <MensagemCampo id={idMensagem} tipo="erro">
        Formato de e-mail inválido. Use nome@dominio.
      </MensagemCampo>
    ) : !erro && emailValido ? (
      <MensagemCampo id={idFormatado} tipo="sucesso">
        Formato de e-mail válido.
      </MensagemCampo>
    ) : null;

  const descricoes = [
    idDescricao,
    erro || emailInvalido ? idMensagem : null,
    emailValido ? idFormatado : null,
  ]
    .filter(Boolean)
    .join(" ");

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

      <Input
        id={id}
        name={name ?? id}
        type={tipo}
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
        onBlur={() => setTocado(true)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        inputMode={inputMode}
        disabled={disabled}
        maxLength={maxLength}
        required={obrigatorio}
        aria-required={obrigatorio || undefined}
        aria-invalid={erro || emailInvalido ? true : undefined}
        aria-describedby={descricoes || undefined}
        className={className}
      />

      {erro ? (
        <MensagemCampo id={idMensagem} tipo="erro">
          {erro}
        </MensagemCampo>
      ) : null}

      <LinhaMensagem reservada={confereFormato} vazia={mensagemFormato === null}>
        {mensagemFormato}
      </LinhaMensagem>
    </div>
  );
}

interface CampoSenhaProps {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  obrigatorio?: boolean;
  descricao?: string;
  autoComplete?: string;
  /** Erro vindo do servidor, exibido abaixo do campo. */
  erro?: string | null;
  /** true no cadastro: confere o tamanho mínimo de 8 caracteres. */
  conferirMinimo?: boolean;
  /** Como o botão nomeia a senha, para o nome acessível ficar natural. */
  nomeVisibilidade?: string;
  /** Nome enviado no FormData; por padrão, o mesmo do `id`. */
  name?: string;
  disabled?: boolean;
}

/** Campo de senha com botão de mostrar e ocultar, com nome acessível e estado. */
export function CampoSenha({
  id,
  rotulo,
  valor,
  aoMudar,
  obrigatorio = false,
  descricao,
  autoComplete,
  erro,
  conferirMinimo = false,
  nomeVisibilidade = "a senha",
  name,
  disabled,
}: CampoSenhaProps) {
  const [visivel, setVisivel] = React.useState(false);
  const [tocado, setTocado] = React.useState(false);

  const idDescricao = descricao ? `${id}-descricao` : undefined;
  const idMensagem = `${id}-mensagem`;

  const minima =
    conferirMinimo && tocado && valor.length > 0 && !esquemaSenha.safeParse(valor).success;
  const descricoes = [idDescricao, erro || minima ? idMensagem : null].filter(Boolean).join(" ");

  const mensagemMinima =
    !erro && minima ? (
      <MensagemCampo id={idMensagem} tipo="erro">
        A senha deve ter ao menos 8 caracteres.
      </MensagemCampo>
    ) : null;

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

      <div className="relative">
        <Input
          id={id}
          name={name ?? id}
          type={visivel ? "text" : "password"}
          value={valor}
          onChange={(evento) => aoMudar(evento.target.value)}
          onBlur={() => setTocado(true)}
          autoComplete={autoComplete}
          disabled={disabled}
          required={obrigatorio}
          aria-required={obrigatorio || undefined}
          aria-invalid={erro || minima ? true : undefined}
          aria-describedby={descricoes || undefined}
          className="pr-10"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground absolute top-0.5 right-0.5 size-8"
          aria-label={visivel ? `Ocultar ${nomeVisibilidade}` : `Mostrar ${nomeVisibilidade}`}
          aria-pressed={visivel}
          onClick={() => setVisivel((atual) => !atual)}
        >
          {visivel ? (
            <EyeOffIcon className="size-4" aria-hidden="true" />
          ) : (
            <EyeIcon className="size-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      {erro ? (
        <MensagemCampo id={idMensagem} tipo="erro">
          {erro}
        </MensagemCampo>
      ) : null}

      <LinhaMensagem reservada={conferirMinimo} vazia={mensagemMinima === null}>
        {mensagemMinima}
      </LinhaMensagem>
    </div>
  );
}
