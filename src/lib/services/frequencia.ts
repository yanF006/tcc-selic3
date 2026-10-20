import type { DocumentoPreenchido, Estagio, Usuario } from "@/lib/domain/types";

import {
  documentosDoEstagio,
  podePreencher,
  templatePorId,
  validarValores,
  valoresDoPreenchimento,
  type ProblemaValidacao,
} from "./documentos";
import { ErroDeRegra } from "./erros";
import { exigirAcessoEstagio } from "./estagios";
import { agora, novoId, obterEstado } from "./store";

/**
 * Registro da Ficha de Frequência já recebida assinada pela concedente (8.12).
 *
 * A ficha é preenchida fora do Kit e chega na COIEE pronta; a coordenação lança
 * aqui as horas e as avaliações que o documento traz e ele fica associado ao
 * estágio, sem passar por fila de parecer.
 */

export const TEMPLATE_FICHA_FREQUENCIA = "tpl-ficha-frequencia";

/** Ficha de Frequência vigente (não inativa) do estágio, quando existir. */
export async function fichaDoEstagio(estagioId: string): Promise<DocumentoPreenchido | null> {
  return (
    (await documentosDoEstagio(estagioId)).find(
      (documento) =>
        documento.templateId === TEMPLATE_FICHA_FREQUENCIA && documento.situacao !== "inativo",
    ) ?? null
  );
}

export interface PreparacaoRegistro {
  estagio: Estagio;
  aluno: Usuario;
  ficha: DocumentoPreenchido | null;
  valores: Record<string, unknown>;
}

/**
 * Abre o formulário de registro para o estágio: confere o perfil da matriz de
 * preenchimento, o acesso ao estágio e monta os valores iniciais (ficha já
 * registrada reaproveita o conteúdo; sem ficha, parte do descritor).
 */
export async function iniciarRegistroFicha(
  autor: Usuario,
  estagioId: string,
): Promise<PreparacaoRegistro> {
  const template = await templatePorId(TEMPLATE_FICHA_FREQUENCIA);

  if (!template) {
    throw new ErroDeRegra("Ficha de Frequência indisponível.", "nao_encontrado");
  }

  if (!podePreencher(autor, template)) {
    throw new ErroDeRegra("O registro desta ficha cabe a outro perfil.", "acesso_negado");
  }

  const estagio = await exigirAcessoEstagio(autor, estagioId);
  const aluno = obterEstado().usuarios.find((registro) => registro.id === estagio.alunoId);

  if (!aluno) {
    throw new ErroDeRegra("Cadastro do aluno não encontrado.", "nao_encontrado");
  }

  const ficha = await fichaDoEstagio(estagioId);
  const valores = ficha
    ? { ...ficha.valores }
    : await valoresDoPreenchimento(TEMPLATE_FICHA_FREQUENCIA, aluno, estagioId, {});

  return { estagio, aluno, ficha, valores };
}

export interface ResultadoRegistroFicha {
  ok: boolean;
  erro?: string;
  problemas?: ProblemaValidacao[];
  valores?: Record<string, unknown>;
  ficha?: DocumentoPreenchido;
}

/**
 * Registra a ficha recebida assinada: valida os valores lançados contra o
 * descritor, associa o documento ao estágio do aluno e grava quem registrou e
 * quando. Um registro novo substitui o anterior (re-registro é idempotente) e
 * uma ficha inativa fica de fora: nesse caso entra um documento novo.
 */
export async function registrarFichaFrequencia(
  autor: Usuario,
  estagioId: string,
  valores: Record<string, unknown>,
): Promise<ResultadoRegistroFicha> {
  let contexto: PreparacaoRegistro;

  try {
    contexto = await iniciarRegistroFicha(autor, estagioId);
  } catch (erro) {
    if (erro instanceof ErroDeRegra) return { ok: false, erro: erro.message };
    throw erro;
  }

  const { aluno, ficha } = contexto;
  const preparados = await valoresDoPreenchimento(
    TEMPLATE_FICHA_FREQUENCIA,
    aluno,
    estagioId,
    valores,
  );
  const problemas = validarValores(TEMPLATE_FICHA_FREQUENCIA, preparados);

  if (problemas.length > 0) {
    return { ok: false, erro: problemas[0].mensagem, problemas };
  }

  const momento = agora();
  let registrada: DocumentoPreenchido;

  if (ficha) {
    registrada = ficha;
    registrada.valores = preparados;
    registrada.situacao = "registrada";
    registrada.atualizadoEm = momento;
  } else {
    const template = await templatePorId(TEMPLATE_FICHA_FREQUENCIA);
    const versaoVigente = template?.versoes.find((versao) => versao.vigente);

    registrada = {
      id: novoId("doc"),
      templateId: TEMPLATE_FICHA_FREQUENCIA,
      alunoId: aluno.id,
      estagioId,
      versaoTemplate: versaoVigente?.versao ?? 1,
      valores: preparados,
      situacao: "registrada",
      criadoEm: momento,
      atualizadoEm: momento,
    };
    obterEstado().documentos.push(registrada);
  }

  registrada.registradoPorId = autor.id;
  registrada.registradoEm = momento;

  return { ok: true, valores: preparados, ficha: registrada };
}
