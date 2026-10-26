"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import { alterarTemplate, registrarVersaoTemplate } from "@/lib/services/templates";
import type { CampoDescriptor } from "@/lib/templates/descriptors";

export async function registrarVersaoAction(
  templateId: string,
  campos: CampoDescriptor[],
  formulario: FormData,
) {
  try {
    const usuario = await usuarioDaRequisicaoObrigatorio();
    const arquivo = formulario.get("arquivo");
    if (!(arquivo instanceof File) || !arquivo.size)
      throw new Error("Selecione o arquivo .docx do template.");
    const versao = await registrarVersaoTemplate(
      usuario,
      templateId,
      {
        nome: arquivo.name,
        conteudoBase64: Buffer.from(await arquivo.arrayBuffer()).toString("base64"),
      },
      campos,
    );
    revalidatePath("/coordenacao/templates");
    revalidatePath("/documentos", "layout");
    revalidatePath("/estagio");
    return { ok: true, mensagem: `Versão ${versao.versao} cadastrada como vigente.` };
  } catch (erro) {
    return {
      ok: false,
      mensagem:
        erro instanceof ZodError
          ? erro.issues[0].message
          : erro instanceof Error
            ? erro.message
            : "Não foi possível cadastrar a versão.",
    };
  }
}

export async function alterarTemplateAction(
  templateId: string,
  operacao: "inativar" | "ativar" | "excluir",
) {
  try {
    await alterarTemplate(await usuarioDaRequisicaoObrigatorio(), templateId, operacao);
    revalidatePath("/coordenacao/templates");
    revalidatePath("/documentos", "layout");
    return {
      ok: true,
      mensagem:
        operacao === "excluir"
          ? "Template excluído."
          : operacao === "ativar"
            ? "Template ativado."
            : "Template inativado; documentos anteriores preservados.",
    };
  } catch (erro) {
    return {
      ok: false,
      mensagem: erro instanceof Error ? erro.message : "Não foi possível alterar o template.",
    };
  }
}
