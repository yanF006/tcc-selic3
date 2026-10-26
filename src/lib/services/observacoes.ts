import type { DocumentoPreenchido, ObservacaoDocumento, Usuario } from "@/lib/domain/types";
import { cursoDoUsuario } from "@/lib/domain/usuario";
import { documentoPorId, podeConsultarDocumento } from "./documentos";
import { ErroDeRegra } from "./erros";
import { agora, novoId, obterEstado } from "./store";

export function podeAcrescentarObservacao(usuario: Usuario, documento: DocumentoPreenchido) {
  if (usuario.situacao !== "ativo") return false;
  const aluno = obterEstado().usuarios.find((registro) => registro.id === documento.alunoId);
  const estagio = obterEstado().estagios.find((registro) => registro.id === documento.estagioId);
  const cursoId = estagio?.excluidoEm ? estagio.cursoIdHistorico : aluno && cursoDoUsuario(aluno);
  return (
    (usuario.papeis.includes("coordenador_estagio") && usuario.campus === aluno?.campus) ||
    (usuario.papeis.includes("coordenador_curso") &&
      Boolean(usuario.cursoId) &&
      cursoId === usuario.cursoId)
  );
}

export async function acrescentarObservacao(
  documentoId: string,
  conteudo: string,
  autor: Usuario,
): Promise<ObservacaoDocumento> {
  const documento = await documentoPorId(documentoId);
  if (
    !documento ||
    !podeAcrescentarObservacao(autor, documento) ||
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
  const documento = await documentoPorId(documentoId);
  if (!documento || !(await podeConsultarDocumento(usuario, documento))) {
    throw new ErroDeRegra("Documento não disponível.", "acesso_negado");
  }
  return obterEstado().observacoes.filter((registro) => registro.documentoId === documentoId);
}
