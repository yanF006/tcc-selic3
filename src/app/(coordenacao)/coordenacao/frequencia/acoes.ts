"use server";

import { revalidatePath } from "next/cache";

import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import type { SituacaoDocumento } from "@/lib/domain/types";
import type { ProblemaValidacao } from "@/lib/services/documentos";
import { ErroDeRegra } from "@/lib/services/erros";
import { registrarFichaFrequencia } from "@/lib/services/frequencia";

export interface ResumoFicha {
  id: string;
  situacao: SituacaoDocumento;
  registradoEm?: string;
}

export type ResultadoRegistro =
  | {
      ok: true;
      valores?: Record<string, unknown>;
      ficha: ResumoFicha;
    }
  | {
      ok: false;
      erro?: string;
      problemas?: ProblemaValidacao[];
    };

/**
 * Registra a Ficha de Frequência recebida já assinada (8.12). O servidor
 * valida os valores contra o descritor e grava o documento associado ao
 * estágio; `revalidatePath` devolve a página já com o dado persistido.
 */
export async function registrarFichaAction(
  estagioId: string,
  valores: Record<string, unknown>,
): Promise<ResultadoRegistro> {
  try {
    const usuario = await usuarioDaRequisicaoObrigatorio();
    const {
      ok,
      erro,
      problemas,
      valores: preparados,
      ficha,
    } = await registrarFichaFrequencia(usuario, estagioId, valores);

    if (!ok || !ficha) {
      return { ok: false, erro, problemas };
    }

    revalidatePath("/coordenacao/frequencia");

    return {
      ok: true,
      valores: preparados,
      ficha: { id: ficha.id, situacao: "registrada", registradoEm: ficha.registradoEm },
    };
  } catch (erro) {
    if (erro instanceof ErroDeRegra) return { ok: false, erro: erro.message };

    return { ok: false, erro: "Não foi possível registrar a ficha." };
  }
}
