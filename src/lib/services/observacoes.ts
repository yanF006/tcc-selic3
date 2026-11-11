import type { DocumentoPreenchido, ObservacaoDocumento, Usuario } from "@/lib/domain/types";
import { cursoDoUsuario } from "@/lib/domain/usuario";
import { documentoPorId, podeConsultarDocumento } from "./documentos";
import { ErroDeRegra } from "./erros";
import { agora, novoId, obterEstado } from "./store";
import { bancoConfigurado } from "@/lib/db/prisma";

export async function podeAcrescentarObservacao(usuario: Usuario, documento: DocumentoPreenchido) {
  if (usuario.situacao !== "ativo") return false;
  if (bancoConfigurado()) {
    const { podeAcrescentarObservacaoNoBanco } = await import("./observacoes-persistentes");
    return podeAcrescentarObservacaoNoBanco((await (await import("@/lib/db/prisma")).carregarCliente()).prisma, usuario.id, documento.id);
  }
  const aluno = obterEstado().usuarios.find((registro) => registro.id === documento.alunoId);
  const estagio = obterEstado().estagios.find((registro) => registro.id === documento.estagioId);
  const cursoId = estagio?.excluidoEm ? estagio.cursoIdHistorico : aluno && cursoDoUsuario(aluno);
  return (
    (usuario.papel === "coordenador_estagio" && usuario.campus === aluno?.campus) ||
    (usuario.papel === "coordenador_curso" &&
      Boolean(usuario.cursoId) &&
      cursoId === usuario.cursoId)
  );
}

export async function acrescentarObservacao(
  documentoId: string,
  conteudo: string,
  autor: Usuario,
): Promise<ObservacaoDocumento> {
  if (bancoConfigurado()) {
    const { acrescentarObservacaoPersistente } = await import("./observacoes-persistentes");
    return acrescentarObservacaoPersistente(documentoId, conteudo, autor.id);
  }
  const documento = await documentoPorId(documentoId);
  if (
    !documento ||
    !(await podeAcrescentarObservacao(autor, documento)) ||
    !(await podeConsultarDocumento(autor, documento))
  ) {
    throw new ErroDeRegra("Observação não disponível para este usuário.", "acesso_negado");
  }
  if (typeof conteudo !== "string" || !conteudo.trim()) {
    throw new ErroDeRegra("Informe o conteúdo da observação.", "observacao_vazia");
  }
  const observacao = {
    id: novoId("obs"),
    documentoId,
    conteudo: conteudo.trim(),
    autorId: autor.id,
    data: agora(),
  };
  obterEstado().observacoes.push(observacao);
  return observacao;
}

export async function observacoesDoDocumento(documentoId: string, usuario: Usuario) {
  if (bancoConfigurado()) {
    const { observacoesDoDocumentoPersistente } = await import("./observacoes-persistentes");
    return observacoesDoDocumentoPersistente(documentoId, usuario.id);
  }
  const documento = await documentoPorId(documentoId);
  if (!documento || !(await podeConsultarDocumento(usuario, documento))) {
    throw new ErroDeRegra("Documento não disponível.", "acesso_negado");
  }
  return obterEstado().observacoes.filter((registro) => registro.documentoId === documentoId);
}
