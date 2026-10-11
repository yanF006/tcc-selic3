"use client";

import * as React from "react";

import type { VariantProps } from "class-variance-authority";
import { AlertCircleIcon, PenLineIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { CampoMascarado } from "@/components/formularios/campo-mascarado";
import { RotuloCampo } from "@/components/formularios/campo";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { calcularHorasDia } from "@/lib/domain/schemas";
import { faixaDaNota, type FaixaAvaliacao } from "@/lib/domain/avaliacao";
import { MASCARAS } from "@/lib/mask";
import type {
  CampoDescriptor,
  ColunaGrade,
  DescriptorDocumento,
  OpcaoDescriptor,
} from "@/lib/templates/descriptors";
import { cn } from "@/lib/utils";

/**
 * Renderiza um campo a partir do descritor do template (D5, 8.5). Este arquivo é
 * a única tradução entre `CampoDescriptor` e um controle de formulário: nenhuma
 * tela escreve o layout de um documento em JSX. Todo tipo observado no Kit
 * (texto, textarea, número, data, hora, select, radio, checkbox, grade,
 * assinatura, auto, fixo e instrução) é resolvido aqui.
 */

function contadorDePalavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/** Largura do campo na grade do formulário. */
const LARGURAS: Record<NonNullable<CampoDescriptor["largura"]>, string> = {
  completa: "sm:col-span-2 lg:col-span-4",
  meia: "sm:col-span-2 lg:col-span-2",
  terco: "sm:col-span-1 lg:col-span-1",
  quarto: "sm:col-span-1 lg:col-span-1",
};

export function LarguraCampo({
  largura,
  children,
}: {
  largura?: CampoDescriptor["largura"];
  children: React.ReactNode;
}) {
  return <div className={cn("flex flex-col gap-2", largura && LARGURAS[largura])}>{children}</div>;
}

interface CampoDescritorProps {
  campo: CampoDescriptor;
  valor: unknown;
  aoMudar: (campoId: string, valor: unknown) => void;
  erro?: string;
  desabilitado?: boolean;
  /** `true` quando o dado automático do cadastro não existe. */
  pendente?: boolean;
}

/** Um campo de preenchimento do documento. */
export function CampoDescritor({
  campo,
  valor,
  aoMudar,
  erro,
  desabilitado,
  pendente,
}: CampoDescritorProps) {
  switch (campo.tipo) {
    case "texto":
    case "auto":
      return (
        <CampoTextoDescritor
          campo={campo}
          valor={texto(valor)}
          aoMudar={aoMudar}
          erro={erro}
          desabilitado={desabilitado}
          pendente={pendente}
        />
      );
    case "textarea":
      return (
        <CampoAreaTextoDescritor
          campo={campo}
          valor={texto(valor)}
          aoMudar={aoMudar}
          erro={erro}
          desabilitado={desabilitado}
        />
      );
    case "numero":
      return (
        <CampoNumeroDescritor
          campo={campo}
          valor={valor}
          aoMudar={aoMudar}
          erro={erro}
          desabilitado={desabilitado}
        />
      );
    case "data":
    case "hora":
      return (
        <CampoMascarado
          id={campo.id}
          rotulo={campo.rotulo}
          mascara={campo.mascara ?? campo.tipo}
          valor={texto(valor)}
          aoMudar={(novo) => aoMudar(campo.id, novo)}
          obrigatorio={campo.obrigatorio}
          erro={erro ?? null}
          disabled={desabilitado}
        />
      );
    case "select":
      return (
        <CampoSelecaoDescritor
          campo={campo}
          valor={texto(valor)}
          aoMudar={aoMudar}
          erro={erro}
          desabilitado={desabilitado}
        />
      );
    case "radio":
      return (
        <CampoEscolhaDescritor
          campo={campo}
          valor={texto(valor)}
          aoMudar={aoMudar}
          erro={erro}
          desabilitado={desabilitado}
        />
      );
    case "checkbox":
      return (
        <CampoMarcacaoDescritor
          campo={campo}
          valor={valor === true}
          aoMudar={aoMudar}
          erro={erro}
          desabilitado={desabilitado}
        />
      );
    case "grade":
      return (
        <GradeDescritor
          campo={campo}
          valor={valor}
          aoMudar={aoMudar}
          erro={erro}
          desabilitado={desabilitado}
        />
      );
    case "assinatura":
      return <CampoAssinaturaDescritor campo={campo} />;
    default:
      return null;
  }
}

function texto(valor: unknown): string {
  return valor === undefined || valor === null ? "" : String(valor);
}

interface CampoComumProps {
  campo: CampoDescriptor;
  erro?: string;
  desabilitado?: boolean;
}

/** Linha de erro ou de pendência ligada ao campo por `aria-describedby`. */
function MensagemDoCampo({
  id,
  erro,
  pendente,
}: {
  id: string;
  erro?: string;
  pendente?: boolean;
}) {
  if (erro) {
    return (
      <p id={id} className="text-destructive flex items-start gap-1 text-xs">
        <AlertCircleIcon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
        <span>{erro}</span>
      </p>
    );
  }

  if (pendente) {
    return (
      <p id={id} className="text-warning flex items-start gap-1 text-xs">
        <AlertCircleIcon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
        <span>
          Pendência: este dado não consta no seu cadastro.{" "}
          <a className="underline underline-offset-4" href="/perfil">
            Complete o cadastro
          </a>
          .
        </span>
      </p>
    );
  }

  return null;
}

function CampoTextoDescritor({
  campo,
  valor,
  aoMudar,
  erro,
  desabilitado,
  pendente,
}: CampoComumProps & {
  valor: string;
  aoMudar: (campoId: string, valor: unknown) => void;
  pendente?: boolean;
}) {
  const idMensagem = `${campo.id}-mensagem`;
  const descrito = campo.ajuda ? `${campo.id}-ajuda` : undefined;
  const automatico = campo.somenteLeitura || campo.origem === "aluno" || campo.origem === "estagio";
  const vazio = valor.trim() === "";
  const classes =
    "border-input bg-muted/40 text-foreground flex min-h-9 w-full items-center rounded-md border px-3 py-2 text-sm";

  return (
    <LarguraCampo largura={campo.largura}>
      <RotuloCampo htmlFor={campo.id} obrigatorio={campo.obrigatorio}>
        {campo.rotulo}
      </RotuloCampo>

      {campo.ajuda ? (
        <p id={`${campo.id}-ajuda`} className="text-muted-foreground text-xs">
          {campo.ajuda}
        </p>
      ) : null}

      {automatico ? (
        <p
          id={campo.id}
          className={classes}
          aria-readonly="true"
          aria-describedby={[descrito, erro || pendente ? idMensagem : null]
            .filter(Boolean)
            .join(" ")}
        >
          {vazio ? <span className="text-muted-foreground">—</span> : valor}
        </p>
      ) : campo.mascara ? (
        <CampoMascarado
          id={campo.id}
          rotulo={campo.rotulo}
          mascara={campo.mascara}
          valor={valor}
          aoMudar={(novo) => aoMudar(campo.id, novo)}
          obrigatorio={campo.obrigatorio}
          erro={erro ?? null}
          disabled={desabilitado}
        />
      ) : (
        <Input
          id={campo.id}
          value={valor}
          onChange={(evento) => aoMudar(campo.id, evento.target.value)}
          disabled={desabilitado}
          required={campo.obrigatorio}
          aria-required={campo.obrigatorio || undefined}
          aria-invalid={erro ? true : undefined}
          aria-describedby={[descrito, erro || pendente ? idMensagem : null]
            .filter(Boolean)
            .join(" ")}
        />
      )}

      {automatico || campo.mascara ? null : (
        <MensagemDoCampo id={idMensagem} erro={erro} pendente={pendente} />
      )}
      {automatico ? <MensagemDoCampo id={idMensagem} erro={erro} pendente={pendente} /> : null}
    </LarguraCampo>
  );
}

function CampoAreaTextoDescritor({
  campo,
  valor,
  aoMudar,
  erro,
  desabilitado,
}: CampoComumProps & {
  valor: string;
  aoMudar: (campoId: string, valor: unknown) => void;
}) {
  const idMensagem = `${campo.id}-mensagem`;
  const palavras = contadorDePalavras(valor);
  const excedeu = campo.maximoPalavras ? palavras > campo.maximoPalavras : false;

  return (
    <LarguraCampo largura={campo.largura}>
      <RotuloCampo htmlFor={campo.id} obrigatorio={campo.obrigatorio}>
        {campo.rotulo}
      </RotuloCampo>

      {campo.ajuda ? <p className="text-muted-foreground text-xs">{campo.ajuda}</p> : null}

      <Textarea
        id={campo.id}
        value={valor}
        rows={campo.linhas}
        onChange={(evento) => aoMudar(campo.id, evento.target.value)}
        disabled={desabilitado}
        required={campo.obrigatorio}
        aria-required={campo.obrigatorio || undefined}
        aria-invalid={erro || excedeu ? true : undefined}
        aria-describedby={erro || excedeu ? idMensagem : undefined}
      />

      {campo.maximoPalavras ? (
        <p
          className={cn("text-muted-foreground text-xs", excedeu && "text-destructive font-medium")}
        >
          {palavras} de {campo.maximoPalavras} palavras
        </p>
      ) : null}

      {erro || excedeu ? (
        <p id={idMensagem} className="text-destructive flex items-start gap-1 text-xs">
          <AlertCircleIcon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          <span>
            {erro ??
              `O limite é de ${campo.maximoPalavras} palavras; remova ${palavras - (campo.maximoPalavras ?? 0)}.`}
          </span>
        </p>
      ) : null}
    </LarguraCampo>
  );
}

function CampoNumeroDescritor({
  campo,
  valor,
  aoMudar,
  erro,
  desabilitado,
}: CampoComumProps & {
  valor: unknown;
  aoMudar: (campoId: string, valor: unknown) => void;
}) {
  const idMensagem = `${campo.id}-mensagem`;
  const automatico = campo.somenteLeitura || campo.origem === "aluno" || campo.origem === "estagio";
  const exibido = valor === undefined || valor === null || valor === "" ? "" : String(valor);
  const nota = Number(exibido);
  const notaValida =
    campo.faixa &&
    exibido !== "" &&
    !Number.isNaN(nota) &&
    nota >= (campo.min ?? 0) &&
    nota <= (campo.max ?? 10);
  const faixa = notaValida ? faixaDaNota(nota) : null;

  return (
    <LarguraCampo largura={campo.largura}>
      <RotuloCampo htmlFor={campo.id} obrigatorio={campo.obrigatorio}>
        {campo.rotulo}
      </RotuloCampo>

      {campo.ajuda ? <p className="text-muted-foreground text-xs">{campo.ajuda}</p> : null}

      <Input
        id={campo.id}
        type="number"
        inputMode="decimal"
        value={exibido}
        min={campo.min}
        max={campo.max}
        step={campo.passo ?? 1}
        readOnly={automatico}
        disabled={desabilitado}
        onChange={(evento) => {
          const bruto = evento.target.value;

          aoMudar(campo.id, bruto === "" ? "" : Number(bruto));
        }}
        required={campo.obrigatorio}
        aria-required={campo.obrigatorio || undefined}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idMensagem : undefined}
      />

      {faixa ? (
        <div className="flex items-center gap-1.5">
          <Badge variant={varianteDaFaixa(faixa.faixa)} data-testid={`faixa-${campo.id}`}>
            {faixa.faixa} — {faixa.rotulo} ({faixa.de} a {faixa.ate})
          </Badge>
        </div>
      ) : null}

      <MensagemDoCampo id={idMensagem} erro={erro} />
    </LarguraCampo>
  );
}

type VarianteBadge = VariantProps<typeof badgeVariants>["variant"];

function varianteDaFaixa(faixa: FaixaAvaliacao): VarianteBadge {
  switch (faixa) {
    case "E":
      return "success";
    case "B":
      return "info";
    case "R":
      return "warning";
    case "I":
      return "destructive";
  }
}

function opcoesDe(campo: CampoDescriptor): OpcaoDescriptor[] {
  return campo.opcoes ?? [];
}

function CampoSelecaoDescritor({
  campo,
  valor,
  aoMudar,
  erro,
  desabilitado,
}: CampoComumProps & {
  valor: string;
  aoMudar: (campoId: string, valor: unknown) => void;
}) {
  const idMensagem = `${campo.id}-mensagem`;
  const automatico = campo.somenteLeitura || campo.origem === "aluno" || campo.origem === "estagio";

  return (
    <LarguraCampo largura={campo.largura}>
      <RotuloCampo htmlFor={campo.id} obrigatorio={campo.obrigatorio}>
        {campo.rotulo}
      </RotuloCampo>

      {campo.ajuda ? <p className="text-muted-foreground text-xs">{campo.ajuda}</p> : null}

      <Select
        value={valor || undefined}
        onValueChange={(novo) => aoMudar(campo.id, novo)}
        disabled={desabilitado || automatico}
      >
        <SelectTrigger id={campo.id} className="w-full" aria-invalid={erro ? true : undefined}>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {opcoesDe(campo).map((opcao) => (
            <SelectItem key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <MensagemDoCampo id={idMensagem} erro={erro} />
    </LarguraCampo>
  );
}

function CampoEscolhaDescritor({
  campo,
  valor,
  aoMudar,
  erro,
  desabilitado,
}: CampoComumProps & {
  valor: string;
  aoMudar: (campoId: string, valor: unknown) => void;
}) {
  const idMensagem = `${campo.id}-mensagem`;

  return (
    <fieldset
      className={cn("flex flex-col gap-2", campo.largura && LARGURAS[campo.largura])}
      aria-invalid={erro ? true : undefined}
      aria-describedby={erro ? idMensagem : undefined}
    >
      <legend className="flex items-center gap-1 text-sm font-medium">
        {campo.rotulo}
        {campo.obrigatorio ? (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        ) : null}
      </legend>

      {campo.ajuda ? <p className="text-muted-foreground text-xs">{campo.ajuda}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
        {opcoesDe(campo).map((opcao) => (
          <label key={opcao.valor} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={campo.id}
              value={opcao.valor}
              checked={valor === opcao.valor}
              disabled={desabilitado}
              required={campo.obrigatorio}
              onChange={() => aoMudar(campo.id, opcao.valor)}
              className="accent-primary size-4"
            />
            <span>
              {opcao.rotulo}
              {opcao.exigeAnexo ? (
                <Badge variant="warning" className="ml-2">
                  Exige anexo
                </Badge>
              ) : null}
            </span>
          </label>
        ))}
      </div>

      <MensagemDoCampo id={idMensagem} erro={erro} />
    </fieldset>
  );
}

function CampoMarcacaoDescritor({
  campo,
  valor,
  aoMudar,
  erro,
  desabilitado,
}: CampoComumProps & {
  valor: boolean;
  aoMudar: (campoId: string, valor: unknown) => void;
}) {
  const idMensagem = `${campo.id}-mensagem`;

  return (
    <LarguraCampo largura={campo.largura}>
      <div className="flex items-start gap-2">
        <Checkbox
          id={campo.id}
          checked={valor}
          disabled={desabilitado}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? idMensagem : undefined}
          onCheckedChange={(estado) => aoMudar(campo.id, estado === true)}
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor={campo.id}>{campo.rotulo}</Label>
          {campo.ajuda ? <p className="text-muted-foreground text-xs">{campo.ajuda}</p> : null}
          <MensagemDoCampo id={idMensagem} erro={erro} />
        </div>
      </div>
    </LarguraCampo>
  );
}

/** Valor calculado da coluna automática de uma linha da grade. */
function valorAutomatico(coluna: ColunaGrade, linha: Record<string, unknown>): string {
  if (coluna.chave === "duracao") {
    const entrada = texto(linha.entrada);
    const saida = texto(linha.saida);

    if (!entrada || !saida) return "";

    const horas = calcularHorasDia(entrada, saida, false);

    return horas > 0 ? horas.toFixed(1).replace(".", ",") : "";
  }

  return texto(linha[coluna.chave]);
}

function GradeDescritor({
  campo,
  valor,
  aoMudar,
  erro,
  desabilitado,
}: CampoComumProps & {
  valor: unknown;
  aoMudar: (campoId: string, valor: unknown) => void;
}) {
  const linhas = Array.isArray(valor) ? (valor as Record<string, unknown>[]) : [];
  const colunas = campo.colunas ?? [];
  const idMensagem = `${campo.id}-mensagem`;

  function alterarLinha(indice: number, chave: string, novo: string) {
    const proximas = linhas.map((linha, i) => (i === indice ? { ...linha, [chave]: novo } : linha));

    aoMudar(campo.id, proximas);
  }

  function adicionarLinha() {
    if (campo.maximoLinhas && linhas.length >= campo.maximoLinhas) return;

    aoMudar(campo.id, [...linhas, {}]);
  }

  function removerLinha(indice: number) {
    aoMudar(
      campo.id,
      linhas.filter((_, i) => i !== indice),
    );
  }

  const colunaAutomatica = colunas.find((coluna) => coluna.automatica);
  const colunaTotal =
    colunaAutomatica ?? colunas.find((coluna) => coluna.chave === "horasTrabalhadas");
  const total = colunaTotal
    ? linhas.reduce((soma, linha) => {
        const bruto = colunaTotal.automatica
          ? valorAutomatico(colunaTotal, linha).replace(",", ".")
          : String(linha[colunaTotal.chave] ?? "").replace(",", ".");

        return soma + (Number(bruto) || 0);
      }, 0)
    : 0;

  return (
    <LarguraCampo largura="completa">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RotuloCampo htmlFor={campo.id} obrigatorio={campo.obrigatorio}>
          {campo.rotulo}
        </RotuloCampo>
        {campo.maximoLinhas ? (
          <span className="text-muted-foreground text-xs">
            {linhas.length} de {campo.maximoLinhas} linhas
          </span>
        ) : null}
      </div>

      {campo.ajuda ? <p className="text-muted-foreground text-xs">{campo.ajuda}</p> : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{campo.rotulo}</caption>
          <thead className="bg-muted/60">
            <tr>
              {colunas.map((coluna) => (
                <th
                  key={coluna.chave}
                  scope="col"
                  className="border-b px-2 py-1 text-left font-medium"
                  style={{ width: coluna.largura }}
                >
                  {coluna.rotulo}
                </th>
              ))}
              <th scope="col" className="border-b px-2 py-1 text-right font-medium">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, indice) => (
              <tr key={indice}>
                {colunas.map((coluna) => (
                  <td key={coluna.chave} className="border-b p-1 align-middle">
                    {coluna.automatica ? (
                      <span className="text-muted-foreground px-2">
                        {valorAutomatico(coluna, linha) || "—"}
                      </span>
                    ) : (
                      <Input
                        aria-label={`${coluna.rotulo} — linha ${indice + 1}`}
                        value={texto(linha[coluna.chave])}
                        disabled={desabilitado}
                        inputMode={coluna.tipo === "numero" ? "decimal" : undefined}
                        className="h-8"
                        onChange={(evento) =>
                          alterarLinha(
                            indice,
                            coluna.chave,
                            coluna.mascara
                              ? (MASCARAS[coluna.mascara]?.(evento.target.value) ??
                                  evento.target.value)
                              : evento.target.value,
                          )
                        }
                      />
                    )}
                  </td>
                ))}
                <td className="border-b p-1 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive size-8"
                    disabled={desabilitado}
                    aria-label={`Remover linha ${indice + 1}`}
                    onClick={() => removerLinha(indice)}
                  >
                    <Trash2Icon aria-hidden="true" className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          {campo.totalAutomatico && colunaTotal ? (
            <tfoot>
              <tr>
                <td className="px-2 py-1 text-right font-medium" colSpan={colunas.length}>
                  Total ({colunaTotal.rotulo})
                </td>
                <td className="px-2 py-1 font-semibold">{total.toFixed(1).replace(".", ",")}</td>
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={
            desabilitado || (campo.maximoLinhas ? linhas.length >= campo.maximoLinhas : false)
          }
          onClick={adicionarLinha}
        >
          <PlusIcon aria-hidden="true" className="size-4" />
          Adicionar linha
        </Button>
      </div>

      <MensagemDoCampo id={idMensagem} erro={erro} />
    </LarguraCampo>
  );
}

function CampoAssinaturaDescritor({ campo }: { campo: CampoDescriptor }) {
  return (
    <LarguraCampo largura={campo.largura}>
      <div className="border-border text-muted-foreground flex items-center gap-2 rounded-md border border-dashed px-3 py-4 text-sm">
        <PenLineIcon aria-hidden="true" className="size-4 shrink-0" />
        <span>{campo.rotulo} — assinatura colhida na via impressa.</span>
      </div>
    </LarguraCampo>
  );
}

/** Agrupa os campos de identificação automática de um descritor. */
export function camposAutomaticos(descriptor: DescriptorDocumento): CampoDescriptor[] {
  return descriptor.auto ?? [];
}
