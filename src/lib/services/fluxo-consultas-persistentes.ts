import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { DocumentoPreenchido, EnvioExterno, ObservacaoDocumento, Pagina, Parecer, StatusEnvioExterno, TipoParecer, Usuario } from "@/lib/domain/types";
import { carregarCliente } from "@/lib/db/prisma";
import { executarTransacao } from "@/lib/db/transacoes";
import { paraDominioDocumento } from "@/lib/db/repositorios/documentos";
import { DESCRITORES } from "@/lib/templates/descriptors";
import type { ConsultaDocumentos } from "./documentos";

const TAMANHO_PADRAO = 10;

function paginacao(consulta: ConsultaDocumentos, total: number) {
  const tamanho = Math.max(1, consulta.tamanho ?? TAMANHO_PADRAO);
  const pagina = Math.min(Math.max(1, consulta.pagina ?? 1), Math.max(1, Math.ceil(total / tamanho)));
  return { tamanho, pagina, skip: (pagina - 1) * tamanho };
}

export async function recorteDocumentos(cliente: Prisma.TransactionClient, usuarioId: string): Promise<Prisma.DocumentoPreenchidoWhereInput> {
  const autor = await cliente.usuario.findUnique({ where: { id: usuarioId } });
  if (!autor || autor.situacao !== "ativo") return { id: { in: [] } };
  if (autor.papel === "administrador" || autor.papel === "coordenador_estagio") return { aluno: { campus: autor.campus } };
  if (autor.papel === "coordenador_curso" && autor.cursoId) {
    const cursoId = autor.cursoId;
    return {
      OR: [
        { estagio: { excluidoEm: null, aluno: { dadosPessoaisAluno: { cursoId } } } },
        { estagio: { excluidoEm: { not: null }, cursoIdHistorico: cursoId } },
        { estagioId: null, aluno: { dadosPessoaisAluno: { cursoId } } },
      ],
    };
  }
  if (autor.papel === "aluno") return { alunoId: autor.id };
  return { id: { in: [] } };
}

export async function documentosDaCoordenacaoPersistente(usuario: Usuario, consulta: ConsultaDocumentos = {}): Promise<Pagina<DocumentoPreenchido>> {
  const { prisma } = await carregarCliente();
  return executarTransacao(async (tx) => {
    const recorte = await recorteDocumentos(tx, usuario.id);
    const termo = consulta.busca?.trim();
    const templatesDoTermo = termo ? DESCRITORES.filter((descritor) => descritor.titulo.toLowerCase().includes(termo.toLowerCase())).map((descritor) => descritor.templateId) : [];
    const where: Prisma.DocumentoPreenchidoWhereInput = { AND: [recorte, {
      ...(consulta.situacao ? { situacao: consulta.situacao } : {}),
      ...(termo ? { OR: [
        { aluno: { nome: { contains: termo } } },
        { estagio: { nomeAlunoHistorico: { contains: termo } } },
        { estagio: { convenio: { instituicao: { nome: { contains: termo } } } } },
        { estagio: { orientador: { nome: { contains: termo } } } },
        { estagio: { supervisor: { nome: { contains: termo } } } },
        ...(templatesDoTermo.length ? [{ templateId: { in: templatesDoTermo } }] : []),
      ] } : {}),
    }] };
    const total = await tx.documentoPreenchido.count({ where });
    const { tamanho, pagina, skip } = paginacao(consulta, total);
    const linhas = await tx.documentoPreenchido.findMany({ where, orderBy: [{ atualizadoEm: "desc" }, { id: "asc" }], take: tamanho, skip });
    return { itens: linhas.map(paraDominioDocumento), total, pagina, tamanhoPagina: tamanho };
  }, { cliente: prisma }, { isolationLevel: "RepeatableRead" });
}

export async function documentosParaParecerPersistente(fila: TipoParecer, autor: Usuario, consulta: ConsultaDocumentos = {}): Promise<Pagina<DocumentoPreenchido>> {
  const { prisma } = await carregarCliente();
  return executarTransacao(async (tx) => {
    const atual = await tx.usuario.findUnique({ where: { id: autor.id } });
    const podeVerFila =
      Boolean(atual && atual.situacao === "ativo" && atual.papel === autor.papel) &&
      (atual?.papel === "administrador" ||
        (fila === "coordenador_curso" && atual?.papel === "coordenador_curso" && Boolean(atual.cursoId)) ||
        (fila === "comissao_estagio" && atual?.papel === "coordenador_estagio" && Boolean(atual.membroComissaoEstagio)));
    if (!podeVerFila || fila === "externo" || fila === "nenhum") return { itens: [], total: 0, pagina: 1, tamanhoPagina: Math.max(1, consulta.tamanho ?? TAMANHO_PADRAO) };
    const templatesDaFila = DESCRITORES.filter((descritor) => descritor.metadados?.tipoParecer === fila).map((descritor) => descritor.templateId);
    const recorte = await recorteDocumentos(tx, autor.id);
    const where: Prisma.DocumentoPreenchidoWhereInput = { AND: [recorte, {
      situacao: { in: ["submetido", "em_analise"] },
      templateId: { in: templatesDaFila },
      ...(consulta.estagioId ? { estagioId: consulta.estagioId } : {}),
      OR: [
        { estagioId: null },
        { estagio: { canceladoEm: null, excluidoEm: null } },
      ],
    }] };
    const total = await tx.documentoPreenchido.count({ where });
    const { tamanho, pagina, skip } = paginacao(consulta, total);
    const linhas = await tx.documentoPreenchido.findMany({ where, orderBy: [{ criadoEm: "desc" }, { id: "asc" }], take: tamanho, skip });
    return { itens: linhas.map(paraDominioDocumento), total, pagina, tamanhoPagina: tamanho };
  }, { cliente: prisma }, { isolationLevel: "RepeatableRead" });
}

export async function dadosDoPainelFluxoPersistente(autor: Usuario, estagioIds: string[]) {
  const { exigirAcessoEstagio } = await import("./estagios");
  for (const estagioId of estagioIds) await exigirAcessoEstagio(autor, estagioId);
  const { prisma } = await carregarCliente();
  return executarTransacao(async (tx) => {
    const documentos = await tx.documentoPreenchido.findMany({ where: { estagioId: { in: estagioIds } }, select: { id: true, assinaturasConfirmadasPorId: true } });
    const documentosIds = documentos.map((documento) => documento.id);
    const [observacoes, pareceres, envios] = await Promise.all([
      tx.observacaoDocumento.findMany({ where: { documentoId: { in: documentosIds } }, orderBy: [{ data: "asc" }, { id: "asc" }] }),
      tx.parecer.findMany({ where: { documentoId: { in: documentosIds } }, orderBy: [{ data: "asc" }, { id: "asc" }] }),
      tx.envioExterno.findMany({ where: { documentoId: { in: documentosIds } }, orderBy: [{ criadoEm: "asc" }, { id: "asc" }] }),
    ]);
    const autoresIds = new Set<string>([autor.id, ...envios.map((envio) => envio.autorId), ...observacoes.map((obs) => obs.autorId), ...pareceres.map((parecer) => parecer.autorId), ...documentos.map((documento) => documento.assinaturasConfirmadasPorId).filter((valor): valor is string => Boolean(valor))]);
    const usuarios = await tx.usuario.findMany({ where: { id: { in: [...autoresIds] } }, select: { id: true, nome: true } });
    const observacoesDominio: ObservacaoDocumento[] = observacoes.map((linha) => ({ id: linha.id, documentoId: linha.documentoId, conteudo: linha.conteudo, autorId: linha.autorId, data: linha.data.toISOString() }));
    const pareceresDominio: Parecer[] = pareceres.map((linha) => ({ id: linha.id, documentoId: linha.documentoId, decisao: linha.decisao as Parecer["decisao"], consideracoes: linha.consideracoes ?? undefined, autorId: linha.autorId, fila: linha.fila as TipoParecer, data: linha.data.toISOString() }));
    const enviosDominio: EnvioExterno[] = envios.map((linha) => ({ id: linha.id, documentoId: linha.documentoId, destinatario: linha.destinatario, destinatarioEmail: linha.destinatarioEmail, destinatarioPapel: linha.destinatarioPapel ?? undefined, autorId: linha.autorId, status: linha.status as StatusEnvioExterno, erro: linha.erro ?? undefined, tentativa: linha.tentativa, enviadoEm: (linha.enviadoEm ?? linha.criadoEm).toISOString() }));
    return {
      papel: autor.papel,
      autorId: autor.id,
      observacoes: observacoesDominio,
      pareceres: pareceresDominio,
      envios: enviosDominio,
      nomesAutores: Object.fromEntries(usuarios.map((usuario) => [usuario.id, usuario.nome])),
    };
  }, { cliente: prisma }, { isolationLevel: "RepeatableRead" });
}
