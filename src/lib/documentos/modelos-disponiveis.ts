/**
 * Documentos com modelo DOCX marcado (`modelos/<templateId>.docx`). Fica fora
 * de `gerar-docx.ts` para que a tela (componente cliente) saiba quando exibir o
 * download sem importar código de servidor. A Ficha de Frequência não gera
 * arquivo: ela é registrada já assinada pela concedente.
 */
export const TEMPLATES_COM_MODELO = [
  "tpl-formulario-liberacao",
  "tpl-plano-atividades",
  "tpl-convenio-estagio",
  "tpl-termo-compromisso",
  "tpl-ficha-acompanhamento",
  "tpl-relatorio-semestral",
  "tpl-requerimento-aproveitamento",
  "tpl-termo-aditivo",
  "tpl-proposta-atuacao-pedagogica",
] as const;

export function temModelo(templateId: string): boolean {
  return (TEMPLATES_COM_MODELO as readonly string[]).includes(templateId);
}

/** Único formato de download do documento preenchido. */
export type FormatoDocumento = "docx";

export const MENSAGEM_SOMENTE_DOCX = "Download disponível apenas em DOCX.";
