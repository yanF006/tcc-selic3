import type { Estagio } from "./types";

export const DOCUMENTOS_INICIAIS = [
  "tpl-formulario-liberacao",
  "tpl-termo-compromisso",
  "tpl-plano-atividades",
] as const;

export function documentoInicial(templateId: string): boolean {
  return DOCUMENTOS_INICIAIS.some((id) => id === templateId);
}

export function estagioEncerrado(estagio: Estagio): boolean {
  return Boolean(estagio.canceladoEm || estagio.excluidoEm);
}

export function estagioLiberado(estagio: Estagio): boolean {
  return Boolean(estagio.liberadoEm) && !estagioEncerrado(estagio);
}
