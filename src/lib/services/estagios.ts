import { esquemaEstagio } from "@/lib/domain/schemas";
import { lancamentosEfetivos } from "@/lib/domain/horas";
import { cursoDoUsuario } from "@/lib/domain/usuario";
import {
  DOCUMENTOS_INICIAIS,
  documentoInicial,
  estagioEncerrado,
  estagioLiberado,
} from "@/lib/domain/fluxo-estagio";
import { camposDoTemplate } from "@/lib/templates/descriptors";
import { idsDoGrupo } from "@/lib/templates/grupos-endereco";
import { ZodError } from "zod";
import { descritorDaVersao } from "./templates";
import type {
  Convenio,
  Estagio,
  LancamentoHoras,
  Pagina,
  Papel,
  Pessoa,
  SolicitacaoExclusaoEstagio,
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
  cargaHorariaPrevista?: number;
  valoresDocumentos?: Record<string, Record<string, unknown>>;
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

export function podeConsultarEstagio(usuario: Usuario, estagio: Estagio): boolean {
  if (usuario.situacao !== "ativo") return false;
  if (usuario.papeis.includes("administrador") || usuario.papeis.includes("coordenador_estagio")) {
    return (
      usuario.campus ===
      obterEstado().usuarios.find((aluno) => aluno.id === estagio.alunoId)?.campus
    );
  }
  if (usuario.papeis.includes("coordenador_curso") && usuario.cursoId) {
    const aluno = obterEstado().usuarios.find((registro) => registro.id === estagio.alunoId);
    const cursoId = estagio.excluidoEm ? estagio.cursoIdHistorico : aluno && cursoDoUsuario(aluno);
    if (cursoId === usuario.cursoId) return true;
  }
  return usuario.papeis.includes("aluno") && estagio.alunoId === usuario.id;
}

export async function exigirAcessoEstagio(usuario: Usuario, estagioId: string): Promise<Estagio> {
  const estagio = await estagioPorId(estagioId);
  if (!estagio || !podeConsultarEstagio(usuario, estagio)) {
    throw new ErroDeRegra("Estágio não disponível para este usuário.", "acesso_negado");
  }
  return estagio;
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
  return lancamentosEfetivos(lancamentosDoEstagio(estagioId)).reduce(
    (total, lancamento) => total + lancamento.horas,
    0,
  );
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
  if (aluno.situacao !== "ativo" || !aluno.papeis.includes("aluno")) {
    throw new ErroDeRegra("Apenas alunos cadastram estágios.", "papel_invalido");
  }
  if (dados.situacao !== undefined && dados.situacao !== "em_preparacao") {
    throw new ErroDeRegra(
      "A situação inicial não pode ser escolhida pelo aluno.",
      "situacao_nao_permitida",
    );
  }
  if (dados.documentosSelecionados?.some((id) => !documentoInicial(id))) {
    throw new ErroDeRegra(
      "Os demais documentos dependem da liberação do estágio.",
      "liberacao_pendente",
    );
  }
  const parsed = esquemaEstagio().parse({ ...dados, situacao: "em_preparacao" });

  const convenio = await convenioPorId(parsed.convenioId);

  if (!convenio) throw new ErroDeRegra("Convênio não encontrado.", "convenio_inexistente");
  if (convenio.situacao !== "ativo")
    throw new ErroDeRegra("Selecione um convênio ativo.", "convenio_inativo");

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

  if (!orientador || orientador.papel !== "orientador" || orientador.situacao !== "ativo") {
    throw new ErroDeRegra("Orientador não cadastrado.", "orientador_invalido");
  }

  const conflito = (await estagiosDoAluno(aluno.id)).find(
    (estagio) =>
      !estagioEncerrado(estagio) &&
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
    documentosSelecionados: [...DOCUMENTOS_INICIAIS],
    cargaHorariaPrevista: dados.cargaHorariaPrevista,
    nomeAlunoHistorico: aluno.nome,
    cursoIdHistorico: cursoDoUsuario(aluno),
    criadoEm: agora(),
  };

  obterEstado().estagios.push(estagio);
  try {
    const { prepararDocumentosIniciais } = await import("./fluxo-estagio");
    const documentos = await prepararDocumentosIniciais(estagio.id, aluno, dados.valoresDocumentos);
    const { validarValores } = await import("./documentos");
    const problemas = documentos.flatMap((doc) =>
      validarValores(doc.templateId, doc.valores, doc.versaoTemplate).map((problema) => ({
        code: "custom" as const,
        path: ["valoresDocumentos", doc.templateId, problema.campo],
        message: `${obterEstado().templates.find((template) => template.id === doc.templateId)?.nome}: ${problema.mensagem}`,
      })),
    );
    if (problemas.length) throw new ZodError(problemas);
  } catch (erro) {
    obterEstado().estagios = obterEstado().estagios.filter(
      (registro) => registro.id !== estagio.id,
    );
    obterEstado().documentos = obterEstado().documentos.filter(
      (doc) => doc.estagioId !== estagio.id,
    );
    throw erro;
  }

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

  if (!estagioLiberado(estagio) || estagio.situacao !== "em_andamento") {
    throw new ErroDeRegra("A seleção exige estágio liberado e em andamento.", "estagio_concluido");
  }

  estagio.documentosSelecionados = [
    ...new Set([...DOCUMENTOS_INICIAIS, ...documentosValidos(templateIds, "aluno")]),
  ];

  return estagio;
}

export async function removerDocumentoEstagio(
  estagioId: string,
  templateId: string,
): Promise<Estagio> {
  const estagio = await estagioPorId(estagioId);

  if (!estagio) throw new ErroDeRegra("Estágio não encontrado.", "estagio_inexistente");

  if (documentoInicial(templateId))
    throw new ErroDeRegra("Os documentos iniciais são obrigatórios.", "documento_obrigatorio");
  if (!estagioLiberado(estagio) || estagio.situacao !== "em_andamento") {
    throw new ErroDeRegra(
      "Estágio concluído não permite alteração de documentos.",
      "estagio_concluido",
    );
  }

  estagio.documentosSelecionados = estagio.documentosSelecionados.filter((id) => id !== templateId);

  const documento = obterEstado().documentos.find(
    (d) => d.estagioId === estagioId && d.templateId === templateId && d.situacao !== "inativo",
  );

  if (documento) {
    documento.situacao = "inativo";
    documento.inativadoEm = agora();
    documento.atualizadoEm = agora();
  }

  return estagio;
}

export async function concluirEstagio(estagioId: string, editorId?: string): Promise<Estagio> {
  const estagio = await estagioPorId(estagioId);

  if (!estagio) throw new ErroDeRegra("Estágio não encontrado.", "estagio_inexistente");
  exigirCoordenacao(estagio, editorId);
  if (!estagioLiberado(estagio) || estagio.situacao !== "em_andamento")
    throw new ErroDeRegra("O estágio precisa estar liberado e em andamento.", "liberacao_pendente");
  esquemaEstagio().parse({ ...estagio, situacao: "concluido" });

  estagio.situacao = "concluido";
  estagio.editadoPorId = editorId;
  estagio.editadoEm = agora();

  return estagio;
}

/** Reabre o estágio para correção; o histórico de lançamentos é preservado. */
export async function reabrirEstagio(estagioId: string, editorId?: string): Promise<Estagio> {
  const estagio = await estagioPorId(estagioId);

  if (!estagio) throw new ErroDeRegra("Estágio não encontrado.", "estagio_inexistente");

  exigirCoordenacao(estagio, editorId);
  if (!estagioLiberado(estagio) || estagio.situacao !== "concluido")
    throw new ErroDeRegra("A reabertura exige estágio liberado e concluído.", "liberacao_pendente");
  estagio.situacao = "em_andamento";
  estagio.editadoPorId = editorId;
  estagio.editadoEm = agora();

  return estagio;
}

export async function editarEstagio(
  estagioId: string,
  dados: Partial<NovoEstagio>,
  editorId?: string,
): Promise<Estagio> {
  const estagio = await estagioPorId(estagioId);

  if (!estagio) throw new ErroDeRegra("Estágio não encontrado.", "estagio_inexistente");
  const editor = obterEstado().usuarios.find((usuario) => usuario.id === editorId);
  if (!editor || !podeConsultarEstagio(editor, estagio) || estagioEncerrado(estagio))
    throw new ErroDeRegra("Edição não disponível.", "acesso_negado");
  if (dados.situacao !== undefined && dados.situacao !== estagio.situacao) {
    throw new ErroDeRegra(
      "Use a ação da coordenação para alterar a situação.",
      "situacao_nao_permitida",
    );
  }
  if (editor.id === estagio.alunoId && !correcaoInicialPermitida(estagio)) {
    throw new ErroDeRegra(
      "Os dados iniciais só podem ser corrigidos após indeferimento.",
      "dados_iniciais_bloqueados",
    );
  }
  const validado = esquemaEstagio().parse({ ...estagio, ...dados });
  const convenio = await convenioPorId(validado.convenioId);
  if (
    !convenio ||
    (validado.convenioId !== estagio.convenioId &&
      (convenio.situacao !== "ativo" || classificacaoConvenio(convenio) !== "ativo"))
  ) {
    throw new ErroDeRegra("Selecione um convênio ativo.", "convenio_invalido");
  }
  const [supervisor, orientador] = await Promise.all([
    pessoaPorId(validado.supervisorId),
    pessoaPorId(validado.orientadorId),
  ]);
  if (
    !supervisor ||
    supervisor.papel !== "supervisor" ||
    (supervisor.id !== estagio.supervisorId && supervisor.situacao !== "ativo") ||
    !orientador ||
    orientador.papel !== "orientador" ||
    (orientador.id !== estagio.orientadorId && orientador.situacao !== "ativo")
  ) {
    throw new ErroDeRegra("Selecione supervisor e orientador cadastrados.", "pessoa_invalida");
  }
  if (
    (await estagiosDoAluno(estagio.alunoId)).some(
      (outro) =>
        outro.id !== estagio.id &&
        !estagioEncerrado(outro) &&
        sobrepoe(validado.dataInicio, validado.dataFim, outro.dataInicio, outro.dataFim),
    )
  ) {
    throw new ErroDeRegra(
      "O período conflita com um estágio já cadastrado.",
      "periodo_conflictante",
    );
  }
  if (
    lancamentosDoEstagio(estagio.id).some(
      (lancamento) => lancamento.data < validado.dataInicio || lancamento.data > validado.dataFim,
    )
  ) {
    throw new ErroDeRegra(
      "O período deve incluir os lançamentos já registrados.",
      "periodo_com_lancamentos",
    );
  }
  Object.assign(estagio, validado);
  if (dados.cargaHorariaPrevista !== undefined)
    estagio.cargaHorariaPrevista = dados.cargaHorariaPrevista;
  const { valoresDigitadosPermitidos, valoresDoPreenchimento } = await import("./documentos");
  const titular = obterEstado().usuarios.find((usuario) => usuario.id === estagio.alunoId)!;
  for (const documento of obterEstado().documentos.filter(
    (doc) =>
      doc.estagioId === estagioId && documentoInicial(doc.templateId) && doc.situacao !== "inativo",
  )) {
    if (editor.id === estagio.alunoId && documento.situacao === "indeferido") {
      documento.situacao = "rascunho";
      documento.correcaoAberta = true;
    }
    documento.valores = await valoresDoPreenchimento(
      documento.templateId,
      titular,
      estagioId,
      {
        ...documento.valores,
        ...valoresDigitadosPermitidos(
          documento.templateId,
          dados.valoresDocumentos?.[documento.templateId] ?? {},
          documento.versaoTemplate,
        ),
      },
      documento.versaoTemplate,
    );
    if (
      documento.templateId === "tpl-termo-compromisso" &&
      dados.cargaHorariaPrevista !== undefined
    )
      documento.valores.cargaHorariaTotal = dados.cargaHorariaPrevista;
    documento.atualizadoEm = agora();
  }

  estagio.editadoPorId = editorId;
  estagio.editadoEm = agora();

  return estagio;
}

function exigirCoordenacao(estagio: Estagio, editorId?: string) {
  const editor = obterEstado().usuarios.find((usuario) => usuario.id === editorId);
  if (
    !editor ||
    !editor.papeis.some(
      (papel) => papel === "coordenador_curso" || papel === "coordenador_estagio",
    ) ||
    !podeConsultarEstagio(editor, estagio)
  ) {
    throw new ErroDeRegra("A alteração da situação cabe à coordenação.", "acesso_negado");
  }
}

export function correcaoInicialPermitida(estagio: Estagio): boolean {
  if (estagio.situacao !== "em_preparacao" || estagioEncerrado(estagio)) return false;
  return obterEstado().documentos.some(
    (doc) =>
      doc.estagioId === estagio.id &&
      doc.templateId === DOCUMENTOS_INICIAIS[0] &&
      (doc.situacao === "indeferido" ||
        (doc.situacao === "rascunho" && doc.correcaoAberta === true)),
  );
}

export async function excluirEstagio(estagioId: string, aluno: Usuario) {
  const estagio = await exigirAcessoEstagio(aluno, estagioId);
  if (aluno.id !== estagio.alunoId)
    throw new ErroDeRegra("A exclusão cabe ao aluno titular.", "acesso_negado");
  if (estagio.excluidoEm) return estagio;
  estagio.nomeAlunoHistorico = aluno.nome;
  estagio.cursoIdHistorico = cursoDoUsuario(aluno);
  estagio.excluidoEm = agora();
  for (const documento of obterEstado().documentos.filter((doc) => doc.estagioId === estagioId)) {
    const valores = { ...documento.valores };
    const descriptor = descritorDaVersao(documento.templateId, documento.versaoTemplate);
    for (const campo of camposDoTemplate(documento.templateId, descriptor)) {
      if (
        campo.origem === "aluno" &&
        ![
          "nomeCompleto",
          "aluno",
          "curso",
          "turma",
          "periodo",
          "ano",
          "semestre",
          "anoSemestre",
          "turmaSemestreAno",
          "campus",
        ].includes(campo.fonte || campo.id)
      )
        delete valores[campo.id];
    }
    for (const id of [
      "cpf",
      "rg",
      "dataNascimento",
      "matricula",
      "enderecoAluno",
      "cepAluno",
      "telefoneAluno",
      "celularAluno",
      "emailAluno",
    ])
      delete valores[id];
    for (const grupo of descriptor?.gruposEndereco ?? []) {
      if (grupo.origemInicial === "aluno") for (const id of idsDoGrupo(grupo)) delete valores[id];
    }
    documento.valores = valores;
    documento.situacao = "inativo";
    documento.inativadoEm = estagio.excluidoEm;
    documento.atualizadoEm = estagio.excluidoEm;
  }
  const idsDocumentos = new Set(
    obterEstado()
      .documentos.filter((doc) => doc.estagioId === estagioId)
      .map((doc) => doc.id),
  );
  for (const envio of obterEstado().envios) {
    if (
      idsDocumentos.has(envio.documentoId) &&
      (envio.destinatarioPapel === "aluno" || envio.destinatarioEmail === aluno.email)
    )
      envio.destinatarioEmail = "";
  }
  return estagio;
}

export async function cancelarSolicitacao(estagioId: string, aluno: Usuario) {
  const estagio = await exigirAcessoEstagio(aluno, estagioId);
  if (estagio.situacao !== "em_preparacao" || estagioLiberado(estagio))
    throw new ErroDeRegra(
      "Somente solicitações aguardando liberação podem ser canceladas.",
      "cancelamento_indisponivel",
    );
  await excluirEstagio(estagioId, aluno);
  estagio.canceladoEm = estagio.excluidoEm;
  return estagio;
}

export async function solicitarExclusaoEstagio(
  estagioId: string,
  solicitanteId: string,
  motivo?: string,
): Promise<SolicitacaoExclusaoEstagio> {
  const estagio = await estagioPorId(estagioId);

  if (!estagio) throw new ErroDeRegra("Estágio não encontrado.", "estagio_inexistente");
  const pendente = obterEstado().exclusoes.find(
    (solicitacao) => solicitacao.estagioId === estagioId && solicitacao.situacao === "pendente",
  );
  if (pendente) return pendente;

  const solicitacao: SolicitacaoExclusaoEstagio = {
    id: novoId("exc"),
    estagioId,
    solicitanteId,
    situacao: "pendente",
    motivo,
    criadoEm: agora(),
  };

  obterEstado().exclusoes.push(solicitacao);

  return solicitacao;
}

export async function exclusaoPendenteDoEstagio(estagioId: string): Promise<boolean> {
  return obterEstado().exclusoes.some(
    (solicitacao) => solicitacao.estagioId === estagioId && solicitacao.situacao === "pendente",
  );
}

export async function estagiosDoCurso(cursoId: string): Promise<Estagio[]> {
  const estado = obterEstado();
  const alunosDoCurso = new Set(
    estado.usuarios.filter((u) => cursoDoUsuario(u) === cursoId).map((u) => u.id),
  );

  return estado.estagios.filter((e) => alunosDoCurso.has(e.alunoId));
}
