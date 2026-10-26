"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import {
  ativarCadastro,
  removerCadastro,
  salvarCadastro,
  type TipoCadastro,
} from "@/lib/services/cadastros";

export async function alterarCadastroAction(
  tipo: TipoCadastro,
  dados: Record<string, unknown>,
  id?: string,
  operacao: "salvar" | "excluir" | "inativar" | "ativar" = "salvar",
) {
  try {
    const usuario = await usuarioDaRequisicaoObrigatorio();
    if (operacao === "salvar") await salvarCadastro(usuario, tipo, dados, id);
    else if (operacao === "ativar" && id) await ativarCadastro(usuario, tipo, id);
    else if (id && (operacao === "excluir" || operacao === "inativar"))
      await removerCadastro(usuario, tipo, id, operacao === "inativar");
    else throw new Error("Operação de cadastro inválida.");
    for (const rota of [
      "/coordenacao/cadastros",
      "/admin/convenios",
      "/cadastro",
      "/perfil",
      "/estagio",
    ])
      revalidatePath(rota);
    return {
      ok: true,
      mensagem:
        operacao === "salvar"
          ? "Cadastro salvo."
          : operacao === "inativar"
            ? "Cadastro inativado e histórico preservado."
            : operacao === "ativar"
              ? "Cadastro ativado."
              : "Cadastro excluído; referências históricas preservadas.",
    };
  } catch (erro) {
    return {
      ok: false,
      mensagem:
        erro instanceof ZodError
          ? erro.issues[0].message
          : erro instanceof Error
            ? erro.message
            : "Não foi possível alterar o cadastro.",
    };
  }
}
