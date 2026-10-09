import { transicaoDocumentoPermitida } from "@/lib/domain/status";
import type {
  DocumentoPreenchido,
  Pagina,
  Papel,
  SituacaoDocumento,
  TemplateDocumento,
  TipoParecer,
  TipoTemplate,
  Usuario,
} from "@/lib/domain/types";
import {
  camposDoTemplate,
  classificacaoDoCampo,
  DESCRITORES,
  descritorPorTemplate,
} from "@/lib/templates/descriptors";

import { cursoPorId, pessoaPorId, convenioPorId } from "./catalogo";
import { estagioPorId } from "./estagios";
import { filtrarPorTexto, paginar } from "./paginacao";
import type { OpcoesPaginacao } from "./paginacao";
import { notificar } from "./sessao";
import { agora, obterEstado, novoId } from "./store";

/** Documentos preenchidos: rascunho, submissão, parecer e inativação. */

export interface ProblemaValidacao {
  campo: string;
  mensagem: string;
}

export async function listarTemplates(
  tipo?: TemplateDocumento["tipo"],
): Promise<TemplateDocumento[]> {
  return obterEstado()
    .templates.filter((template) => template.situacao === "ativo")
    .filter((template) => !tipo || template.tipo === tipo);
}

export async function templatePorId(id: string): Promise<TemplateDocumento | null> {
  return obterEstado().templates.find((template) => template.id === id) ?? null;
}

/** Item do catálogo (8.3): identidade do documento e a distinção de uso. */
export interface ItemCatalogo {
  id: string;
  nome: string;
  descricao: string;
  /** `preenchivel` abre formulário; `download` apenas baixa o arquivo do Kit. */
  tipo: TipoTemplate;
  /** Quem pode abrir o formulário; vazio nos documentos só para download. */
  papeisPreenchimento: Papel[];
  /** O preenchimento depende de um estágio selecionado. */
  exigeEstagio: boolean;
  /** Número da versão vigente, ou null quando o documento não tem versão. */
  versaoVigente: number | null;
}

/**
 * Catálogo dos doze documentos do Kit (8.3). A distinção vem do descritor
 * (D5): `preenchivel` abre o formulário, `download` nunca abre formulário.
 */
export async function catalogoDocumentos(): Promise<ItemCatalogo[]> {
  const templates = await listarTemplates();

  return DESCRITORES.map((descritor) => {
    const template = templates.find((item) => item.id === descritor.templateId);
    const preenchivel = descritor.preenchivel;

    return {
      id: descritor.templateId,
      nome: template?.nome ?? descritor.titulo,
      descricao: descritor.descricao,
      tipo: preenchivel ? "preenchivel" : "download",
      papeisPreenchimento: preenchivel ? (descritor.metadados?.papeisPreenchimento ?? []) : [],
      exigeEstagio: preenchivel && descritor.metadados?.exigeEstagio === true,
      versaoVigente:
        template?.versoes.find((versao) => versao.vigente)?.versao ?? null,
    };
  });
}

/**
 * Templates que o papel pode preencher. Documentos que exigem estágio só
 * aparecem quando há estágio válido selecionado.
 */
export async function templatesDisponiveis(
  papel: Papel,
  estagioId?: string,
): Promise<TemplateDocumento[]> {
  const estagio = estagioId ? await estagioPorId(estagioId) : null;

  return (await listarTemplates("preenchivel")).filter((template) => {
    if (!template.metadados?.papeisPreenchimento.includes(papel)) return false;
    if (template.metadados.exigeEstagio && !estagio) return false;

    return true;
  });
}

export interface ConsultaDocumentos extends OpcoesPaginacao {
  estagioId?: string;
  situacao?: SituacaoDocumento;
  busca?: string;
}

export async function listarDocumentos(
  alunoId: string,
  consulta: ConsultaDocumentos = {},
): Promise<Pagina<DocumentoPreenchido>> {
  const filtrados = obterEstado()
    .documentos.filter((documento) => documento.alunoId === alunoId)
    .filter((documento) => !consulta.estagioId || documento.estagioId === consulta.estagioId)
    .filter((documento) => !consulta.situacao || documento.situacao === consulta.situacao)
    .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));

  return paginar(
    filtrarPorTexto(filtrados, consulta.busca ?? "", (documento) => [documento.templateId]),
    consulta,
  );
}

export async function documentosDoAluno(alunoId: string): Promise<DocumentoPreenchido[]> {
  return (await listarDocumentos(alunoId, { tamanho: 100 })).itens;
}

export async function documentosDoEstagio(estagioId: string): Promise<DocumentoPreenchido[]> {
  return obterEstado().documentos.filter((documento) => documento.estagioId === estagioId);
}

export async function documentoPorId(id: string): Promise<DocumentoPreenchido | null> {
  return obterEstado().documentos.find((documento) => documento.id === id) ?? null;
}

/** Valida os valores contra o descritor: obrigatoriedade e limites de palavras. */
export function validarValores(
  templateId: string,
  valores: Record<string, unknown>,
): ProblemaValidacao[] {
  const problemas: ProblemaValidacao[] = [];
  const campos = camposDoTemplate(templateId);

  for (const campo of campos) {
    // Trechos de texto do template não são valores: `fixo` entra no documento
    // final e `instrucao` é descartada pelo gerador.
    if (classificacaoDoCampo(campo) !== "campo") continue;

    if (campo.somenteLeitura) continue;

    const valor = valores[campo.id];
    const vazio = valor === undefined || valor === null || String(valor).trim() === "";

    if (campo.obrigatorio && vazio) {
      problemas.push({ campo: campo.id, mensagem: `${campo.rotulo} é obrigatório.` });

      continue;
    }

    if (vazio) continue;

    if (campo.maximoPalavras && typeof valor === "string") {
      const palavras = valor.trim().split(/\s+/).filter(Boolean).length;

      if (palavras > campo.maximoPalavras) {
        problemas.push({
          campo: campo.id,
          mensagem: `${campo.rotulo} tem ${palavras} palavras e o limite é ${campo.maximoPalavras}.`,
        });
      }
    }

    if (campo.max && typeof valor === "number" && valor > campo.max) {
      problemas.push({
        campo: campo.id,
        mensagem: `${campo.rotulo} deve ser no máximo ${campo.max}.`,
      });
    }

    if (campo.min && typeof valor === "number" && valor < campo.min) {
      problemas.push({
        campo: campo.id,
        mensagem: `${campo.rotulo} deve ser no mínimo ${campo.min}.`,
      });
    }
  }

  return problemas;
}

export async function criarRascunho(
  aluno: Usuario,
  templateId: string,
  estagioId?: string,
  valores: Record<string, unknown> = {},
): Promise<DocumentoPreenchido> {
  const template = await templatePorId(templateId);

  if (!template || template.tipo !== "preenchivel" || !template.metadados) {
    throw new Error("Template preenchível não encontrado.");
  }

  if (!template.metadados.papeisPreenchimento.includes("aluno")) {
    throw new Error("Documento não disponível para o aluno.");
  }

  if (template.metadados.exigeEstagio && !estagioId) {
    throw new Error("Selecione o estágio para preencher este documento.");
  }

  if (estagioId && !(await estagioPorId(estagioId))) {
    throw new Error("Estágio não encontrado.");
  }

  const existente = obterEstado().documentos.find(
    (documento) =>
      documento.templateId === templateId &&
      documento.alunoId === aluno.id &&
      documento.estagioId === estagioId &&
      documento.situacao !== "inativo",
  );

  if (existente) return existente;

  const versaoVigente = template.versoes.find((versao) => versao.vigente);
  const momento = agora();

  const documento: DocumentoPreenchido = {
    id: novoId("doc"),
    templateId,
    alunoId: aluno.id,
    estagioId,
    versaoTemplate: versaoVigente?.versao ?? 1,
    valores: { ...(await valoresAutomaticos(templateId, aluno, estagioId)), ...valores },
    situacao: "rascunho",
    criadoEm: momento,
    atualizadoEm: momento,
  };

  obterEstado().documentos.push(documento);

  return documento;
}

/** Campos `somenteLeitura` do descritor, preenchidos a partir do cadastro e do estágio. */
export async function valoresAutomaticos(
  templateId: string,
  aluno: Usuario,
  estagioId?: string,
): Promise<Record<string, unknown>> {
  const descriptor = descritorPorTemplate(templateId);
  const estagio = estagioId ? await estagioPorId(estagioId) : null;
  const dados = aluno.dadosPessoais;
  const curso = dados ? await cursoPorId(dados.cursoId) : null;

  const base: Record<string, unknown> = {
    nomeCompleto: aluno.nome,
    cpf: dados?.cpf,
    rg: dados?.rg,
    dataNascimento: dados?.dataNascimento,
    email: dados?.email ?? aluno.email,
    telefone: dados?.telefone,
    celular: dados?.celular,
    endereco: dados
      ? `${dados.endereco.logradouro}, ${dados.endereco.numero} - ${dados.endereco.bairro}`
      : undefined,
    enderecoAluno: dados
      ? `${dados.endereco.logradouro}, ${dados.endereco.numero} - ${dados.endereco.bairro}`
      : undefined,
    cepAluno: dados?.endereco.cep,
    bairro: dados?.endereco.bairro,
    cidade: dados?.endereco.cidade,
    cep: dados?.endereco.cep,
    telefoneAluno: dados?.telefone,
    celularAluno: dados?.celular,
    emailAluno: dados?.email ?? aluno.email,
    curso: curso?.nome,
    turma: dados?.turmaId,
    ano: dados?.periodoId,
    anoSemestre: dados?.periodoId,
    semestre: dados?.periodoId,
    campus: aluno.campus,
    aluno: aluno.nome,
    matricula: aluno.matricula,
  };

  if (estagio) {
    const [convenio, supervisor, orientador] = await Promise.all([
      convenioPorId(estagio.convenioId),
      pessoaPorId(estagio.supervisorId),
      pessoaPorId(estagio.orientadorId),
    ]);

    Object.assign(base, {
      instituicao: convenio?.instituicao,
      localEstagio: convenio?.instituicao,
      razaoSocial: convenio?.instituicao,
      supervisor: supervisor?.nome,
      orientador: orientador?.nome,
      dataInicio: estagio.dataInicio,
      dataFim: estagio.dataFim,
    });
  }

  const automaticos = (descriptor?.auto ?? []).map((campo) => campo.id);

  return Object.fromEntries(
    Object.entries(base).filter(
      ([chave, valor]) => automaticos.includes(chave) && valor !== undefined,
    ),
  );
}

export async function salvarRascunho(
  documentoId: string,
  valores: Record<string, unknown>,
): Promise<DocumentoPreenchido> {
  const documento = await documentoPorId(documentoId);

  if (!documento) throw new Error("Documento não encontrado.");

  if (documento.situacao !== "rascunho") {
    throw new Error("Somente rascunhos podem ser editados.");
  }

  documento.valores = { ...documento.valores, ...valores };
  documento.atualizadoEm = agora();

  return documento;
}

export async function submeter(documentoId: string): Promise<DocumentoPreenchido> {
  const documento = await documentoPorId(documentoId);

  if (!documento) throw new Error("Documento não encontrado.");

  const template = await templatePorId(documento.templateId);
  const problemas = validarValores(documento.templateId, documento.valores);

  if (problemas.length > 0) {
    throw new Error(problemas[0].mensagem);
  }

  const alvo: SituacaoDocumento =
    template?.metadados?.tipoParecer === "nenhum" ? "aprovado" : "submetido";

  if (!transicaoDocumentoPermitida(documento.situacao, alvo)) {
    throw new Error(`Não é possível enviar um documento em "${documento.situacao}".`);
  }

  documento.situacao = alvo;
  documento.atualizadoEm = agora();

  if (alvo === "aprovado") {
    notificar(
      documento.alunoId,
      "Documento concluído",
      "Não há parecer necessário para este documento.",
      "parecer",
    );
  }

  return documento;
}

/** Curso do aluno dono do documento. */
export function cursoDoDocumento(documento: DocumentoPreenchido): string | undefined {
  const aluno = obterEstado().usuarios.find((usuario) => usuario.id === documento.alunoId);

  return aluno?.dadosPessoais?.cursoId;
}

/**
 * Fila de parecer. O Coordenador de Curso só vê documentos de alunos do seu
 * curso; a Comissão de Estágio vê os documentos que exigem parecer dela.
 */
export async function documentosParaParecer(
  fila: TipoParecer,
  autor: Usuario,
  consulta: ConsultaDocumentos = {},
): Promise<Pagina<DocumentoPreenchido>> {
  const emAnalise = obterEstado()
    .documentos.filter((documento) => documento.situacao === "em_analise")
    .filter((documento) => !consulta.estagioId || documento.estagioId === consulta.estagioId);

  const naFila: DocumentoPreenchido[] = [];

  for (const documento of emAnalise) {
    const template = await templatePorId(documento.templateId);

    if (template?.metadados?.tipoParecer !== fila) continue;
    if (fila === "externo") continue;
    if (
      fila === "coordenador_curso" &&
      autor.cursoId &&
      cursoDoDocumento(documento) !== autor.cursoId
    ) {
      continue;
    }

    naFila.push(documento);
  }

  return paginar(naFila, consulta);
}

export async function registrarParecer(
  documentoId: string,
  decisao: "aprovado" | "indeferido",
  autor: Usuario,
  consideracoes?: string,
): Promise<DocumentoPreenchido> {
  const documento = await documentoPorId(documentoId);

  if (!documento) throw new Error("Documento não encontrado.");

  if (!transicaoDocumentoPermitida(documento.situacao, decisao)) {
    throw new Error(`Não é possível emitir parecer a partir de "${documento.situacao}".`);
  }

  documento.situacao = decisao;
  documento.atualizadoEm = agora();

  obterEstado().pareceres.push({
    id: novoId("par"),
    documentoId,
    decisao,
    consideracoes,
    autorId: autor.id,
    fila: (await templatePorId(documento.templateId))?.metadados?.tipoParecer ?? "nenhum",
    data: agora(),
  });

  notificar(
    documento.alunoId,
    decisao === "aprovado" ? "Documento aprovado" : "Documento indeferido",
    consideracoes ?? "",
    "parecer",
  );

  return documento;
}

export async function inativarDocumento(documentoId: string): Promise<DocumentoPreenchido> {
  const documento = await documentoPorId(documentoId);

  if (!documento) throw new Error("Documento não encontrado.");

  documento.situacao = "inativo";
  documento.inativadoEm = agora();
  documento.atualizadoEm = agora();

  return documento;
}

/** Move para em_analise: usado pelo Coordenador de Estágio ao abrir a fila. */
export async function iniciarAnalise(documentoId: string): Promise<DocumentoPreenchido> {
  const documento = await documentoPorId(documentoId);

  if (!documento) throw new Error("Documento não encontrado.");

  if (!transicaoDocumentoPermitida(documento.situacao, "em_analise")) {
    throw new Error(`Não é possível analisar um documento em "${documento.situacao}".`);
  }

  documento.situacao = "em_analise";
  documento.atualizadoEm = agora();

  return documento;
}

export function contarPalavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

export function descritorDoDocumento(documento: DocumentoPreenchido) {
  return descritorPorTemplate(documento.templateId);
}
