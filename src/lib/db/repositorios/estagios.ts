import "server-only";

import type { Estagio as LinhaEstagio, PrismaClient, Prisma } from "@/generated/prisma/client";
import type { Estagio } from "@/lib/domain/types";

export type ClienteEstagios = Pick<PrismaClient, "estagio" | "usuario" | "documentoPreenchido">;

export function paraDominioEstagio(linha: LinhaEstagio & { templates: { templateId: string }[] }): Estagio {
  return {
    id: linha.id, alunoId: linha.alunoId, convenioId: linha.convenioId,
    supervisorId: linha.supervisorId, orientadorId: linha.orientadorId,
    dataInicio: linha.dataInicio.toISOString().slice(0, 10), dataFim: linha.dataFim.toISOString().slice(0, 10),
    situacao: linha.situacao as Estagio["situacao"], documentosSelecionados: linha.templates.map((item) => item.templateId),
    cargaHorariaPrevista: linha.cargaHorariaPrevistaMinutos == null ? undefined : linha.cargaHorariaPrevistaMinutos / 60,
    encaminhadoEm: linha.encaminhadoEm?.toISOString(), encaminhadoPorId: linha.encaminhadoPorId ?? undefined,
    liberadoEm: linha.liberadoEm?.toISOString(), liberadoPorId: linha.liberadoPorId ?? undefined,
    canceladoEm: linha.canceladoEm?.toISOString(), excluidoEm: linha.excluidoEm?.toISOString(),
    nomeAlunoHistorico: linha.nomeAlunoHistorico ?? undefined, cursoIdHistorico: linha.cursoIdHistorico ?? undefined,
    editadoPorId: linha.editadoPorId ?? undefined, editadoEm: linha.editadoEm?.toISOString(), criadoEm: linha.criadoEm.toISOString(),
  };
}

export async function buscarEstagio(cliente: ClienteEstagios, id: string): Promise<Estagio | null> {
  const linha = await cliente.estagio.findUnique({ where: { id }, include: { templates: true } });
  return linha ? paraDominioEstagio(linha) : null;
}

/** Predicado compartilhado por listas, totais e detalhes autorizados. */
export async function recorteEstagios(cliente: ClienteEstagios, usuarioId: string): Promise<Prisma.EstagioWhereInput> {
  const autor = await cliente.usuario.findUnique({ where: { id: usuarioId } });
  if (!autor || autor.situacao !== "ativo") return { id: { in: [] } };
  if (autor.papel === "aluno") return { alunoId: autor.id };
  if (autor.papel === "administrador" || autor.papel === "coordenador_estagio") return { aluno: { campus: autor.campus } };
  if (autor.papel === "coordenador_curso" && autor.cursoId) return {
    OR: [
      { excluidoEm: null, aluno: { dadosPessoaisAluno: { cursoId: autor.cursoId } } },
      { excluidoEm: { not: null }, cursoIdHistorico: autor.cursoId },
    ],
  };
  return { id: { in: [] } };
}

/** Reconsulta identidade e vínculo: o DTO recebido não concede acesso. Aceita a transação do caso de uso. */
export async function podeConsultarEstagioNoBanco(cliente: ClienteEstagios, usuarioId: string, estagioId: string): Promise<boolean> {
  const recorte = await recorteEstagios(cliente, usuarioId);
  return (await cliente.estagio.count({ where: { AND: [{ id: estagioId }, recorte] } })) > 0;
}
