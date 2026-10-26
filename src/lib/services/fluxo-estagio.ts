import {
  DOCUMENTOS_INICIAIS,
  documentoInicial,
  estagioEncerrado,
  estagioLiberado,
} from "@/lib/domain/fluxo-estagio";
import type { DocumentoPreenchido, EnvioExterno, Usuario } from "@/lib/domain/types";
import {
  criarRascunho,
  documentoPorId,
  documentosDoEstagio,
  podeConsultarDocumento,
  submeter,
  templatePorId,
  validarValores,
} from "./documentos";
import { exigirAcessoEstagio } from "./estagios";
import { ErroDeRegra } from "./erros";
import { acrescentarObservacao, podeAcrescentarObservacao } from "./observacoes";
import { notificar } from "./sessao";
import { agora, novoId, obterEstado } from "./store";
import { cursoDoUsuario } from "@/lib/domain/usuario";

export type ValoresDocumentosIniciais = Record<string, Record<string, unknown>>;

export async function prepararDocumentosIniciais(
  estagioId: string,
  aluno: Usuario,
  valores: ValoresDocumentosIniciais = {},
): Promise<DocumentoPreenchido[]> {
  const estagio = await exigirAcessoEstagio(aluno, estagioId);
  if (estagio.alunoId !== aluno.id || estagioEncerrado(estagio)) {
    throw new ErroDeRegra("Solicitação não disponível.", "acesso_negado");
  }
  const documentos = [];
  for (const templateId of DOCUMENTOS_INICIAIS) {
    documentos.push(await criarRascunho(aluno, templateId, estagioId, valores[templateId]));
  }
  return documentos;
}

export async function solicitarEncaminhamento(estagioId: string, aluno: Usuario) {
  const estagio = await exigirAcessoEstagio(aluno, estagioId);
  if (
    estagio.alunoId !== aluno.id ||
    estagio.situacao !== "em_preparacao" ||
    estagioEncerrado(estagio)
  ) {
    throw new ErroDeRegra(
      "Solicitação não disponível para encaminhamento.",
      "solicitacao_invalida",
    );
  }
  const documentos = await documentosDoEstagio(estagioId);
  const iniciais = DOCUMENTOS_INICIAIS.map((templateId) =>
    documentos.find((doc) => doc.templateId === templateId && doc.situacao !== "inativo"),
  );
  for (let i = 0; i < iniciais.length; i++) {
    const documento = iniciais[i];
    if (!documento)
      throw new ErroDeRegra("Complete os três documentos iniciais.", "documentacao_pendente");
    const problemas = validarValores(
      documento.templateId,
      documento.valores,
      documento.versaoTemplate,
    );
    if (problemas.length) {
      const template = await templatePorId(documento.templateId);
      throw new ErroDeRegra(`${template?.nome}: ${problemas[0].mensagem}`, "documentacao_pendente");
    }
  }
  const formulario = iniciais[0]!;
  if (formulario.situacao !== "rascunho") {
    throw new ErroDeRegra("O formulário já foi encaminhado. Aguarde o parecer.", "ja_encaminhado");
  }
  await submeter(formulario.id);
  estagio.encaminhadoEm = agora();
  estagio.encaminhadoPorId = aluno.id;
  for (const documento of iniciais) documento!.correcaoAberta = false;
  return estagio;
}

export async function enviarParaAssinaturas(
  documentoId: string,
  autor: Usuario,
): Promise<EnvioExterno[]> {
  const documento = await documentoPorId(documentoId);
  if (!documento || !(await podeConsultarDocumento(autor, documento))) {
    throw new ErroDeRegra("Documento não disponível.", "acesso_negado");
  }
  const estado = obterEstado();
  const estagio = documento.estagioId
    ? await exigirAcessoEstagio(autor, documento.estagioId)
    : null;
  if (estagio && estagioEncerrado(estagio))
    throw new ErroDeRegra("Estágio cancelado ou excluído.", "estagio_encerrado");
  if (
    autor.id !== documento.alunoId &&
    !autor.papeis.some((papel) =>
      ["coordenador_curso", "coordenador_estagio", "administrador"].includes(papel),
    )
  ) {
    throw new ErroDeRegra("Envio não permitido para este usuário.", "acesso_negado");
  }
  if (documentoInicial(documento.templateId)) {
    const formulario = (await documentosDoEstagio(documento.estagioId!)).find(
      (doc) => doc.templateId === DOCUMENTOS_INICIAIS[0] && doc.situacao !== "inativo",
    );
    if (!estagio?.encaminhadoEm || formulario?.situacao !== "aprovado") {
      throw new ErroDeRegra(
        "Aguarde o parecer favorável no Formulário de Liberação.",
        "parecer_pendente",
      );
    }
  }
  const template = await templatePorId(documento.templateId);
  if (!template?.metadados) throw new ErroDeRegra("Template indisponível.", "template_invalido");
  const problemas = validarValores(
    documento.templateId,
    documento.valores,
    documento.versaoTemplate,
  );
  if (problemas.length) throw new ErroDeRegra(problemas[0].mensagem, "documentacao_pendente");
  const aluno = estado.usuarios.find((usuario) => usuario.id === documento.alunoId);
  const envios: EnvioExterno[] = [];
  const assinaturas = documentoInicial(documento.templateId)
    ? template.metadados.assinaturas
    : template.metadados.assinaturas.filter((assinatura) => assinatura.tipo === "externa");
  for (const assinatura of assinaturas) {
    const pessoa =
      assinatura.papel === "aluno"
        ? aluno
        : assinatura.papel === "coordenador_curso"
          ? estado.usuarios.find(
              (usuario) =>
                usuario.situacao === "ativo" &&
                usuario.papeis.includes("coordenador_curso") &&
                aluno &&
                usuario.cursoId === cursoDoUsuario(aluno),
            )
          : assinatura.papel === "orientador"
            ? estado.pessoas.find((pessoa) => pessoa.id === estagio?.orientadorId)
            : assinatura.papel === "supervisor" ||
                (assinatura.papel === "externo" && /supervisor/i.test(assinatura.rotulo))
              ? estado.pessoas.find((pessoa) => pessoa.id === estagio?.supervisorId)
              : undefined;
    const email = pessoa?.email ?? "";
    const envio: EnvioExterno = {
      id: novoId("env"),
      documentoId,
      destinatario: pessoa?.nome ?? assinatura.rotulo,
      destinatarioEmail: email,
      destinatarioPapel: assinatura.papel,
      autorId: autor.id,
      status: email ? "enviado" : "falha",
      erro: email ? undefined : "E-mail indisponível. Obtenha a assinatura pelo meio convencional.",
      tentativa:
        estado.envios.filter(
          (envio) =>
            envio.documentoId === documentoId &&
            envio.destinatario === (pessoa?.nome ?? assinatura.rotulo),
        ).length + 1,
      enviadoEm: agora(),
    };
    estado.envios.push(envio);
    envios.push(envio);
    if (!email)
      notificar(
        documento.alunoId,
        "E-mail do assinante indisponível",
        `${assinatura.rotulo}: obtenha a assinatura pelo meio convencional.`,
        "envio",
      );
  }
  return envios;
}

export async function enviarDocumentacaoInicial(estagioId: string, autor: Usuario) {
  const documentos = await documentosDoEstagio(estagioId);
  const envios = [];
  for (const templateId of DOCUMENTOS_INICIAIS) {
    const documento = documentos.find(
      (doc) => doc.templateId === templateId && doc.situacao !== "inativo",
    );
    if (!documento)
      throw new ErroDeRegra("Documentação inicial pendente.", "documentacao_pendente");
    envios.push(...(await enviarParaAssinaturas(documento.id, autor)));
  }
  return envios;
}

export async function confirmarAssinaturas(
  estagioId: string,
  autor: Usuario,
  confirmacoes: { documentoId: string; confirmado: boolean; observacao?: string }[],
) {
  const estagio = await exigirAcessoEstagio(autor, estagioId);
  if (!autor.papeis.includes("coordenador_estagio"))
    throw new ErroDeRegra("A conferência cabe ao Coordenador de Estágio.", "acesso_negado");
  if (estagioEncerrado(estagio) || estagio.situacao !== "em_preparacao")
    throw new ErroDeRegra("Solicitação não disponível para conferência.", "solicitacao_invalida");
  const documentos = await documentosDoEstagio(estagioId);
  const iniciais = DOCUMENTOS_INICIAIS.map((id) =>
    documentos.find((doc) => doc.templateId === id && doc.situacao !== "inativo"),
  );
  if (iniciais[0]?.situacao !== "aprovado")
    throw new ErroDeRegra(
      "Aguarde o parecer favorável no Formulário de Liberação.",
      "parecer_pendente",
    );
  if (confirmacoes.some((item) => !iniciais.some((doc) => doc?.id === item.documentoId)))
    throw new ErroDeRegra("Documento não pertence à conferência inicial.", "documento_invalido");
  if (
    iniciais.some(
      (doc) =>
        !doc ||
        !confirmacoes.some((item) => item.documentoId === doc.id && item.confirmado === true),
    )
  ) {
    throw new ErroDeRegra(
      "Confirme as assinaturas dos três documentos iniciais.",
      "assinatura_pendente",
    );
  }
  for (const doc of iniciais) {
    if (!podeAcrescentarObservacao(autor, doc!))
      throw new ErroDeRegra("Documento não disponível.", "acesso_negado");
  }
  const momento = agora();
  for (const documento of iniciais) {
    documento!.assinaturasConfirmadasEm = momento;
    documento!.assinaturasConfirmadasPorId = autor.id;
    const texto = confirmacoes.find((item) => item.documentoId === documento!.id)?.observacao;
    if (texto?.trim()) await acrescentarObservacao(documento!.id, texto, autor);
  }
  estagio.situacao = "em_andamento";
  estagio.liberadoEm = momento;
  estagio.liberadoPorId = autor.id;
  notificar(
    estagio.alunoId,
    "Estágio liberado",
    "Você pode seguir com os processos de estágio e acessar os demais documentos.",
  );
  return estagio;
}

export async function reabrirParaCorrecao(estagioId: string, aluno: Usuario) {
  const estagio = await exigirAcessoEstagio(aluno, estagioId);
  const documentos = await documentosDoEstagio(estagioId);
  const formulario = documentos.find(
    (doc) => doc.templateId === DOCUMENTOS_INICIAIS[0] && doc.situacao === "indeferido",
  );
  if (
    estagio.alunoId !== aluno.id ||
    estagioLiberado(estagio) ||
    estagioEncerrado(estagio) ||
    !formulario
  ) {
    throw new ErroDeRegra(
      "A correção só está disponível após indeferimento.",
      "correcao_indisponivel",
    );
  }
  formulario.situacao = "rascunho";
  formulario.correcaoAberta = true;
  return formulario;
}

export async function dadosDoPainelFluxo(autor: Usuario, estagioIds: string[]) {
  for (const id of estagioIds) await exigirAcessoEstagio(autor, id);
  const ids = new Set(estagioIds);
  const estado = obterEstado();
  const documentosIds = new Set(
    estado.documentos.filter((doc) => doc.estagioId && ids.has(doc.estagioId)).map((doc) => doc.id),
  );
  const observacoes = estado.observacoes.filter((obs) => documentosIds.has(obs.documentoId));
  const pareceres = estado.pareceres.filter((parecer) => documentosIds.has(parecer.documentoId));
  const envios = estado.envios.filter((envio) => documentosIds.has(envio.documentoId));
  const autoresIds = new Set([
    autor.id,
    ...envios.map((envio) => envio.autorId),
    ...observacoes.map((obs) => obs.autorId),
    ...pareceres.map((parecer) => parecer.autorId),
    ...estado.documentos
      .filter((doc) => documentosIds.has(doc.id))
      .map((doc) => doc.assinaturasConfirmadasPorId),
  ]);
  return {
    papeis: autor.papeis,
    autorId: autor.id,
    observacoes,
    pareceres,
    envios,
    nomesAutores: Object.fromEntries(
      estado.usuarios
        .filter((usuario) => autoresIds.has(usuario.id))
        .map((usuario) => [usuario.id, usuario.nome]),
    ),
  };
}
