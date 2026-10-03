import { esquemaEstagio } from "@/lib/domain/schemas";
import type {
  Convenio,
  Estagio,
  LancamentoHoras,
  Pagina,
  Papel,
  Pessoa,
  Usuario,
} from "@/lib/domain/types";

import { classificacaoConvenio, convenioPorId, pessoaPorId } from "./catalogo";
import { ErroDeRegra } from "./erros";
import { filtrarPorTexto, paginar } from "./paginacao";
import type { OpcoesPaginacao } from "./paginacao";
import { agora, obterEstado, novoId } from "./store";

export { ErroDeRegra };

/** Estágios: cadastro, seleção de documentos e transições de situação. */

export interface EstagioContexto {
  estagio: Estagio;
  convenio: Convenio | null;
  supervisor: Pessoa | null;
  orientador: Pessoa | null;
  horasLancadas: number;
}

export interface ConsultaEstagios extends OpcoesPaginacao {
  situacao?: Estagio["situacao"];
  busca?: string;
}

export interface NovoEstagio {
  convenioId: string;
  supervisorId: string;
  orientadorId: string;
  dataInicio: string;
  dataFim: string;
  situacao?: Estagio["situacao"];
  documentosSelecionados?: string[];
}

function sobrepoe(inicioA: string, fimA: string, inicioB: string, fimB: string): boolean {
  return inicioA <= fimB && inicioB <= fimA;
}

export async function estagiosDoAluno(alunoId: string): Promise<Estagio[]> {
  return obterEstado()
    .estagios.filter((estagio) => estagio.alunoId === alunoId)
    .sort((a, b) => b.dataInicio.localeCompare(a.dataInicio));
}

export async function listarEstagios(consulta: ConsultaEstagios = {}): Promise<Pagina<Estagio>> {
  const filtrados = obterEstado()
    .estagios.filter((estagio) => !consulta.situacao || estagio.situacao === consulta.situacao)
    .sort((a, b) => b.dataInicio.localeCompare(a.dataInicio));

  return paginar(
    filtrarPorTexto(filtrados, consulta.busca ?? "", (estagio) => [estagio.id, estagio.alunoId]),
    consulta,
  );
}

export async function estagiosPorSituacao(situacao: Estagio["situacao"]): Promise<Estagio[]> {
  return obterEstado().estagios.filter((estagio) => estagio.situacao === situacao);
}

export async function estagioPorId(id: string): Promise<Estagio | null> {
  return obterEstado().estagios.find((estagio) => estagio.id === id) ?? null;
}

export async function estagioComContexto(id: string): Promise<EstagioContexto | null> {
  const estagio = await estagioPorId(id);

  if (!estagio) return null;

  const [convenio, supervisor, orientador, horasLancadas] = await Promise.all([
    convenioPorId(estagio.convenioId),
    pessoaPorId(estagio.supervisorId),
    pessoaPorId(estagio.orientadorId),
    totalHorasDoEstagio(id),
  ]);

  return { estagio, convenio, supervisor, orientador, horasLancadas };
}

export async function totalHorasDoEstagio(estagioId: string): Promise<number> {
  const lancamentos = lancamentosDoEstagio(estagioId);
  const datas = [...new Set(lancamentos.map((lancamento) => lancamento.data))];
  const corrigidos = new Set(
    lancamentos
      .filter((lancamento) => lancamento.tipo === "correcao")
      .map((lancamento) => lancamento.corrigeId),
  );

  return datas.reduce((total, data) => {
    const doDia = lancamentos.filter((lancamento) => lancamento.data === data);
    const correcao = doDia
      .filter((lancamento) => lancamento.tipo === "correcao")
      .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
      .pop();
    const original = doDia.find(
      (lancamento) => lancamento.tipo === "lancamento" && !corrigidos.has(lancamento.id),
    );

    return total + ((correcao ?? original)?.horas ?? 0);
  }, 0);
}

export function lancamentosDoEstagio(estagioId: string): LancamentoHoras[] {
  return obterEstado()
    .lancamentos.filter((lancamento) => lancamento.estagioId === estagioId)
    .sort((a, b) => a.data.localeCompare(b.data) || a.criadoEm.localeCompare(b.criadoEm));
}

/**
 * Cria o estágio validando o formulário com Zod e as regras do Regulamento:
 * convênio vigente, supervisor ativo e não sobreposição de períodos.
 */
export async function criarEstagio(aluno: Usuario, dados: NovoEstagio): Promise<Estagio> {
  if (!aluno.papeis.includes("aluno")) {
    throw new ErroDeRegra("Apenas alunos cadastram estágios.", "papel_invalido");
  }

  const parsed = esquemaEstagio().parse({ ...dados, situacao: dados.situacao ?? "em_andamento" });

  const convenio = await convenioPorId(parsed.convenioId);

  if (!convenio) throw new ErroDeRegra("Convênio não encontrado.", "convenio_inexistente");

  if (classificacaoConvenio(convenio) === "expirado") {
    throw new ErroDeRegra(
      "Convênio vencido: registre a renovação antes de iniciar o estágio.",
      "convenio_expirado",
    );
  }

  const supervisor = await pessoaPorId(parsed.supervisorId);

  if (!supervisor || supervisor.papel !== "supervisor" || supervisor.situacao !== "ativo") {
    throw new ErroDeRegra("Supervisor inativo ou não cadastrado.", "supervisor_invalido");
  }

  const orientador = await pessoaPorId(parsed.orientadorId);

  if (!orientador || orientador.papel !== "orientador") {
    throw new ErroDeRegra("Orientador não cadastrado.", "orientador_invalido");
  }

  const conflito = (await estagiosDoAluno(aluno.id)).find((estagio) =>
    sobrepoe(parsed.dataInicio, parsed.dataFim, estagio.dataInicio, estagio.dataFim),
  );

  if (conflito) {
    throw new ErroDeRegra(
      "O período conflita com um estágio já cadastrado.",
      "periodo_conflictante",
    );
  }

  const estagio: Estagio = {
    id: novoId("est"),
    alunoId: aluno.id,
    convenioId: parsed.convenioId,
    supervisorId: parsed.supervisorId,
    orientadorId: parsed.orientadorId,
    dataInicio: parsed.dataInicio,
    dataFim: parsed.dataFim,
    situacao: parsed.situacao,
    documentosSelecionados: documentosValidos(dados.documentosSelecionados ?? [], "aluno"),
    criadoEm: agora(),
  };

  obterEstado().estagios.push(estagio);

  return estagio;
}

/** Só entram no estágio documentos preenchíveis que o papel assinante pode preencher. */
function documentosValidos(templateIds: string[], papel: Papel): string[] {
  const permitidos = new Set(
    obterEstado()
      .templates.filter(
        (template) =>
          template.tipo === "preenchivel" &&
          template.metadados?.papeisPreenchimento.includes(papel),
      )
      .map((template) => template.id),
  );

  return templateIds.filter((id) => permitidos.has(id));
}

export async function selecionarDocumentos(
  estagioId: string,
  templateIds: string[],
): Promise<Estagio> {
  const estagio = await estagioPorId(estagioId);

  if (!estagio) throw new ErroDeRegra("Estágio não encontrado.", "estagio_inexistente");

  if (estagio.situacao !== "em_andamento") {
    throw new ErroDeRegra(
      "Estágio concluído não permite alteração de documentos.",
      "estagio_concluido",
    );
  }

  estagio.documentosSelecionados = documentosValidos(templateIds, "aluno");

  return estagio;
}

export async function concluirEstagio(estagioId: string, editorId?: string): Promise<Estagio> {
  const estagio = await estagioPorId(estagioId);

  if (!estagio) throw new ErroDeRegra("Estágio não encontrado.", "estagio_inexistente");

  if (estagio.situacao === "concluido") {
    throw new ErroDeRegra("Estágio já está concluído.", "ja_concluido");
  }

  estagio.situacao = "concluido";
  estagio.editadoPorId = editorId;
  estagio.editadoEm = agora();

  return estagio;
}

/** Reabre o estágio para correção; o histórico de lançamentos é preservado. */
export async function reabrirEstagio(estagioId: string, editorId?: string): Promise<Estagio> {
  const estagio = await estagioPorId(estagioId);

  if (!estagio) throw new ErroDeRegra("Estágio não encontrado.", "estagio_inexistente");

  estagio.situacao = "em_andamento";
  estagio.editadoPorId = editorId;
  estagio.editadoEm = agora();

  return estagio;
}
