"use server";

import type { CampoDescriptor } from "@/lib/templates/descriptors";

const indisponivel = {
  ok: false,
  mensagem: "O Kit de Estágio é fixo. Publicação e alteração administrativa de templates não estão disponíveis.",
};

/** Endpoints antigos recusam a operação antes de ler ou converter qualquer arquivo. */
export async function registrarVersaoAction(
  templateId: string,
  campos: CampoDescriptor[],
  formulario: FormData,
) {
  void templateId; void campos; void formulario;
  return { ...indisponivel };
}

export async function alterarTemplateAction(templateId: string, operacao: "inativar" | "ativar" | "excluir") {
  void templateId; void operacao;
  return { ...indisponivel };
}
