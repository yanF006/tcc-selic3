import { describe, expect, it } from "vitest";

import { templates, templatesDownload, templatesPreenchiveis } from "@/lib/fixtures/templates";
import {
  DESCRITORES,
  camposDoTemplate,
  descritorPorTemplate,
  limitesDePalavras,
} from "@/lib/templates/descriptors";

const IDS_KIT = [
  "tpl-lei-estagio",
  "tpl-regulamento-licenciatura",
  "tpl-formulario-liberacao",
  "tpl-plano-atividades",
  "tpl-convenio-estagio",
  "tpl-termo-compromisso",
  "tpl-ficha-acompanhamento",
  "tpl-ficha-frequencia",
  "tpl-relatorio-semestral",
  "tpl-requerimento-aproveitamento",
  "tpl-termo-aditivo",
  "tpl-proposta-atuacao-pedagogica",
];

describe("catálogo de templates", () => {
  it("traz os 12 documentos do Kit", () => {
    expect(templates).toHaveLength(12);
    expect(templates.map((template) => template.id).sort()).toEqual([...IDS_KIT].sort());
  });

  it("separa downloads e preenchíveis", () => {
    expect(templatesDownload.map((template) => template.id)).toEqual([
      "tpl-lei-estagio",
      "tpl-regulamento-licenciatura",
    ]);
    expect(templatesPreenchiveis).toHaveLength(10);
  });

  it("mantém uma única versão vigente por template", () => {
    for (const template of templates) {
      expect(template.versoes.filter((versao) => versao.vigente)).toHaveLength(1);
    }
  });

  it("mantém histórico de versões dos documentos convertidos", () => {
    const convenio = templates.find((template) => template.id === "tpl-convenio-estagio");

    expect(convenio?.versoes).toHaveLength(2);
    expect(convenio?.versoes.filter((versao) => !versao.vigente)[0].arquivo).toMatch(/\.doc$/);
    expect(convenio?.versoes.find((versao) => versao.vigente)?.arquivo).toMatch(/\.docx$/);
  });

  it("exige convênio exclusivo do Campus Pinheiral", () => {
    for (const template of templates) {
      expect(template.nome).not.toMatch(/Arraial|Paracambi|Volta Redonda/i);
    }
  });
});

describe("metadados de preenchimento", () => {
  it("preenche documento só por quem é autorizado", () => {
    const preenchiveisPorAluno = templatesPreenchiveis
      .filter((template) => template.metadados?.papeisPreenchimento.includes("aluno"))
      .map((template) => template.id);

    expect(preenchiveisPorAluno.sort()).toEqual([
      "tpl-ficha-acompanhamento",
      "tpl-formulario-liberacao",
      "tpl-plano-atividades",
      "tpl-proposta-atuacao-pedagogica",
      "tpl-relatorio-semestral",
      "tpl-requerimento-aproveitamento",
      "tpl-termo-aditivo",
      "tpl-termo-compromisso",
    ]);

    const ficha = templates.find((template) => template.id === "tpl-ficha-frequencia");

    expect(ficha?.metadados?.papeisPreenchimento).toEqual(["coordenador_estagio"]);
  });

  it("encaminha o requerimento para a comissão de estágio", () => {
    const requerimento = templates.find(
      (template) => template.id === "tpl-requerimento-aproveitamento",
    );

    expect(requerimento?.metadados?.tipoParecer).toBe("comissao_estagio");
    expect(requerimento?.metadados?.assinaturas.map((a) => a.papel)).toContain("diretor_ensino");
  });

  it("não exige estágio no convênio", () => {
    const convenio = templates.find((template) => template.id === "tpl-convenio-estagio");

    expect(convenio?.metadados?.exigeEstagio).toBe(false);
    expect(templatesPreenchiveis.filter((t) => t.metadados?.exigeEstagio)).toHaveLength(9);
  });

  it("separa assinatura interna de externa", () => {
    const termo = templates.find((template) => template.id === "tpl-termo-compromisso");
    const assinaturas = termo?.metadados?.assinaturas ?? [];

    expect(assinaturas.filter((a) => a.tipo === "interna").length).toBeGreaterThan(0);
    expect(assinaturas.filter((a) => a.tipo === "externa").length).toBeGreaterThan(0);
  });

  it("não deixa template preenchível sem metadados", () => {
    for (const template of templatesPreenchiveis) {
      expect(template.metadados).toBeDefined();
      expect(template.metadados?.assinaturas.length).toBeGreaterThan(0);
    }
  });
});

describe("descritores", () => {
  it("cobre os 12 documentos", () => {
    expect(DESCRITORES).toHaveLength(12);
    expect(DESCRITORES.map((d) => d.templateId).sort()).toEqual([...IDS_KIT].sort());
  });

  it("não deixa campo com id repetido no mesmo template", () => {
    for (const descriptor of DESCRITORES) {
      const ids = camposDoTemplate(descriptor.templateId).map((campo) => campo.id);
      expect(new Set(ids).size, descriptor.templateId).toBe(ids.length);
    }
  });

  it("mantém a grade de 80 linhas da ficha de acompanhamento", () => {
    const grade = camposDoTemplate("tpl-ficha-acompanhamento").find(
      (campo) => campo.tipo === "grade",
    );

    expect(grade?.maximoLinhas).toBe(80);
    expect(grade?.totalAutomatico).toBe(true);
    expect(grade?.colunas?.map((coluna) => coluna.chave)).toEqual([
      "data",
      "entrada",
      "saida",
      "duracao",
      "rubrica",
    ]);
  });

  it("mantém os limites de palavras da proposta de atuação pedagógica", () => {
    expect(limitesDePalavras("tpl-proposta-atuacao-pedagogica")).toEqual({
      introducao: 400,
      objetivos: 200,
      fundamentacao: 300,
      metodologia: 200,
      recursos: 200,
      avaliacao: 200,
      resultados: 200,
      consideracoes: 400,
    });
  });

  it("mantém a escala de 0 a 10 e as faixas da ficha de frequência", () => {
    const campos = camposDoTemplate("tpl-ficha-frequencia");
    const criterios = campos.filter((campo) => campo.id.startsWith("criterio_"));

    expect(criterios).toHaveLength(13);
    for (const criterio of criterios) {
      expect(criterio.tipo).toBe("numero");
      expect(criterio.min).toBe(0);
      expect(criterio.max).toBe(10);
    }
    expect(campos.find((campo) => campo.id === "faixas")?.ajuda).toContain(
      "Excelente (10,0 a 9,0)",
    );
    expect(campos.find((campo) => campo.id === "faixas")?.ajuda).toContain(
      "Insuficiente (4,9 a 0,0)",
    );
  });

  it("exige os cinco comprovantes do requerimento", () => {
    const comprovantes = camposDoTemplate("tpl-requerimento-aproveitamento").filter((campo) =>
      campo.id.startsWith("comprovante_"),
    );

    expect(comprovantes).toHaveLength(5);
    expect(comprovantes.every((campo) => campo.obrigatorio)).toBe(true);
  });

  it("exige a data de escolha do orientador no requerimento", () => {
    const campos = camposDoTemplate("tpl-requerimento-aproveitamento");
    const perguntas = campos.filter((campo) => campo.tipo === "radio");

    expect(perguntas.map((campo) => campo.id)).toEqual([
      "parecer_plano",
      "parecer_contextualizacao",
      "parecer_itinerario",
      "decisao",
    ]);
  });

  it("mantém a autoavaliação com seis fatores do relatório", () => {
    const fatores = camposDoTemplate("tpl-relatorio-semestral").filter((campo) =>
      campo.id.startsWith("autoavaliacao_"),
    );

    expect(fatores).toHaveLength(6);
    expect(fatores[0].rotulo).toBe("Facilidade de Compreensão");
    expect(fatores.map((fator) => fator.opcoes?.map((opcao) => opcao.valor))).toEqual(
      Array(6).fill(["otimo", "bom", "regular", "insuficiente"]),
    );
  });

  it("mantém o tipo de atividade do plano de atividades", () => {
    const tipo = camposDoTemplate("tpl-plano-atividades").find(
      (campo) => campo.id === "tipoAtividade",
    );

    expect(tipo?.tipo).toBe("radio");
    expect(tipo?.opcoes?.map((opcao) => opcao.rotulo)).toEqual([
      "Estágio",
      "Projeto/Monitoria/Prática profissional",
    ]);
  });

  it("não cita Licenciatura em Computação na proposta", () => {
    const proposta = descritorPorTemplate("tpl-proposta-atuacao-pedagogica");

    expect(JSON.stringify(proposta)).not.toMatch(/Licenciatura em Computa/i);
  });

  it("separa formulário de liberação e plano de atividades em templates distintos", () => {
    expect(descritorPorTemplate("tpl-formulario-liberacao")).toBeDefined();
    expect(descritorPorTemplate("tpl-plano-atividades")).toBeDefined();
    expect(
      camposDoTemplate("tpl-plano-atividades").some((campo) => campo.id === "atividades"),
    ).toBe(true);
  });

  it("trata downloads como não preenchíveis", () => {
    expect(descritorPorTemplate("tpl-lei-estagio")?.preenchivel).toBe(false);
    expect(camposDoTemplate("tpl-lei-estagio")).toEqual([]);
  });
});
