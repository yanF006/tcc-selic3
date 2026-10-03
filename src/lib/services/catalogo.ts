import type {
  Convenio,
  ClassificacaoConvenio,
  Curso,
  Pagina,
  Periodo,
  Pessoa,
  Turma,
} from "@/lib/domain/types";
import type { OpcoesSelecao } from "@/lib/domain/schemas";

import { filtrarPorTexto, paginar } from "./paginacao";
import type { OpcoesPaginacao } from "./paginacao";
import { agora, obterEstado, novoId } from "./store";

/** Catálogos de apoio: cursos, turmas, períodos, responsáveis e convênios. */

export async function listarCursos(situacao?: Curso["situacao"]): Promise<Curso[]> {
  return obterEstado().cursos.filter((curso) => !situacao || curso.situacao === situacao);
}

export async function listarTurmas(cursoId?: string): Promise<Turma[]> {
  return obterEstado()
    .turmas.filter((turma) => turma.situacao === "ativo")
    .filter((turma) => !cursoId || turma.cursoId === cursoId);
}

export async function listarPeriodos(): Promise<Periodo[]> {
  return obterEstado()
    .periodos.filter((periodo) => periodo.situacao === "ativo")
    .sort((a, b) => b.ano - a.ano || b.semestre - a.semestre);
}

export async function listarOrientadores(): Promise<Pessoa[]> {
  return obterEstado().pessoas.filter(
    (pessoa) => pessoa.papel === "orientador" && pessoa.situacao === "ativo",
  );
}

export async function listarSupervisores(): Promise<Pessoa[]> {
  return obterEstado()
    .pessoas.filter((pessoa) => pessoa.papel === "supervisor")
    .sort((a, b) => a.situacao.localeCompare(b.situacao));
}

/** Opções usadas pelos schemas Zod dos selects. */
export async function opcoesSelecao(): Promise<OpcoesSelecao> {
  const [turmas, cursos] = await Promise.all([listarTurmas(), listarCursos("ativo")]);

  return {
    cursosIds: cursos.map((curso) => curso.id),
    turmasPorCurso: Object.fromEntries(
      cursos.map((curso) => [
        curso.id,
        turmas.filter((turma) => turma.cursoId === curso.id).map((turma) => turma.id),
      ]),
    ),
    periodosIds: (await listarPeriodos()).map((periodo) => periodo.id),
  };
}

export async function pessoaPorId(id: string): Promise<Pessoa | null> {
  return obterEstado().pessoas.find((pessoa) => pessoa.id === id) ?? null;
}

export async function cursoPorId(id?: string): Promise<Curso | null> {
  if (!id) return null;

  return obterEstado().cursos.find((curso) => curso.id === id) ?? null;
}

export async function turmaPorId(id?: string): Promise<Turma | null> {
  if (!id) return null;

  return obterEstado().turmas.find((turma) => turma.id === id) ?? null;
}

export async function periodoPorId(id?: string): Promise<Periodo | null> {
  if (!id) return null;

  return obterEstado().periodos.find((periodo) => periodo.id === id) ?? null;
}

/** Convênio dentro da vigência é ativo; vencido, expirado. */
export function classificacaoConvenio(
  convenio: Convenio,
  hoje = new Date().toISOString().slice(0, 10),
): ClassificacaoConvenio {
  return convenio.fimVigencia >= hoje ? "ativo" : "expirado";
}

export interface ConsultaConvenios extends OpcoesPaginacao {
  situacao?: ClassificacaoConvenio;
  busca?: string;
}

export async function listarConvenios(consulta: ConsultaConvenios = {}): Promise<Pagina<Convenio>> {
  const hoje = new Date().toISOString().slice(0, 10);

  const filtrados = obterEstado()
    .convenios.filter(
      (convenio) =>
        !consulta.situacao || classificacaoConvenio(convenio, hoje) === consulta.situacao,
    )
    .sort((a, b) => a.inicioVigencia.localeCompare(b.inicioVigencia));

  return paginar(
    filtrarPorTexto(filtrados, consulta.busca ?? "", (convenio) => [
      convenio.nome,
      convenio.instituicao,
      convenio.cnpj,
    ]),
    consulta,
  );
}

export async function convenioPorId(id: string): Promise<Convenio | null> {
  return obterEstado().convenios.find((convenio) => convenio.id === id) ?? null;
}

/** Cadastro de convênio; a vigência inicial é de 5 anos. */
export async function cadastrarConvenio(
  dados: Omit<Convenio, "id" | "campus" | "situacao" | "renovacoes" | "fimVigencia">,
): Promise<Convenio> {
  const fim = somarAnos(dados.inicioVigencia, 5);

  const convenio: Convenio = {
    ...dados,
    id: novoId("conv"),
    campus: "Pinheiral",
    situacao: "ativo",
    renovacoes: 0,
    fimVigencia: fim,
  };

  obterEstado().convenios.push(convenio);

  return convenio;
}

export function somarAnos(dataIso: string, anos: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const alvo = new Date(Date.UTC(ano + anos, mes - 1, 1));
  const ultimoDia = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0),
  ).getUTCDate();

  alvo.setUTCDate(Math.min(dia, ultimoDia));

  return alvo.toISOString().slice(0, 10);
}

/** Renovação: prorroga 5 anos a partir do vencimento e soma uma renovação. */
export async function renovarConvenio(
  convenioId: string,
  hoje = new Date().toISOString().slice(0, 10),
): Promise<Convenio> {
  const convenio = await convenioPorId(convenioId);

  if (!convenio) throw new Error("Convênio não encontrado.");

  if (classificacaoConvenio(convenio, hoje) === "ativo") {
    throw new Error("Convênio ainda vigente: renovar apenas após o vencimento.");
  }

  const inicio = somarAnos(convenio.fimVigencia, 1);

  convenio.inicioVigencia = inicio;
  convenio.fimVigencia = somarAnos(inicio, 5);
  convenio.renovacoes += 1;

  return convenio;
}

export async function registrarConvenio(convenioId: string, motivo: string): Promise<void> {
  const convenio = await convenioPorId(convenioId);

  if (!convenio) throw new Error("Convênio não encontrado.");

  obterEstado().notificacoes.push({
    id: novoId("ntf"),
    destinatarioId: "usr-admin",
    titulo: `Histórico do convênio ${convenio.nome}`,
    mensagem: motivo,
    tipo: "sistema",
    lida: false,
    criadaEm: agora(),
  });
}
