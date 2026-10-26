import { beforeEach, describe, expect, it } from "vitest";
import { DOCUMENTOS_INICIAIS } from "@/lib/domain/fluxo-estagio";
import {
  criarEstagio,
  editarEstagio,
  concluirEstagio,
  cancelarSolicitacao,
  excluirEstagio,
  selecionarDocumentos,
  removerDocumentoEstagio,
  reabrirEstagio,
} from "./estagios";
import {
  criarRascunho,
  documentosDoEstagio,
  registrarParecer,
  salvarRascunho,
  sincronizarDadosDoPerfil,
  valoresAutomaticos,
} from "./documentos";
import {
  confirmarAssinaturas,
  enviarParaAssinaturas,
  prepararDocumentosIniciais,
  reabrirParaCorrecao,
  solicitarEncaminhamento,
} from "./fluxo-estagio";
import { acrescentarObservacao, observacoesDoDocumento } from "./observacoes";
import { lancarHoras } from "./lancamentos";
import { obterEstado, reiniciarEstado } from "./store";
import { atualizarDadosPessoais } from "./aluno";

const usuario = (id: string) => obterEstado().usuarios.find((registro) => registro.id === id)!;

function dadosSolicitacao() {
  return {
    convenioId: "conv-ti-pinheiral",
    supervisorId: "sup-ricardo",
    orientadorId: "ori-carla",
    dataInicio: "2027-01-04",
    dataFim: "2027-01-29",
    cargaHorariaPrevista: 120,
    valoresDocumentos: {
      "tpl-formulario-liberacao": {
        telefoneAluno: "2133337788",
        celularAluno: "21998761234",
        emailAluno: "maria.souza@aluno.ifrj.edu.br",
        enderecoLocal: "Rua da Empresa, 10",
        telefoneSupervisor: "2133331000",
      },
      "tpl-termo-compromisso": {
        cnpj: "11222333000181",
        responsavel: "Marina Duarte",
        nomeDiretor: "Heider Alves Franco",
        logradouro: "Rua da Empresa",
        numero: "10",
        bairro: "Centro",
        cidade: "Pinheiral",
        estado: "RJ",
        cep: "23940000",
        seguradora: "Seguradora",
        numeroApolice: "AP-120",
        cargaHorariaSemanal: 30,
        horario: "09:00 às 15:00",
      },
      "tpl-plano-atividades": {
        tipoAtividade: "estagio",
        dataInicioPrevista: "04/01/2027",
        dataFimPrevista: "29/01/2027",
        atividades: "Apoio às atividades de ensino e desenvolvimento de sistemas.",
      },
    },
  };
}

async function solicitar() {
  const aluno = usuario("usr-maria");
  const estagio = await criarEstagio(aluno, dadosSolicitacao());
  const documentos = await documentosDoEstagio(estagio.id);
  return {
    aluno,
    estagio,
    documentos,
    formulario: documentos.find((doc) => doc.templateId === DOCUMENTOS_INICIAIS[0])!,
  };
}

beforeEach(() => reiniciarEstado());

describe("solicitação e liberação de estágio", () => {
  it("prepara os três documentos sem duplicar e declara horas antes do início", async () => {
    const { aluno, estagio, documentos } = await solicitar();
    expect(estagio.situacao).toBe("em_preparacao");
    expect(documentos.map((doc) => doc.templateId).sort()).toEqual([...DOCUMENTOS_INICIAIS].sort());
    expect(
      documentos.every((doc) => doc.alunoId === aluno.id && doc.estagioId === estagio.id),
    ).toBe(true);
    expect(
      documentos.find((doc) => doc.templateId === "tpl-termo-compromisso")?.valores
        .cargaHorariaTotal,
    ).toBe(120);
    await prepararDocumentosIniciais(estagio.id, aluno);
    expect(await documentosDoEstagio(estagio.id)).toHaveLength(3);
  });

  it("aprovação envia, mas apenas conferência completa libera e notifica", async () => {
    const { aluno, estagio, documentos, formulario } = await solicitar();
    await expect(enviarParaAssinaturas(formulario.id, aluno)).rejects.toThrow(/parecer favorável/);
    await solicitarEncaminhamento(estagio.id, aluno);
    expect(obterEstado().envios).toHaveLength(0);
    await registrarParecer(
      formulario.id,
      "aprovado",
      usuario("usr-carla"),
      "Atividades compatíveis.",
    );
    expect(obterEstado().envios.some((envio) => envio.documentoId === formulario.id)).toBe(true);
    expect(estagio.situacao).toBe("em_preparacao");
    const confirmacoes = documentos.map((doc) => ({
      documentoId: doc.id,
      confirmado: true,
      observacao: "Assinaturas conferidas.",
    }));
    await expect(
      confirmarAssinaturas(estagio.id, usuario("usr-ana"), confirmacoes.slice(1)),
    ).rejects.toThrow(/três documentos/);
    await confirmarAssinaturas(estagio.id, usuario("usr-ana"), confirmacoes);
    expect(estagio.situacao).toBe("em_andamento");
    expect(estagio.liberadoPorId).toBe("usr-ana");
    expect(documentos.every((doc) => doc.assinaturasConfirmadasPorId === "usr-ana")).toBe(true);
    expect(
      obterEstado().notificacoes.some(
        (ntf) => ntf.destinatarioId === aluno.id && ntf.titulo === "Estágio liberado",
      ),
    ).toBe(true);
  });

  it("bloqueia edição enquanto aguarda e permite corrigir somente o indeferimento", async () => {
    const { aluno, estagio, formulario } = await solicitar();
    await expect(editarEstagio(estagio.id, { dataFim: "2027-01-28" }, aluno.id)).rejects.toThrow(
      /indeferimento/,
    );
    await expect(salvarRascunho(formulario.id, { enderecoLocal: "Alteração" })).rejects.toThrow(
      /indeferimento/,
    );
    await solicitarEncaminhamento(estagio.id, aluno);
    await registrarParecer(formulario.id, "indeferido", usuario("usr-carla"), "Corrija o local.");
    await reabrirParaCorrecao(estagio.id, aluno);
    await salvarRascunho(formulario.id, { enderecoLocal: "Local corrigido" });
    await editarEstagio(estagio.id, { dataFim: "2027-01-28" }, aluno.id);
    await solicitarEncaminhamento(estagio.id, aluno);
    expect(formulario.valores.enderecoLocal).toBe("Local corrigido");
    expect(
      obterEstado().pareceres.filter((parecer) => parecer.documentoId === formulario.id),
    ).toHaveLength(1);
    expect(obterEstado().envios).toHaveLength(0);
    await expect(editarEstagio(estagio.id, { dataFim: "2027-01-27" }, aluno.id)).rejects.toThrow(
      /indeferimento/,
    );
  });

  it("recusa liberação por aluno, outro curso ou administrador sem papel de coordenação", async () => {
    const { aluno, estagio, documentos } = await solicitar();
    const confirmacoes = documentos.map((doc) => ({ documentoId: doc.id, confirmado: true }));
    for (const autor of [aluno, usuario("usr-carla"), usuario("usr-admin"), usuario("usr-bruno")]) {
      await expect(confirmarAssinaturas(estagio.id, autor, confirmacoes)).rejects.toThrow();
    }
    await expect(
      confirmarAssinaturas(estagio.id, usuario("usr-ana"), confirmacoes),
    ).rejects.toThrow(/parecer favorável/);
    expect(estagio.situacao).toBe("em_preparacao");
  });

  it("não herda liberação de outro estágio do mesmo aluno", async () => {
    const { aluno, estagio } = await solicitar();
    await expect(criarRascunho(aluno, "tpl-relatorio-semestral", estagio.id)).rejects.toThrow(
      /liberação/,
    );
    await expect(
      lancarHoras({
        estagioId: estagio.id,
        data: "2027-01-05",
        entrada: "09:00",
        saida: "15:00",
        almocoDesligado: false,
      }),
    ).rejects.toThrow(/liberado/);
    expect(
      await criarRascunho(aluno, "tpl-relatorio-semestral", "est-maria-tecnoweb"),
    ).toBeDefined();
    await expect(concluirEstagio(estagio.id, "usr-ana")).rejects.toThrow(/liberado/);
    await expect(concluirEstagio("est-maria-tecnoweb", aluno.id)).rejects.toThrow(/coordenação/);
  });

  it("recusa situação inicial escolhida pelo aluno", async () => {
    await expect(
      criarEstagio(usuario("usr-maria"), { ...dadosSolicitacao(), situacao: "em_andamento" }),
    ).rejects.toThrow(/situação inicial/);
  });

  it("recusa documentos incompletos sem deixar solicitação parcial", async () => {
    const dados = dadosSolicitacao();
    dados.valoresDocumentos["tpl-plano-atividades"].atividades = "";
    const quantidade = obterEstado().estagios.length;
    const quantidadeDocumentos = obterEstado().documentos.length;
    await expect(criarEstagio(usuario("usr-maria"), dados)).rejects.toThrow(/Atividades/);
    expect(obterEstado().estagios).toHaveLength(quantidade);
    expect(obterEstado().documentos).toHaveLength(quantidadeDocumentos);
    const { aluno, estagio, formulario } = await solicitar();
    formulario.valores.emailAluno = "";
    await expect(solicitarEncaminhamento(estagio.id, aluno)).rejects.toThrow(/obrigatório/);
    expect(estagio.encaminhadoEm).toBeUndefined();
    expect(obterEstado().envios).toHaveLength(0);
  });

  it("seleção preserva iniciais e não contorna a liberação", async () => {
    const { aluno, estagio } = await solicitar();
    await expect(selecionarDocumentos(estagio.id, ["tpl-ficha-acompanhamento"])).rejects.toThrow(
      /liberado/,
    );
    await expect(removerDocumentoEstagio(estagio.id, DOCUMENTOS_INICIAIS[0])).rejects.toThrow(
      /obrigatórios/,
    );
    await expect(editarEstagio(estagio.id, { situacao: "em_andamento" }, aluno.id)).rejects.toThrow(
      /situação/,
    );
    const liberado = await selecionarDocumentos("est-maria-tecnoweb", ["tpl-ficha-acompanhamento"]);
    for (const id of DOCUMENTOS_INICIAIS) expect(liberado.documentosSelecionados).toContain(id);
  });

  it("histórico de envio conserva falha e reenvio após recuperar o e-mail", async () => {
    const { aluno, estagio, documentos, formulario } = await solicitar();
    const supervisor = obterEstado().pessoas.find((pessoa) => pessoa.id === estagio.supervisorId)!;
    supervisor.email = "";
    await solicitarEncaminhamento(estagio.id, aluno);
    await registrarParecer(formulario.id, "aprovado", usuario("usr-carla"));
    const termo = documentos.find((doc) => doc.templateId === "tpl-termo-compromisso")!;
    const falha = obterEstado().envios.find(
      (envio) => envio.documentoId === termo.id && envio.status === "falha",
    )!;
    expect(falha.erro).toMatch(/E-mail indisponível/);
    expect(
      obterEstado().notificacoes.some(
        (ntf) =>
          ntf.destinatarioId === aluno.id && ntf.titulo === "E-mail do assinante indisponível",
      ),
    ).toBe(true);
    supervisor.email = "supervisor@exemplo.com";
    await enviarParaAssinaturas(termo.id, aluno);
    expect(obterEstado().envios).toContain(falha);
    expect(
      obterEstado().envios.some(
        (envio) =>
          envio.documentoId === termo.id &&
          envio.destinatarioEmail === supervisor.email &&
          envio.tentativa === 2 &&
          envio.status === "enviado",
      ),
    ).toBe(true);
    expect(estagio.situacao).toBe("em_preparacao");
  });

  it("submissão do Relatório Semestral encaminha ao orientador externo", async () => {
    const aluno = usuario("usr-maria");
    const valores = {
      descricaoEmpresa: "Empresa de tecnologia.",
      objetivos: "Aproximar teoria e prática.",
      desenvolvimento: "Apoio ao ensino e desenvolvimento.",
      dificuldades: "Dúvidas resolvidas com orientação.",
      consideracoesFinais: "Experiência formativa.",
      ...Object.fromEntries(
        Array.from({ length: 11 }, (_, indice) => [`autoavaliacao_${indice + 1}`, "bom"]),
      ),
    };
    const documento = await criarRascunho(
      aluno,
      "tpl-relatorio-semestral",
      "est-maria-tecnoweb",
      valores,
    );
    const { submeter } = await import("./documentos");
    await submeter(documento.id);
    const envios = obterEstado().envios.filter((envio) => envio.documentoId === documento.id);
    expect(envios).toHaveLength(1);
    expect(envios[0]).toMatchObject({
      autorId: aluno.id,
      destinatarioEmail: "carla.menezes@ifrj.edu.br",
      status: "enviado",
    });
    expect(documento.situacao).toBe("submetido");
  });

  it("conclusão e reabertura exigem coordenação e liberação inicial", async () => {
    const estagio = obterEstado().estagios.find(
      (registro) => registro.id === "est-maria-tecnoweb",
    )!;
    await expect(concluirEstagio(estagio.id, "usr-maria")).rejects.toThrow(/coordenação/);
    await concluirEstagio(estagio.id, "usr-carla");
    expect(estagio.situacao).toBe("concluido");
    await expect(reabrirEstagio(estagio.id, "usr-admin")).rejects.toThrow(/coordenação/);
    await reabrirEstagio(estagio.id, "usr-ana");
    expect(estagio.situacao).toBe("em_andamento");
    expect(estagio.editadoPorId).toBe("usr-ana");
    estagio.dataFim = "2099-12-31";
    await expect(concluirEstagio(estagio.id, "usr-ana")).rejects.toThrow(/futura/);
  });

  it("perfil atualiza os campos correspondentes sem refazer parecer ou liberação", async () => {
    const { aluno, estagio, formulario } = await solicitar();
    await solicitarEncaminhamento(estagio.id, aluno);
    await registrarParecer(formulario.id, "aprovado", usuario("usr-carla"));
    const anterior = structuredClone(aluno);
    aluno.nome = "Maria de Souza Atualizada";
    aluno.dadosPessoais!.celular = "21999998888";
    await sincronizarDadosDoPerfil(anterior, aluno);
    expect(formulario.valores.nomeCompleto).toBe(aluno.nome);
    expect(formulario.valores.celularAluno).toBe("21999998888");
    expect(formulario.situacao).toBe("aprovado");
    expect(estagio.situacao).toBe("em_preparacao");
    expect(
      obterEstado().pareceres.filter((parecer) => parecer.documentoId === formulario.id),
    ).toHaveLength(1);
  });

  it("salvar o perfil reflete a nova identificação em um estágio já liberado", async () => {
    const aluno = usuario("usr-maria");
    const estagio = obterEstado().estagios.find(
      (registro) => registro.id === "est-maria-tecnoweb",
    )!;
    const formulario = obterEstado().documentos.find((doc) => doc.id === "doc-liberacao-tecnoweb")!;
    const liberadoEm = estagio.liberadoEm;
    const quantidadePareceres = obterEstado().pareceres.length;
    const resultado = await atualizarDadosPessoais(aluno, {
      ...aluno.dadosPessoais!,
      nomeCompleto: "Maria de Souza Atualizada",
      celular: "21999998888",
    });
    expect(resultado.ok).toBe(true);
    expect(formulario.valores.nomeCompleto).toBe("Maria de Souza Atualizada");
    expect(formulario.valores.celularAluno).toBe("21999998888");
    expect(estagio.liberadoEm).toBe(liberadoEm);
    expect(formulario.situacao).toBe("aprovado");
    expect(obterEstado().pareceres).toHaveLength(quantidadePareceres);
  });

  it("cancelamento mantém histórico, remove dados pessoais e impede reidratação e continuidade", async () => {
    const { aluno, estagio, formulario } = await solicitar();
    await cancelarSolicitacao(estagio.id, aluno);
    expect(estagio.nomeAlunoHistorico).toBe(aluno.nome);
    expect(formulario.valores.nomeCompleto).toBe(aluno.nome);
    expect(formulario.valores.emailAluno).toBeUndefined();
    expect(formulario.valores.cepAluno).toBeUndefined();
    expect(
      (await valoresAutomaticos(formulario.templateId, aluno, estagio.id)).cpf,
    ).toBeUndefined();
    await expect(solicitarEncaminhamento(estagio.id, aluno)).rejects.toThrow();
    await expect(criarRascunho(aluno, formulario.templateId, estagio.id)).rejects.toThrow();
    expect(aluno.dadosPessoais!.cpf).toBeTruthy();
    expect((await criarEstagio(aluno, dadosSolicitacao())).id).not.toBe(estagio.id);
  });

  it("exclusão de estágio liberado preserva instituição e nome, sem excluir o perfil", async () => {
    const aluno = usuario("usr-maria");
    const excluido = await excluirEstagio("est-maria-tecnoweb", aluno);
    expect(excluido.excluidoEm).toBeTruthy();
    expect(excluido.convenioId).toBe("conv-ti-pinheiral");
    expect(excluido.nomeAlunoHistorico).toBe(aluno.nome);
    expect(usuario(aluno.id).dadosPessoais).toBeDefined();
  });

  it("exclusão remove também e-mails antigos do aluno no histórico de envios", async () => {
    const { aluno, estagio, formulario } = await solicitar();
    await solicitarEncaminhamento(estagio.id, aluno);
    await registrarParecer(formulario.id, "aprovado", usuario("usr-carla"));
    const enviosDoAluno = obterEstado().envios.filter(
      (envio) => envio.destinatarioPapel === "aluno",
    );
    expect(enviosDoAluno.length).toBeGreaterThan(0);
    aluno.email = "novo.email@exemplo.com";
    await excluirEstagio(estagio.id, aluno);
    expect(enviosDoAluno.every((envio) => envio.destinatarioEmail === "")).toBe(true);
  });
});

describe("observações por documento", () => {
  it("preserva autoria, datas e observações anteriores sem alterar decisões", async () => {
    const { formulario } = await solicitar();
    await acrescentarObservacao(formulario.id, "Primeira conferência", usuario("usr-carla"));
    await acrescentarObservacao(formulario.id, "Complemento", usuario("usr-ana"));
    const registros = await observacoesDoDocumento(formulario.id, usuario("usr-maria"));
    expect(registros.map((registro) => registro.autorId)).toEqual(["usr-carla", "usr-ana"]);
    expect(registros.every((registro) => !Number.isNaN(Date.parse(registro.data)))).toBe(true);
    expect(formulario.situacao).toBe("rascunho");
    await expect(
      acrescentarObservacao(formulario.id, "Inválida", usuario("usr-maria")),
    ).rejects.toThrow();
    await expect(
      acrescentarObservacao(formulario.id, "Inválida", usuario("usr-admin")),
    ).rejects.toThrow();
    await expect(
      acrescentarObservacao(formulario.id, "Inválida", usuario("usr-bruno")),
    ).rejects.toThrow();
  });
  it("permite observação em documento sem parecer de estágio concluído", async () => {
    const documento = obterEstado().documentos.find((doc) => doc.id === "doc-frequencia-hospital")!;
    const situacao = documento.situacao;
    await acrescentarObservacao(documento.id, "Conferência histórica", usuario("usr-ana"));
    expect(documento.situacao).toBe(situacao);
    expect(
      (await observacoesDoDocumento(documento.id, usuario("usr-carla"))).at(-1)?.conteudo,
    ).toBe("Conferência histórica");
  });
});
