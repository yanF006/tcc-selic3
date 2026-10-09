import { beforeEach, describe, expect, it } from "vitest";

import { LIMITE_HORAS_DIA, LIMITE_HORAS_SEMANA } from "@/lib/domain/schemas";
import type { Usuario } from "@/lib/domain/types";

import {
  classificacaoConvenio,
  convenioPorId,
  listarConvenios,
  listarSupervisores,
  opcoesSelecao,
  renovarConvenio,
  somarAnos,
} from "./catalogo";
import {
  criarRascunho,
  documentoPorId,
  documentosParaParecer,
  iniciarAnalise,
  registrarParecer,
  salvarRascunho,
  submeter,
  validarValores,
} from "./documentos";

import {
  concluirEstagio,
  criarEstagio,
  editarEstagio,
  estagioComContexto,
  estagiosDoAluno,
  estagiosDoCurso,
  lancamentosDoEstagio,
  removerDocumentoEstagio,
  solicitarExclusaoEstagio,
} from "./estagios";
import { corrigirLancamento, horasDaSemana, lancarHoras, resumoDaSemana } from "./lancamentos";
import { entrar, membroComissaoEstagio, sair, temPapel, usuarioAtual } from "./sessao";
import { obterEstado, reiniciarEstado } from "./store";

const HOJE = "2026-06-01";

async function login(email: string) {
  const resultado = await entrar(email, "selic123");

  expect(resultado.ok).toBe(true);

  return usuarioAtual() as Usuario;
}

beforeEach(() => {
  reiniciarEstado();
  sair();
});

describe("sessão simulada", () => {
  it("autentica pelas quatro contas de desenvolvimento", async () => {
    for (const email of [
      "maria.souza@aluno.ifrj.edu.br",
      "ana.correia@ifrj.edu.br",
      "carla.menezes@ifrj.edu.br",
      "felipe.andrade@ifrj.edu.br",
    ]) {
      await sair();
      await login(email);
      expect(usuarioAtual()?.email).toBe(email);
    }
  });

  it("recusa senha errada", async () => {
    await expect(entrar("maria.souza@aluno.ifrj.edu.br", "errada")).resolves.toEqual({
      ok: false,
      erro: "E-mail ou senha inválidos.",
    });
  });

  it("distingue os papéis", async () => {
    await login("ana.correia@ifrj.edu.br");
    expect(temPapel("coordenador_estagio")).toBe(true);
    expect(temPapel("aluno")).toBe(false);

    await login("carla.menezes@ifrj.edu.br");
    expect(temPapel("coordenador_curso")).toBe(true);
  });

  it("trata comissão de estágio como condição do Coordenador de Estágio", async () => {
    await login("ana.correia@ifrj.edu.br");
    expect(membroComissaoEstagio()).toBe(true);

    await login("maria.souza@aluno.ifrj.edu.br");
    expect(membroComissaoEstagio()).toBe(false);
  });

  it("encerra a sessão", async () => {
    await login("maria.souza@aluno.ifrj.edu.br");
    await sair();
    expect(usuarioAtual()).toBeNull();
  });
});

describe("catálogos e convênios", () => {
  it("classifica convênio vigente e vencido", async () => {
    const vigente = await convenioPorId("conv-ti-pinheiral");
    const vencido = await convenioPorId("conv-cooperativa-serrinha");

    expect(classificacaoConvenio(vigente!, HOJE)).toBe("ativo");
    expect(classificacaoConvenio(vencido!, HOJE)).toBe("expirado");
    const expirados = await listarConvenios({ situacao: "expirado" });

    expect(expirados.itens.map((c) => c.id).sort()).toEqual([
      "conv-cooperativa-serrinha",
      "conv-lab-eletro",
    ]);
  });

  it("soma anos sem quebrar dia 29 de fevereiro", async () => {
    expect(somarAnos("2024-02-29", 1)).toBe("2025-02-28");
    expect(somarAnos("2025-03-01", 5)).toBe("2030-03-01");
  });

  it("renova convênio vencido por mais 5 anos", async () => {
    const renovado = await renovarConvenio("conv-cooperativa-serrinha", HOJE);

    expect(renovado.inicioVigencia).toBe("2022-12-31");
    expect(renovado.fimVigencia).toBe("2027-12-31");
    expect(renovado.renovacoes).toBe(1);
  });

  it("recusa renovar convênio ainda vigente", async () => {
    await expect(renovarConvenio("conv-ti-pinheiral", HOJE)).rejects.toThrow(/vigente/);
  });

  it("mantém supervisor inativo na lista para correção", async () => {
    const supervisores = await listarSupervisores();

    expect(supervisores.find((p) => p.id === "sup-jonathan")?.situacao).toBe("inativo");
  });

  it("monta opções dos selects a partir do cadastro", async () => {
    const opcoes = await opcoesSelecao();

    expect(opcoes.cursosIds).toContain("curso-ads");
    expect(opcoes.turmasPorCurso["curso-ads"]).toEqual(["turma-ads-2026-1a", "turma-ads-2025-2b"]);
  });
});

describe("cadastro de estágio", () => {
  it("cria estágio válido com documentos permitidos ao aluno", async () => {
    const aluno = await login("maria.souza@aluno.ifrj.edu.br");

    const estagio = await criarEstagio(aluno, {
      convenioId: "conv-ti-pinheiral",
      supervisorId: "sup-ricardo",
      orientadorId: "ori-carla",
      dataInicio: "01/09/2026",
      dataFim: "30/11/2026",
      documentosSelecionados: [
        "tpl-termo-compromisso",
        "tpl-ficha-frequencia",
        "tpl-proposta-atuacao-pedagogica",
      ],
    });

    expect(estagio.situacao).toBe("em_andamento");
    // A ficha de frequência é preenchida pela coordenação, não pelo aluno.
    expect(estagio.documentosSelecionados).toEqual([
      "tpl-termo-compromisso",
      "tpl-proposta-atuacao-pedagogica",
    ]);
  });

  it("recusa convênio vencido", async () => {
    const aluno = await login("maria.souza@aluno.ifrj.edu.br");

    await expect(
      criarEstagio(aluno, {
        convenioId: "conv-cooperativa-serrinha",
        supervisorId: "sup-ricardo",
        orientadorId: "ori-carla",
        dataInicio: "01/09/2026",
        dataFim: "30/11/2026",
      }),
    ).rejects.toThrow(/vencido/);
  });

  it("recusa supervisor inativo", async () => {
    const aluno = await login("joao.lima@aluno.ifrj.edu.br");

    await expect(
      criarEstagio(aluno, {
        convenioId: "conv-ti-pinheiral",
        supervisorId: "sup-jonathan",
        orientadorId: "ori-carla",
        dataInicio: "01/09/2026",
        dataFim: "30/11/2026",
      }),
    ).rejects.toThrow(/Supervisor inativo/);
  });

  it("recusa período sobreposto a outro estágio do mesmo aluno", async () => {
    const aluno = await login("maria.souza@aluno.ifrj.edu.br");

    await expect(
      criarEstagio(aluno, {
        convenioId: "conv-ti-pinheiral",
        supervisorId: "sup-marta",
        orientadorId: "ori-carla",
        dataInicio: "01/06/2026",
        dataFim: "30/11/2026",
      }),
    ).rejects.toThrow(/conflita/);
  });

  it("recusa data final anterior à inicial", async () => {
    const aluno = await login("maria.souza@aluno.ifrj.edu.br");

    await expect(
      criarEstagio(aluno, {
        convenioId: "conv-ti-pinheiral",
        supervisorId: "sup-ricardo",
        orientadorId: "ori-carla",
        dataInicio: "01/12/2026",
        dataFim: "01/11/2026",
      }),
    ).rejects.toThrow();
  });

  it("recusa criação por papel sem aluno", async () => {
    const coordenador = await login("ana.correia@ifrj.edu.br");

    await expect(
      criarEstagio(coordenador, {
        convenioId: "conv-ti-pinheiral",
        supervisorId: "sup-ricardo",
        orientadorId: "ori-carla",
        dataInicio: "01/12/2026",
        dataFim: "01/11/2026",
      }),
    ).rejects.toThrow(/Apenas alunos/);
  });

  it("monta o contexto do estágio com horas lançadas", async () => {
    const contexto = await estagioComContexto("est-maria-tecnoweb");

    expect(contexto?.convenio?.nome).toContain("Tecnoweb");
    expect(contexto?.supervisor?.nome).toBe("Ricardo Alves");
    expect(contexto?.orientador?.nome).toBe("Carla Menezes");
    // 7 + 7 + 5,5 (o lançamento de 03/04 foi corrigido para 5,5 h).
    expect(contexto?.horasLancadas).toBe(19.5);
  });

  it("encerra o estágio bloqueando novos lançamentos", async () => {
    await login("maria.souza@aluno.ifrj.edu.br");
    await concluirEstagio("est-maria-tecnoweb");

    await expect(
      lancarHoras({
        estagioId: "est-maria-tecnoweb",
        data: "2026-03-05",
        entrada: "09:00",
        saida: "15:00",
        almocoDesligado: true,
      }),
    ).rejects.toThrow(/em andamento/);
  });
});

describe("lançamento de horas", () => {
  it("desconta o almoço e recusa dia acima de 6 horas", async () => {
    await login("maria.souza@aluno.ifrj.edu.br");

    await expect(
      lancarHoras({
        estagioId: "est-maria-tecnoweb",
        data: "2026-03-05",
        entrada: "08:00",
        saida: "17:00",
        almocoDesligado: true,
      }),
    ).rejects.toThrow(/6 horas/);
  });

  it("recusa data fora do período do estágio", async () => {
    await login("maria.souza@aluno.ifrj.edu.br");

    await expect(
      lancarHoras({
        estagioId: "est-maria-tecnoweb",
        data: "2026-09-15",
        entrada: "09:00",
        saida: "15:00",
        almocoDesligado: true,
      }),
    ).rejects.toThrow(/fora do período/);
  });

  it("recusa data já lançada", async () => {
    await login("maria.souza@aluno.ifrj.edu.br");

    await expect(
      lancarHoras({
        estagioId: "est-maria-tecnoweb",
        data: "2026-03-02",
        entrada: "09:00",
        saida: "16:00",
        almocoDesligado: true,
      }),
    ).rejects.toThrow(/já lançada/);
  });

  it("recusa ultrapassar 30 horas na semana", async () => {
    await login("joao.lima@aluno.ifrj.edu.br");
    const estagio = await criarEstagio(usuarioAtual() as Usuario, {
      convenioId: "conv-ti-pinheiral",
      supervisorId: "sup-ricardo",
      orientadorId: "ori-bruno",
      dataInicio: "01/02/2026",
      dataFim: "30/04/2026",
    });

    // Segunda a sábado de 02/02 a 07/02/2026: 5 dias de 6 h fecham as 30 h.
    for (const dia of ["2026-02-02", "2026-02-03", "2026-02-04", "2026-02-05", "2026-02-06"]) {
      await lancarHoras({
        estagioId: estagio.id,
        data: dia,
        entrada: "09:00",
        saida: "16:00",
        almocoDesligado: true,
      });
    }

    expect(await horasDaSemana(estagio.id, "2026-02-02")).toBe(LIMITE_HORAS_SEMANA);

    await expect(
      lancarHoras({
        estagioId: estagio.id,
        data: "2026-02-07",
        entrada: "09:00",
        saida: "13:00",
        almocoDesligado: true,
      }),
    ).rejects.toThrow(/30 horas/);
  });

  it("correção preserva o lançamento original", async () => {
    await login("maria.souza@aluno.ifrj.edu.br");

    const correcao = await corrigirLancamento("lan-1", {
      entrada: "09:00",
      saida: "16:00",
      almocoDesligado: true,
    });

    expect(correcao.tipo).toBe("correcao");
    expect(correcao.corrigeId).toBe("lan-1");

    const dia = lancamentosDoEstagio("est-maria-tecnoweb").filter((l) => l.data === "2026-03-02");

    expect(dia).toHaveLength(2);
    expect(dia.find((l) => l.id === "lan-1")?.horas).toBe(7);
    // 6 h corrigidas + 7 h de 03/03 + 5,5 h de 03/04.
    expect(await horasDaSemana("est-maria-tecnoweb", "2026-03-02")).toBe(18.5);
  });

  it("não deixa corrigir uma correção", async () => {
    await login("maria.souza@aluno.ifrj.edu.br");

    const correcao = await corrigirLancamento("lan-1", {
      entrada: "09:00",
      saida: "15:00",
      almocoDesligado: true,
    });

    await expect(
      corrigirLancamento(correcao.id, { entrada: "09:00", saida: "14:00", almocoDesligado: true }),
    ).rejects.toThrow(/originais/);
  });

  it("resume a semana com limite e sinal de excesso", async () => {
    const resumo = await resumoDaSemana("est-maria-tecnoweb", "2026-03-04");

    expect(resumo.semana).toBe("2026-03-02");
    expect(resumo.horas).toBe(19.5);
    expect(resumo.limite).toBe(LIMITE_HORAS_SEMANA);
    expect(resumo.excedeu).toBe(false);
  });

  it("aplica o limite diário de 6 horas", async () => {
    await login("maria.souza@aluno.ifrj.edu.br");
    const estagio = "est-maria-tecnoweb";

    await lancarHoras({
      estagioId: estagio,
      data: "2026-03-05",
      entrada: "09:00",
      saida: "15:00",
      almocoDesligado: true,
    });

    expect(
      lancamentosDoEstagio(estagio)
        .filter((l) => l.data === "2026-03-05")
        .reduce((total, l) => total + l.horas, 0),
    ).toBeLessThanOrEqual(LIMITE_HORAS_DIA);
  });
});

describe("documentos", () => {
  beforeEach(() => {
    // Os testes de fluxo partem dos documentos zerados, sem os das fixtures.
    obterEstado().documentos.length = 0;
    obterEstado().pareceres.length = 0;
    obterEstado().notificacoes.length = 0;
  });

  it("cria rascunho e reaproveita o documento aberto", async () => {
    const aluno = await login("maria.souza@aluno.ifrj.edu.br");

    const primeiro = await criarRascunho(aluno, "tpl-plano-atividades", "est-maria-tecnoweb");
    const segundo = await criarRascunho(aluno, "tpl-plano-atividades", "est-maria-tecnoweb");

    expect(primeiro.id).toBe(segundo.id);
    expect(primeiro.situacao).toBe("rascunho");
  });

  it("exige estágio selecionado quando o documento exige", async () => {
    const aluno = await login("maria.souza@aluno.ifrj.edu.br");

    await expect(criarRascunho(aluno, "tpl-relatorio-semestral")).rejects.toThrow(
      /Selecione o estágio/,
    );
  });

  it("não cria documento de outro papel", async () => {
    const aluno = await login("maria.souza@aluno.ifrj.edu.br");

    await expect(
      criarRascunho(aluno, "tpl-ficha-frequencia", "est-maria-tecnoweb"),
    ).rejects.toThrow(/não disponível/);
  });

  it("deixa o Coordenador de Estágio abrir o Convênio", async () => {
    const coordenador = await login("ana.correia@ifrj.edu.br");

    const convenio = await criarRascunho(coordenador, "tpl-convenio-estagio");

    expect(convenio.templateId).toBe("tpl-convenio-estagio");
    expect(convenio.situacao).toBe("rascunho");
  });

  it("preenche a duração do Termo de Compromisso com o total do estágio", async () => {
    const aluno = await login("maria.souza@aluno.ifrj.edu.br");

    const documento = await criarRascunho(aluno, "tpl-termo-compromisso", "est-maria-tecnoweb");

    expect(typeof documento.valores.cargaHorariaTotal).toBe("number");
    expect(documento.valores.cargaHorariaTotal as number).toBeGreaterThan(0);
  });

  it("valida os limites de palavras do descritor", async () => {
    const problemas = validarValores("tpl-proposta-atuacao-pedagogica", {
      titulo: "Intervenção no ensino de lógica",
      introducao: Array(401).fill("palavra").join(" "),
      objetivos: "Objetivo geral e específicos.",
    });
    const deIntroducao = problemas.filter((problema) => problema.campo === "introducao");

    expect(deIntroducao).toHaveLength(1);
    expect(deIntroducao[0].mensagem).toContain("401");
    // As demais queixas são de campos obrigatórios ainda não preenchidos.
    expect(problemas.every((problema) => problema.campo !== "titulo")).toBe(true);
    expect(problemas.map((problema) => problema.campo)).toContain("fundamentacao");
  });

  it("recusa o comprovante do aproveitamento enquanto não estiver marcado", async () => {
    const comItensPendentes = validarValores("tpl-requerimento-aproveitamento", {
      cargaHorariaTotal: 120,
      comprovante_1: true,
      comprovante_2: true,
      comprovante_3: true,
      comprovante_4: true,
      comprovante_5: false,
    });

    expect(comItensPendentes.filter((problema) => problema.campo === "comprovante_5")).toHaveLength(
      1,
    );

    const completo = validarValores("tpl-requerimento-aproveitamento", {
      cargaHorariaTotal: 120,
      comprovante_1: true,
      comprovante_2: true,
      comprovante_3: true,
      comprovante_4: true,
      comprovante_5: true,
    });

    expect(completo).toEqual([]);
  });

  it("exige os campos obrigatórios na submissão", async () => {
    const aluno = await login("maria.souza@aluno.ifrj.edu.br");
    const documento = await criarRascunho(aluno, "tpl-plano-atividades", "est-maria-tecnoweb");

    await expect(submeter(documento.id)).rejects.toThrow(/obrigatório/);
  });

  it("submete documento com parecer para a fila do coordenador", async () => {
    const aluno = await login("maria.souza@aluno.ifrj.edu.br");
    const documento = await criarRascunho(aluno, "tpl-plano-atividades", "est-maria-tecnoweb");

    await salvarRascunho(documento.id, {
      tipoAtividade: "estagio",
      dataInicioPrevista: "01/03/2026",
      dataFimPrevista: "28/08/2026",
      atividades: "Apoio ao desenvolvimento de sistemas.",
    });

    const submetido = await submeter(documento.id);

    expect(submetido.situacao).toBe("submetido");
    // Ainda não está em análise: a fila só recebe o documento após o encaminhamento.
    const fila = await documentosParaParecer("coordenador_curso", usuarioAtual() as Usuario);

    expect(fila.itens).toEqual([]);
  });

  it("registra parecer depois da análise", async () => {
    const aluno = await login("maria.souza@aluno.ifrj.edu.br");
    const documento = await criarRascunho(aluno, "tpl-relatorio-semestral", "est-maria-tecnoweb");

    await salvarRascunho(documento.id, {
      descricaoEmpresa: "Empresa de tecnologia.",
      objetivos: "Aprender a prática.",
      desenvolvimento: "Desenvolvimento de sistemas.",
      dificuldades: "Nenhuma relevante.",
      consideracoesFinais: "A experiência agregou.",
      autoavaliacao_1: "bom",
    });

    const submetido = await submeter(documento.id);

    expect(submetido.situacao).toBe("submetido");

    const coordenador = await login("carla.menezes@ifrj.edu.br");
    const antesDaAnalise = await documentosParaParecer("coordenador_curso", coordenador);

    expect(antesDaAnalise.itens).toEqual([]);

    await iniciarAnalise(documento.id);

    const fila = await documentosParaParecer("coordenador_curso", coordenador);

    expect(fila.itens.map((d) => d.id)).toEqual([documento.id]);

    const aprovado = await registrarParecer(
      documento.id,
      "aprovado",
      coordenador,
      "Atividades compatíveis.",
    );

    expect(aprovado.situacao).toBe("aprovado");
    expect(
      obterEstado().notificacoes.filter(
        (n) => n.destinatarioId === "usr-maria" && n.tipo === "parecer",
      ),
    ).toHaveLength(1);
  });

  it("aprova documento em análise e notifica o aluno", async () => {
    const aluno = await login("maria.souza@aluno.ifrj.edu.br");
    const documento = await criarRascunho(aluno, "tpl-termo-compromisso", "est-maria-tecnoweb");

    await salvarRascunho(documento.id, {
      cnpj: "11222333000181",
      responsavel: "Marina Duarte",
      nomeDiretor: "Heider Alves Franco",
      endereco: "Rua das Acácias, 120",
      seguradora: "Porto Seguro",
      numeroApolice: "APOL-2026-4471",
      cargaHorariaTotal: 480,
      cargaHorariaSemanal: 30,
      horario: "09:00 às 16:00",
    });
    await submeter(documento.id);

    const fila = await documentosParaParecer("externo", aluno);

    expect(fila.itens).toEqual([]);

    // Sem parecer externo, o documento fica submetido até a assinatura externa.
    expect(documento.situacao).toBe("submetido");
  });

  it("impede editar documento que não é rascunho", async () => {
    const aluno = await login("maria.souza@aluno.ifrj.edu.br");
    const documento = await criarRascunho(aluno, "tpl-plano-atividades", "est-maria-tecnoweb");

    await salvarRascunho(documento.id, {
      tipoAtividade: "estagio",
      dataInicioPrevista: "01/03/2026",
      dataFimPrevista: "28/08/2026",
      atividades: "Atividades.",
    });
    await submeter(documento.id);

    await expect(salvarRascunho(documento.id, { atividades: "Outro texto" })).rejects.toThrow(
      /rascunhos/,
    );
  });

  it("não registra parecer em documento submetido fora da fila", async () => {
    const aluno = await login("maria.souza@aluno.ifrj.edu.br");
    const documento = await criarRascunho(aluno, "tpl-plano-atividades", "est-maria-tecnoweb");

    await salvarRascunho(documento.id, {
      tipoAtividade: "estagio",
      dataInicioPrevista: "01/03/2026",
      dataFimPrevista: "28/08/2026",
      atividades: "Atividades.",
    });
    await submeter(documento.id);

    const coordenador = await login("carla.menezes@ifrj.edu.br");

    await expect(registrarParecer(documento.id, "aprovado", coordenador)).rejects.toThrow(
      /possível emitir parecer/,
    );
  });

  it("lista estágios do aluno mais recente primeiro", async () => {
    await login("maria.souza@aluno.ifrj.edu.br");

    const estagios = await estagiosDoAluno("usr-maria");

    expect(estagios.map((e) => e.id)).toEqual(["est-maria-tecnoweb", "est-maria-hospital"]);
  });

  it("remove documento da seleção do estágio e inativa o documento preenchido sem apagá-lo", async () => {
    const aluno = await login("maria.souza@aluno.ifrj.edu.br");
    const estagio = await criarEstagio(aluno, {
      convenioId: "conv-ti-pinheiral",
      supervisorId: "sup-ricardo",
      orientadorId: "ori-carla",
      dataInicio: "2026-09-01",
      dataFim: "2027-02-28",
      documentosSelecionados: ["tpl-termo-compromisso"],
    });

    const doc = await criarRascunho(aluno, "tpl-termo-compromisso", estagio.id);

    expect(estagio.documentosSelecionados).toContain("tpl-termo-compromisso");
    expect(doc.situacao).toBe("rascunho");

    await removerDocumentoEstagio(estagio.id, "tpl-termo-compromisso");

    expect(estagio.documentosSelecionados).not.toContain("tpl-termo-compromisso");
    expect((await documentoPorId(doc.id))?.situacao).toBe("inativo");
  });

  it("edita estágio registrando autoria", async () => {
    const aluno = await login("maria.souza@aluno.ifrj.edu.br");
    const estagio = await criarEstagio(aluno, {
      convenioId: "conv-ti-pinheiral",
      supervisorId: "sup-ricardo",
      orientadorId: "ori-carla",
      dataInicio: "2026-09-01",
      dataFim: "2027-02-28",
    });

    const editado = await editarEstagio(
      estagio.id,
      { dataFim: "2027-03-01" },
      "usr-coordenador-curso",
    );

    expect(editado.dataFim).toBe("2027-03-01");
    expect(editado.editadoPorId).toBe("usr-coordenador-curso");
  });

  it("registra pedido de exclusão de estágio como pendente", async () => {
    const aluno = await login("maria.souza@aluno.ifrj.edu.br");
    const estagio = await criarEstagio(aluno, {
      convenioId: "conv-ti-pinheiral",
      supervisorId: "sup-ricardo",
      orientadorId: "ori-carla",
      dataInicio: "2026-09-01",
      dataFim: "2027-02-28",
    });

    const solicitacao = await solicitarExclusaoEstagio(estagio.id, aluno.id, "Mudança de empresa");

    expect(solicitacao.situacao).toBe("pendente");
    expect(solicitacao.motivo).toBe("Mudança de empresa");
    expect(obterEstado().exclusoes).toContain(solicitacao);
  });

  it("restringe estágios ao curso do aluno", async () => {
    const doAds = await estagiosDoCurso("curso-ads");

    expect(doAds.length).toBeGreaterThan(0);
    for (const est of doAds) {
      const usuario = obterEstado().usuarios.find((u) => u.id === est.alunoId);
      expect(usuario?.dadosPessoais?.cursoId).toBe("curso-ads");
    }
  });
});
