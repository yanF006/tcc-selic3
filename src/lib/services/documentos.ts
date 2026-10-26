import { transicaoDocumentoPermitida } from "@/lib/domain/status";
import { conceitoGlobalDasNotas } from "@/lib/domain/avaliacao";
import { documentoInicial, estagioEncerrado, estagioLiberado } from "@/lib/domain/fluxo-estagio";
import {
  esquemaCpf,
  esquemaRg,
  esquemaEmail,
  esquemaTelefone,
  esquemaCelular,
  esquemaCep,
  esquemaData,
} from "@/lib/domain/schemas";
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
  fonteParecer,
} from "@/lib/templates/descriptors";

import { PAPEL_COM_TODAS_AS_PERMISSOES } from "@/lib/auth/permissions";
import {
  enderecoDoGrupo,
  estruturaSuficiente,
  formatarEndereco,
  idsDoGrupo,
} from "@/lib/templates/grupos-endereco";
import { usuarioPorId } from "./administracao";

import { cursoPorId, turmaPorId, periodoPorId, pessoaPorId, convenioPorId } from "./catalogo";
import {
  exigirAcessoEstagio,
  podeConsultarEstagio,
  estagioPorId,
  totalHorasDoEstagio,
  correcaoInicialPermitida,
} from "./estagios";
import { ErroDeRegra } from "./erros";
import { filtrarPorTexto, paginar } from "./paginacao";
import type { OpcoesPaginacao } from "./paginacao";
import { notificar } from "./sessao";
import { agora, obterEstado, novoId } from "./store";
import { descritorDaVersao } from "./templates";

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
  ativo: boolean;
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
      versaoVigente: template?.versoes.find((versao) => versao.vigente)?.versao ?? null,
      ativo: template?.situacao === "ativo",
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
    if (
      estagio &&
      (estagioEncerrado(estagio) || (!documentoInicial(template.id) && !estagioLiberado(estagio)))
    )
      return false;

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

export async function documentosDaCoordenacao(usuario: Usuario, consulta: ConsultaDocumentos = {}) {
  if (
    usuario.situacao !== "ativo" ||
    !usuario.papeis.some((papel) =>
      ["administrador", "coordenador_curso", "coordenador_estagio"].includes(papel),
    )
  )
    return paginar([], consulta);
  const permitidos: DocumentoPreenchido[] = [];
  for (const documento of obterEstado().documentos) {
    if (
      (!consulta.situacao || documento.situacao === consulta.situacao) &&
      (await podeConsultarDocumento(usuario, documento))
    )
      permitidos.push(documento);
  }
  const estado = obterEstado();
  const filtrados = filtrarPorTexto(permitidos, consulta.busca ?? "", (documento) => {
    const estagio = estado.estagios.find((registro) => registro.id === documento.estagioId);
    return [
      estagio?.excluidoEm
        ? estagio.nomeAlunoHistorico
        : estado.usuarios.find((registro) => registro.id === documento.alunoId)?.nome,
      estado.templates.find((template) => template.id === documento.templateId)?.nome,
      estado.convenios.find((convenio) => convenio.id === estagio?.convenioId)?.instituicao,
      estado.pessoas.find((pessoa) => pessoa.id === estagio?.orientadorId)?.nome,
      estado.pessoas.find((pessoa) => pessoa.id === estagio?.supervisorId)?.nome,
    ].filter((texto): texto is string => typeof texto === "string");
  });
  return paginar(
    filtrados.sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)),
    consulta,
  );
}

export async function documentosDoEstagio(estagioId: string): Promise<DocumentoPreenchido[]> {
  return obterEstado().documentos.filter((documento) => documento.estagioId === estagioId);
}

export async function documentoPorId(id: string): Promise<DocumentoPreenchido | null> {
  return obterEstado().documentos.find((documento) => documento.id === id) ?? null;
}

export async function documentoDoTemplate(templateId: string, autorId: string, estagioId?: string) {
  return (
    obterEstado().documentos.find(
      (documento) =>
        documento.templateId === templateId &&
        documento.alunoId === autorId &&
        documento.estagioId === estagioId &&
        documento.situacao !== "inativo",
    ) ?? null
  );
}

/** Valida os valores contra o descritor: obrigatoriedade e limites de palavras. */
export function validarValores(
  templateId: string,
  valores: Record<string, unknown>,
  versao?: number,
): ProblemaValidacao[] {
  const problemas: ProblemaValidacao[] = [];
  const campos = camposDoTemplate(templateId, descritorDaVersao(templateId, versao));

  for (const campo of campos) {
    if (fonteParecer(templateId, campo)) continue;
    // Trechos de texto do template não são valores: `fixo` entra no documento
    // final e `instrucao` é descartada pelo gerador.
    if (classificacaoDoCampo(campo) !== "campo") continue;

    const valor = valores[campo.id];
    const vazio =
      valor === undefined ||
      valor === null ||
      valor === false ||
      String(valor).trim() === "" ||
      (Array.isArray(valor) && valor.length === 0);

    if (campo.obrigatorio && vazio) {
      problemas.push({ campo: campo.id, mensagem: `${campo.rotulo} é obrigatório.` });

      continue;
    }

    if (vazio) continue;

    if (campo.tipo === "checkbox" && campo.obrigatorio && valor !== true) {
      problemas.push({ campo: campo.id, mensagem: `${campo.rotulo} deve ser marcado.` });
    }
    if (campo.tipo === "numero" && (typeof valor !== "number" || !Number.isFinite(valor))) {
      problemas.push({ campo: campo.id, mensagem: `${campo.rotulo} deve ser um número válido.` });
      continue;
    }
    if (campo.opcoes && !campo.opcoes.some((opcao) => opcao.valor === valor)) {
      problemas.push({
        campo: campo.id,
        mensagem: `Selecione uma opção válida para ${campo.rotulo}.`,
      });
    }
    const esquemas = {
      cpf: esquemaCpf,
      rg: esquemaRg,
      email: esquemaEmail,
      telefone: esquemaTelefone,
      celular: esquemaCelular,
      cep: esquemaCep,
      data: esquemaData,
    };
    for (const regra of campo.validacao ?? []) {
      if (regra in esquemas) {
        const esquema = esquemas[regra as keyof typeof esquemas];
        const resultado = esquema.safeParse(valor);
        if (!resultado.success) {
          problemas.push({
            campo: campo.id,
            mensagem: `${campo.rotulo}: ${resultado.error.issues[0].message}`,
          });
        }
      }
    }

    if (campo.maximoPalavras && typeof valor === "string") {
      const palavras = valor.trim().split(/\s+/).filter(Boolean).length;

      if (palavras > campo.maximoPalavras) {
        problemas.push({
          campo: campo.id,
          mensagem: `${campo.rotulo} tem ${palavras} palavras e o limite é ${campo.maximoPalavras}.`,
        });
      }
    }

    if (campo.max !== undefined && typeof valor === "number" && valor > campo.max) {
      problemas.push({
        campo: campo.id,
        mensagem: `${campo.rotulo} deve ser no máximo ${campo.max}.`,
      });
    }
    if (campo.min !== undefined && typeof valor === "number" && valor < campo.min) {
      problemas.push({
        campo: campo.id,
        mensagem: `${campo.rotulo} deve ser no mínimo ${campo.min}.`,
      });
    }

    if (campo.min !== undefined && typeof valor === "number" && valor < campo.min) {
      problemas.push({
        campo: campo.id,
        mensagem: `${campo.rotulo} deve ser no mínimo ${campo.min}.`,
      });
    }
  }

  return problemas;
}

/** Quem pode preencher o template (matriz de preenchimento do descritor). */
export function podePreencher(usuario: Usuario, template: TemplateDocumento): boolean {
  if (usuario.situacao !== "ativo" || template.situacao !== "ativo") return false;
  const papeis = template.metadados?.papeisPreenchimento ?? [];

  if (usuario.papeis.includes(PAPEL_COM_TODAS_AS_PERMISSOES)) return true;

  return papeis.some((papel) => usuario.papeis.includes(papel));
}

export async function podeConsultarDocumento(
  usuario: Usuario,
  documento: DocumentoPreenchido,
): Promise<boolean> {
  if (usuario.situacao !== "ativo") return false;
  if (documento.estagioId) {
    const estagio = await estagioPorId(documento.estagioId);
    return Boolean(estagio && podeConsultarEstagio(usuario, estagio));
  }
  return (
    documento.alunoId === usuario.id ||
    usuario.papeis.includes("administrador") ||
    usuario.papeis.includes("coordenador_estagio")
  );
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

  if (!podePreencher(aluno, template)) {
    throw new Error("Documento não disponível para este perfil.");
  }

  if (template.metadados.exigeEstagio && !estagioId) {
    throw new Error("Selecione o estágio para preencher este documento.");
  }

  const estagio = estagioId ? await exigirAcessoEstagio(aluno, estagioId) : null;
  if (
    estagio &&
    (estagioEncerrado(estagio) || (!documentoInicial(templateId) && !estagioLiberado(estagio)))
  ) {
    throw new ErroDeRegra(
      "O estágio aguarda liberação ou está cancelado/excluído.",
      "liberacao_pendente",
    );
  }
  const titular = await usuarioPorId(estagio?.alunoId ?? aluno.id);
  if (!titular) throw new Error("Cadastro do aluno não encontrado.");

  const existente = await documentoDoTemplate(templateId, titular.id, estagioId);

  if (existente) {
    if (existente.situacao === "rascunho" && titular.situacao === "ativo") {
      existente.valores = await valoresDoPreenchimento(
        templateId,
        titular,
        estagioId,
        existente.valores,
        existente.versaoTemplate,
      );
    }
    return existente;
  }

  const versaoVigente = template.versoes.find((versao) => versao.vigente);
  if (!versaoVigente) throw new ErroDeRegra("Template sem versão vigente.", "versao_indisponivel");
  const momento = agora();
  const valoresIniciais = await valoresDoPreenchimento(
    templateId,
    titular,
    estagioId,
    valoresDigitadosPermitidos(templateId, valores, versaoVigente.versao),
    versaoVigente.versao,
  );

  // A duração prevista do Termo antecede o estágio; não depende de horas realizadas.
  if (estagioId && !("cargaHorariaTotal" in valoresIniciais)) {
    const temCargaHoraria = camposDoTemplate(
      templateId,
      descritorDaVersao(templateId, versaoVigente.versao),
    ).some((campo) => campo.id === "cargaHorariaTotal");

    if (temCargaHoraria) {
      valoresIniciais.cargaHorariaTotal =
        templateId === "tpl-termo-compromisso"
          ? (estagio?.cargaHorariaPrevista ?? "")
          : await totalHorasDoEstagio(estagioId);
    }
  }

  const documento: DocumentoPreenchido = {
    id: novoId("doc"),
    templateId,
    alunoId: titular.id,
    estagioId,
    versaoTemplate: versaoVigente?.versao ?? 1,
    valores: valoresIniciais,
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
  versao?: number,
): Promise<Record<string, unknown>> {
  const descriptor = descritorDaVersao(templateId, versao);
  const estagio = estagioId ? await estagioPorId(estagioId) : null;
  if (estagio?.excluidoEm) {
    return {
      nomeCompleto: estagio.nomeAlunoHistorico ?? "",
      aluno: estagio.nomeAlunoHistorico ?? "",
    };
  }
  const dados = aluno.dadosPessoais;
  const [curso, turma, periodo] = dados
    ? await Promise.all([
        cursoPorId(dados.cursoId),
        turmaPorId(dados.turmaId),
        periodoPorId(dados.periodoId),
      ])
    : [null, null, null];
  const endereco = dados?.endereco;
  const enderecoCompleto =
    endereco?.logradouro?.trim() && endereco.numero?.trim()
      ? [endereco.logradouro, endereco.numero, endereco.bairro].filter(Boolean).join(", ")
      : undefined;

  const base: Record<string, unknown> = {
    nomeCompleto: aluno.nome,
    cpf: dados?.cpf,
    rg: dados?.rg,
    dataNascimento: dados?.dataNascimento,
    email: dados?.email ?? aluno.email,
    telefone: dados?.telefone,
    celular: dados?.celular,
    endereco: enderecoCompleto,
    enderecoAluno: enderecoCompleto,
    cepAluno: endereco?.cep,
    bairro: endereco?.bairro,
    cidade: endereco?.cidade,
    cep: endereco?.cep,
    telefoneAluno: dados?.telefone,
    celularAluno: dados?.celular,
    emailAluno: dados?.email ?? aluno.email,
    curso: curso?.nome,
    turma: turma?.nome,
    ano: periodo?.ano,
    anoSemestre: periodo?.rotulo,
    semestre: periodo?.semestre,
    periodo: periodo?.rotulo,
    turmaSemestreAno: [turma?.nome, periodo?.rotulo].filter(Boolean).join(" — "),
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

  const automaticos = Object.fromEntries(
    camposDoTemplate(templateId, descriptor)
      .filter(
        (campo) =>
          campo.origem === "aluno" ||
          campo.origem === "estagio" ||
          (campo.origem === "literal" && campo.somenteLeitura && campo.ajuda),
      )
      .map((campo) => [
        campo.id,
        campo.origem === "literal"
          ? campo.ajuda
          : Object.hasOwn(base, campo.fonte || campo.id)
            ? (base[campo.fonte || campo.id] ?? "")
            : "",
      ]),
  );
  for (const grupo of descriptor?.gruposEndereco ?? []) {
    for (const id of idsDoGrupo(grupo)) delete automaticos[id];
    if (grupo.origemInicial !== "aluno") continue;
    for (const [chave, id] of Object.entries(grupo.campos)) {
      automaticos[id] = endereco?.[chave as keyof typeof endereco] ?? "";
    }
    automaticos[grupo.composto] = estruturaSuficiente(endereco ?? {})
      ? formatarEndereco(endereco!)
      : "";
  }
  return automaticos;
}

/** Valores de origem nunca vêm do cliente; conceitos derivados também são recalculados. */
export async function valoresDoPreenchimento(
  templateId: string,
  aluno: Usuario,
  estagioId: string | undefined,
  valores: Record<string, unknown>,
  versao?: number,
) {
  const descriptor = descritorDaVersao(templateId, versao);
  const automaticos = await valoresAutomaticos(templateId, aluno, estagioId, versao);
  const grupos = descriptor?.gruposEndereco ?? [];
  const enderecos = new Set(grupos.flatMap(idsDoGrupo));
  const protegidos = Object.fromEntries(
    Object.entries(automaticos).filter(([id]) => !enderecos.has(id)),
  );
  const resultado = { ...valores, ...protegidos };
  for (const grupo of grupos) {
    const salvo = idsDoGrupo(grupo).some((id) => Object.hasOwn(valores, id));
    if (!salvo) {
      for (const id of idsDoGrupo(grupo)) resultado[id] = automaticos[id] ?? "";
    }
    const endereco = enderecoDoGrupo(grupo, resultado);
    if (estruturaSuficiente(endereco)) resultado[grupo.composto] = formatarEndereco(endereco);
  }
  if (templateId === "tpl-ficha-frequencia") {
    const notas = camposDoTemplate(templateId, descriptor)
      .filter((campo) => /^criterio_\d+$/.test(campo.id))
      .map((campo) => resultado[campo.id])
      .filter(
        (nota): nota is number =>
          typeof nota === "number" && Number.isFinite(nota) && nota >= 0 && nota <= 10,
      );
    resultado.conceitoGlobal = notas.length ? conceitoGlobalDasNotas(notas) : "";
  }
  return resultado;
}

export async function salvarRascunho(
  documentoId: string,
  valores: Record<string, unknown>,
): Promise<DocumentoPreenchido> {
  const documento = await documentoPorId(documentoId);

  if (!documento) throw new Error("Documento não encontrado.");

  if ((await templatePorId(documento.templateId))?.situacao !== "ativo")
    throw new ErroDeRegra("Template inativo: apenas consulta.", "template_inativo");
  if (documento.situacao !== "rascunho") {
    throw new Error("Somente rascunhos podem ser editados.");
  }
  const estagio = documento.estagioId ? await estagioPorId(documento.estagioId) : null;
  if (
    estagio &&
    (estagioEncerrado(estagio) ||
      (!documentoInicial(documento.templateId) && !estagioLiberado(estagio)))
  ) {
    throw new ErroDeRegra(
      "O estágio aguarda liberação ou está cancelado/excluído.",
      "liberacao_pendente",
    );
  }
  if (estagio && documentoInicial(documento.templateId) && !correcaoInicialPermitida(estagio)) {
    throw new ErroDeRegra(
      "Os documentos iniciais só podem ser corrigidos após indeferimento.",
      "dados_iniciais_bloqueados",
    );
  }

  const aluno = await usuarioPorId(documento.alunoId);
  if (!aluno) throw new Error("Cadastro do aluno não encontrado.");
  if (aluno.situacao !== "ativo")
    throw new Error("Documento de cadastro inativo: apenas consulta.");
  documento.valores = await valoresDoPreenchimento(
    documento.templateId,
    aluno,
    documento.estagioId,
    {
      ...documento.valores,
      ...valoresDigitadosPermitidos(documento.templateId, valores, documento.versaoTemplate),
    },
    documento.versaoTemplate,
  );
  documento.atualizadoEm = agora();

  return documento;
}

export async function submeter(documentoId: string): Promise<DocumentoPreenchido> {
  const documento = await documentoPorId(documentoId);

  if (!documento) throw new Error("Documento não encontrado.");

  const template = await templatePorId(documento.templateId);
  if (!template?.metadados || template.metadados.tipoParecer === "nenhum") {
    throw new Error("Este documento não está sujeito a parecer.");
  }
  const problemas = validarValores(
    documento.templateId,
    documento.valores,
    documento.versaoTemplate,
  );

  if (problemas.length > 0) {
    throw new Error(problemas[0].mensagem);
  }

  const alvo: SituacaoDocumento = "submetido";

  if (!transicaoDocumentoPermitida(documento.situacao, alvo)) {
    throw new Error(`Não é possível enviar um documento em "${documento.situacao}".`);
  }

  documento.situacao = alvo;
  documento.correcaoAberta = false;
  documento.atualizadoEm = agora();
  const tipoParecer = template.metadados.tipoParecer;
  for (const responsavel of obterEstado().usuarios.filter(
    (usuario) => usuario.situacao === "ativo",
  )) {
    if (
      (tipoParecer === "coordenador_curso" &&
        responsavel.papeis.includes("coordenador_curso") &&
        responsavel.cursoId === cursoDoDocumento(documento)) ||
      (tipoParecer === "comissao_estagio" &&
        responsavel.papeis.includes("coordenador_estagio") &&
        responsavel.membroComissaoEstagio)
    ) {
      notificar(
        responsavel.id,
        "Documento aguardando parecer",
        `Documento ${template.nome} submetido para análise.`,
        "parecer",
      );
    }
  }
  if (tipoParecer === "externo") {
    const aluno = await usuarioPorId(documento.alunoId);
    if (aluno) {
      const { enviarParaAssinaturas } = await import("./fluxo-estagio");
      await enviarParaAssinaturas(documento.id, aluno);
    }
  }

  return documento;
}

/** Curso do aluno dono do documento. */
export function cursoDoDocumento(documento: DocumentoPreenchido): string | undefined {
  const aluno = obterEstado().usuarios.find((usuario) => usuario.id === documento.alunoId);

  return aluno?.dadosPessoais?.cursoId ?? aluno?.cursoId;
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
  const administrador = autor.papeis.includes("administrador") && autor.situacao === "ativo";
  const podeVerFila =
    autor.situacao === "ativo" &&
    (administrador ||
      (fila === "coordenador_curso" &&
        autor.papeis.includes("coordenador_curso") &&
        Boolean(autor.cursoId)) ||
      (fila === "comissao_estagio" &&
        autor.papeis.includes("coordenador_estagio") &&
        autor.membroComissaoEstagio));
  if (!podeVerFila || fila === "externo" || fila === "nenhum") return paginar([], consulta);
  const emAnalise = obterEstado()
    .documentos.filter(
      (documento) => documento.situacao === "em_analise" || documento.situacao === "submetido",
    )
    .filter(
      (documento) =>
        !documento.estagioId ||
        !obterEstado().estagios.find(
          (estagio) => estagio.id === documento.estagioId && estagioEncerrado(estagio),
        ),
    )
    .filter((documento) => !consulta.estagioId || documento.estagioId === consulta.estagioId);

  const naFila: DocumentoPreenchido[] = [];

  for (const documento of emAnalise) {
    const template = await templatePorId(documento.templateId);

    if (template?.metadados?.tipoParecer !== fila) continue;
    if (
      !administrador &&
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

  const fila = (await templatePorId(documento.templateId))?.metadados?.tipoParecer;
  const estagio = documento.estagioId ? await estagioPorId(documento.estagioId) : null;
  if (estagio && estagioEncerrado(estagio))
    throw new ErroDeRegra("Estágio cancelado ou excluído.", "estagio_encerrado");
  const autorizado =
    autor.situacao === "ativo" &&
    (autor.papeis.includes("administrador") ||
      (fila === "coordenador_curso" &&
        autor.papeis.includes("coordenador_curso") &&
        Boolean(autor.cursoId) &&
        cursoDoDocumento(documento) === autor.cursoId) ||
      (fila === "comissao_estagio" &&
        autor.papeis.includes("coordenador_estagio") &&
        autor.membroComissaoEstagio));
  if (
    !autorizado ||
    !fila ||
    !["aprovado", "indeferido"].includes(decisao) ||
    fila === "externo" ||
    fila === "nenhum"
  ) {
    throw new Error("Parecer não disponível para este usuário ou decisão inválida.");
  }

  if (documento.situacao === "submetido") await iniciarAnalise(documento.id);
  if (!transicaoDocumentoPermitida(documento.situacao, decisao)) {
    throw new Error(`Não é possível emitir parecer a partir de "${documento.situacao}".`);
  }

  documento.situacao = decisao;
  documento.atualizadoEm = agora();
  for (const campo of camposDoTemplate(documento.templateId, descritorDoDocumento(documento))) {
    const fonte = fonteParecer(documento.templateId, campo);
    if (fonte === "data") documento.valores[campo.id] = agora().slice(0, 10);
    if (fonte === "consideracoes") documento.valores[campo.id] = consideracoes ?? "";
    if (fonte === "decisao")
      documento.valores[campo.id] =
        campo.tipo === "checkbox"
          ? decisao === "aprovado"
          : campo.opcoes?.some((opcao) => opcao.valor === "sim")
            ? decisao === "aprovado"
              ? "sim"
              : "nao"
            : decisao;
  }

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

  if (
    consideracoes?.trim() &&
    autor.papeis.some((papel) => papel === "coordenador_curso" || papel === "coordenador_estagio")
  ) {
    const { acrescentarObservacao } = await import("./observacoes");
    await acrescentarObservacao(documento.id, consideracoes, autor);
  }
  if (
    documento.templateId === "tpl-formulario-liberacao" &&
    decisao === "aprovado" &&
    estagio?.encaminhadoEm
  ) {
    const { enviarDocumentacaoInicial } = await import("./fluxo-estagio");
    await enviarDocumentacaoInicial(estagio.id, autor);
  }

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
  return descritorDaVersao(documento.templateId, documento.versaoTemplate);
}

export function valoresDigitadosPermitidos(
  templateId: string,
  valores: Record<string, unknown>,
  versao?: number,
) {
  const reservados = new Set(
    camposDoTemplate(templateId, descritorDaVersao(templateId, versao))
      .filter((campo) => fonteParecer(templateId, campo) || classificacaoDoCampo(campo) !== "campo")
      .map((campo) => campo.id),
  );
  return Object.fromEntries(Object.entries(valores).filter(([id]) => !reservados.has(id)));
}

/** Atualizações de perfil não refazem parecer nem conferência. Endereços corrigidos no documento são preservados. */
export async function sincronizarDadosDoPerfil(anterior: Usuario, atual: Usuario) {
  for (const documento of obterEstado().documentos.filter(
    (doc) => doc.alunoId === atual.id && doc.situacao !== "inativo",
  )) {
    const estagio = documento.estagioId ? await estagioPorId(documento.estagioId) : null;
    if (estagio && estagioEncerrado(estagio)) continue;
    const descriptor = descritorDoDocumento(documento);
    const antes = await valoresAutomaticos(
      documento.templateId,
      anterior,
      documento.estagioId,
      documento.versaoTemplate,
    );
    const depois = await valoresAutomaticos(
      documento.templateId,
      atual,
      documento.estagioId,
      documento.versaoTemplate,
    );
    const grupos = descriptor?.gruposEndereco ?? [];
    const idsEndereco = new Set(grupos.flatMap(idsDoGrupo));
    for (const campo of camposDoTemplate(documento.templateId, descriptor)) {
      if (campo.origem === "aluno" && !idsEndereco.has(campo.id))
        documento.valores[campo.id] = depois[campo.id] ?? "";
    }
    for (const grupo of grupos.filter((grupo) => grupo.origemInicial === "aluno")) {
      const ids = idsDoGrupo(grupo);
      if (
        ids.every(
          (id) => documento.valores[id] === undefined || documento.valores[id] === antes[id],
        )
      ) {
        for (const id of ids) documento.valores[id] = depois[id] ?? "";
      }
    }
    const dados = atual.dadosPessoais;
    for (const [id, valor] of Object.entries({
      telefoneAluno: dados?.telefone,
      celularAluno: dados?.celular,
      emailAluno: dados?.email,
    })) {
      if (camposDoTemplate(documento.templateId, descriptor).some((campo) => campo.id === id))
        documento.valores[id] = valor ?? "";
    }
    documento.atualizadoEm = agora();
  }
}
