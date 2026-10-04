import { describe, expect, it } from "vitest";

import { templates, templatesDownload, templatesPreenchiveis } from "@/lib/fixtures/templates";
import {
  DESCRITORES,
  classificacaoDoCampo,
  camposDoTemplate,
  descritorPorTemplate,
  limitesDePalavras,
  trechosNaoPreenchiveis,
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

  it("mantém a autoavaliação com os onze fatores do relatório", () => {
    const fatores = camposDoTemplate("tpl-relatorio-semestral").filter((campo) =>
      campo.id.startsWith("autoavaliacao_"),
    );

    expect(fatores).toHaveLength(11);
    expect(fatores[0].rotulo).toBe("Facilidade de Compreensão");
    expect(fatores.at(-1)?.rotulo).toBe("Postura Profissional e Comprometimento nas tarefas");
    expect(fatores.map((fator) => fator.opcoes?.map((opcao) => opcao.valor))).toEqual(
      Array(11).fill(["otimo", "bom", "regular", "insuficiente"]),
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

describe("origem dos campos", () => {
  it("declara a origem de todos os campos", () => {
    for (const descriptor of DESCRITORES) {
      for (const campo of camposDoTemplate(descriptor.templateId)) {
        expect(["aluno", "estagio", "literal", "digitado"], campo.id).toContain(campo.origem);
      }
    }
  });

  it("torna somente leitura o que vem do aluno ou do estágio", () => {
    for (const descriptor of DESCRITORES) {
      for (const campo of camposDoTemplate(descriptor.templateId)) {
        if (campo.origem === "aluno" || campo.origem === "estagio") {
          expect(campo.somenteLeitura, `${descriptor.templateId}.${campo.id}`).toBe(true);
        }
      }
    }
  });

  it("deixa digitáveis os campos que o usuário informa", () => {
    for (const descriptor of DESCRITORES) {
      for (const campo of camposDoTemplate(descriptor.templateId)) {
        if (campo.origem === "digitado") {
          expect(campo.somenteLeitura, `${descriptor.templateId}.${campo.id}`).not.toBe(true);
        }
      }
    }
  });
});

describe("máscara e validação dos campos", () => {
  it("aplica máscara e regra aos dados do aluno com dígito verificador", () => {
    const campos = camposDoTemplate("tpl-plano-atividades");
    const cpf = campos.find((campo) => campo.id === "cpf");

    expect(cpf?.mascara).toBe("cpf");
    expect(cpf?.validacao).toEqual(["cpf"]);
  });

  it("valida contato e endereço pelas regras reutilizáveis", () => {
    const campos = camposDoTemplate("tpl-formulario-liberacao");

    expect(campos.find((campo) => campo.id === "cepAluno")?.validacao).toEqual(["cep"]);
    expect(campos.find((campo) => campo.id === "telefoneAluno")?.mascara).toBe("telefone");
    expect(campos.find((campo) => campo.id === "celularAluno")?.validacao).toEqual(["celular"]);
    expect(campos.find((campo) => campo.id === "emailAluno")?.validacao).toEqual(["email"]);
  });

  it("trata o limite de palavras do template como regra de validação", () => {
    for (const [id, limite] of Object.entries(
      limitesDePalavras("tpl-proposta-atuacao-pedagogica"),
    )) {
      const campo = camposDoTemplate("tpl-proposta-atuacao-pedagogica").find(
        (item) => item.id === id,
      );

      expect(campo?.validacao, id).toContain("limite_palavras");
      expect(campo?.maximoPalavras, id).toBe(limite);
    }
  });

  it("trata par de datas como intervalo", () => {
    const campos = camposDoTemplate("tpl-convenio-estagio");

    expect(campos.find((campo) => campo.id === "inicioVigencia")?.validacao).toContain(
      "intervalo_datas",
    );
    expect(campos.find((campo) => campo.id === "fimVigencia")?.validacao).toContain(
      "intervalo_datas",
    );
  });

  it("mascara entrada e saída da grade de horas", () => {
    const grade = camposDoTemplate("tpl-ficha-acompanhamento").find(
      (campo) => campo.id === "lancamentos",
    );

    expect(grade?.colunas?.map((coluna) => coluna.mascara)).toEqual([
      "data",
      "hora",
      "hora",
      undefined,
      undefined,
    ]);
  });
});

describe("classificação dos trechos do documento", () => {
  const trecho = (tipo: "texto" | "fixo" | "instrucao") => ({
    id: "trecho",
    rotulo: "Trecho",
    tipo,
    origem: "literal" as const,
  });

  it("separa campo, trecho fixo e instrução do template", () => {
    expect(classificacaoDoCampo(trecho("texto"))).toBe("campo");
    expect(classificacaoDoCampo(trecho("fixo"))).toBe("fixo");
    expect(classificacaoDoCampo(trecho("instrucao"))).toBe("instrucao");
  });

  it("não manda texto fixo nem instrução para a validação do preenchimento", () => {
    const faixas = trechosNaoPreenchiveis("tpl-ficha-frequencia");

    expect(faixas.map((campo) => campo.id)).toEqual(["instrucaoPreenchimento", "faixas"]);
    expect(faixas.at(-1)?.ajuda).toContain("Excelente (10,0 a 9,0)");
  });
});

describe("metadados de parecer e assinatura no descritor", () => {
  it("leva parecer e assinaturas de todo documento preenchível", () => {
    for (const descriptor of DESCRITORES) {
      if (!descriptor.preenchivel) continue;

      expect(descriptor.metadados, descriptor.templateId).toBeDefined();
      expect(descriptor.metadados?.assinaturas.length, descriptor.templateId).toBeGreaterThan(0);
      expect(
        descriptor.metadados?.papeisPreenchimento.length,
        descriptor.templateId,
      ).toBeGreaterThan(0);
      expect(descriptor.metadados?.tipoParecer, descriptor.templateId).toBeDefined();
    }
  });

  it("não deixa download com metadado de preenchimento", () => {
    for (const descriptor of DESCRITORES) {
      if (descriptor.preenchivel) continue;

      expect(descriptor.metadados, descriptor.templateId).toBeUndefined();
    }
  });

  it("mantém o catálogo apontando para o mesmo metadado do descritor", () => {
    for (const template of templates) {
      expect(template.metadados, template.id).toBe(descritorPorTemplate(template.id)?.metadados);
    }
  });

  it("registra o arquivo do Kit de onde cada descritor foi escrito", () => {
    for (const template of templatesPreenchiveis) {
      expect(template.metadados?.arquivoOrigem, template.id).toMatch(
        /^Contexto\/kit-estagio\/.+\.docx?$/,
      );
    }
  });

  it("separa assinatura interna de externa pelo descritor", () => {
    const assinaturas = descritorPorTemplate("tpl-termo-compromisso")?.metadados?.assinaturas ?? [];

    expect(assinaturas.filter((a) => a.tipo === "interna").length).toBeGreaterThan(0);
    expect(assinaturas.filter((a) => a.tipo === "externa").length).toBeGreaterThan(0);
  });
});

describe("alinhamento com os arquivos do Kit", () => {
  it("inclui o parecer da coordenação no formulário de liberação", () => {
    const campos = camposDoTemplate("tpl-formulario-liberacao");

    expect(campos.find((campo) => campo.id === "planoDeAcordo")?.tipo).toBe("radio");
    expect(campos.find((campo) => campo.id === "consideracoes")?.tipo).toBe("textarea");
    expect(campos.find((campo) => campo.id === "dataParecer")?.tipo).toBe("data");
  });

  it("mantém a data de nascimento no plano de atividades", () => {
    const campos = camposDoTemplate("tpl-plano-atividades");
    const nascimento = campos.find((campo) => campo.id === "dataNascimento");

    expect(nascimento?.mascara).toBe("data");
    expect(nascimento?.somenteLeitura).toBe(true);
  });

  it("usa aluno e não orientador na ficha de acompanhamento", () => {
    const auto = descritorPorTemplate("tpl-ficha-acompanhamento")?.auto ?? [];

    expect(auto.map((campo) => campo.id)).toContain("aluno");
    expect(auto.map((campo) => campo.id)).not.toContain("orientador");
    expect(auto.map((campo) => campo.id)).toContain("supervisor");
  });

  it("registra as orientações de preenchimento da ficha de acompanhamento", () => {
    const obs = camposDoTemplate("tpl-ficha-acompanhamento").find(
      (campo) => campo.id === "instrucaoObs",
    );

    expect(obs && classificacaoDoCampo(obs)).toBe("instrucao");
    expect(obs?.ajuda).toContain("6 (seis) horas");
  });

  it("leva o período e o curso para a ficha de frequência", () => {
    const auto = descritorPorTemplate("tpl-ficha-frequencia")?.auto ?? [];
    const ids = auto.map((campo) => campo.id);

    expect(ids).toEqual(
      expect.arrayContaining(["campus", "aluno", "curso", "turma", "ano", "dataInicio", "dataFim"]),
    );
  });

  it("mantém fax, ramal, data e diplomado na ficha de frequência", () => {
    const campos = camposDoTemplate("tpl-ficha-frequencia");

    expect(campos.find((campo) => campo.id === "fax")?.mascara).toBe("telefone");
    expect(campos.find((campo) => campo.id === "ramal")?.tipo).toBe("texto");
    expect(campos.find((campo) => campo.id === "dataFicha")?.tipo).toBe("data");
    expect(campos.find((campo) => campo.id === "diplomadoEm")?.tipo).toBe("data");
  });

  it("mantém as três notas da ficha de frequência fora do preenchimento", () => {
    const instrucao = camposDoTemplate("tpl-ficha-frequencia").find(
      (campo) => campo.id === "instrucaoPreenchimento",
    );

    expect(instrucao?.ajuda).toContain("Recursos Humanos");
    expect(instrucao?.ajuda).toContain("Confidencial");
  });

  it("leva bairro, cidade e CEP para o relatório semestral", () => {
    const auto = descritorPorTemplate("tpl-relatorio-semestral")?.auto ?? [];
    const ids = auto.map((campo) => campo.id);

    expect(ids).toEqual(expect.arrayContaining(["bairro", "cidade", "cep", "instituicao"]));
    expect(ids).not.toContain("rg");
    expect(ids).not.toContain("cpf");
  });

  it("documenta a definição impressa ao lado de cada fator da autoavaliação", () => {
    const fatores = camposDoTemplate("tpl-relatorio-semestral").filter((campo) =>
      campo.id.startsWith("autoavaliacao_"),
    );

    expect(fatores.every((fator) => (fator.ajuda?.length ?? 0) > 20)).toBe(true);
  });

  it("identifica aluno, curso, semestre e turma no termo aditivo", () => {
    const auto = descritorPorTemplate("tpl-termo-aditivo")?.auto ?? [];
    const ids = auto.map((campo) => campo.id);

    expect(ids).toEqual(
      expect.arrayContaining(["aluno", "curso", "turma", "semestre", "instituicao"]),
    );
    expect(ids).not.toContain("supervisor");
    expect(ids).not.toContain("orientador");
  });

  it("gera a cláusula única como texto fixo do termo aditivo", () => {
    const clausula = camposDoTemplate("tpl-termo-aditivo").find(
      (campo) => campo.id === "clausulaUnica",
    );

    expect(clausula && classificacaoDoCampo(clausula)).toBe("fixo");
    expect(clausula?.ajuda).toContain("CLÁUSULA ÚNICA");
  });

  it("trata a orientação de preenchimento da proposta como instrução", () => {
    const instrucoes = trechosNaoPreenchiveis("tpl-proposta-atuacao-pedagogica").filter((campo) =>
      campo.id.startsWith("instrucao"),
    );

    expect(instrucoes.map((campo) => campo.id)).toEqual([
      "instrucaoTitulo",
      "instrucaoIntroducao",
      "instrucaoRecursos",
      "instrucaoAvaliacao",
    ]);
  });
  it("mantém a identificação completa da conveniada no convênio", () => {
    const campos = camposDoTemplate("tpl-convenio-estagio");
    const ids = campos.map((campo) => campo.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "cnpj",
        "ramal",
        "fax",
        "ramoAtividade",
        "identidade",
        "cic",
        "cargo",
      ]),
    );
    expect(campos.find((campo) => campo.id === "cargo")?.origem).toBe("digitado");
  });

  it("lista as cláusulas do convênio como texto fixo", () => {
    const clausulas = camposDoTemplate("tpl-convenio-estagio").find(
      (campo) => campo.id === "clausulas",
    );

    expect(clausulas && classificacaoDoCampo(clausulas)).toBe("fixo");
    expect(clausulas?.ajuda).toContain("DO SEGURO");
    expect(clausulas?.ajuda).toContain("DO FORO");
  });

  it("prevê duas testemunhas no convênio", () => {
    const ids = camposDoTemplate("tpl-convenio-estagio").map((campo) => campo.id);

    expect(ids).toEqual(expect.arrayContaining(["testemunha1", "testemunha2"]));
  });

  it("traz carga horária, seguro e vias fixas no termo de compromisso", () => {
    const campos = camposDoTemplate("tpl-termo-compromisso");
    const carga = campos.find((campo) => campo.id === "cargaHorariaTotal");

    expect(carga?.mascara).toBe("horas");
    expect(campos.map((campo) => campo.id)).toEqual(
      expect.arrayContaining(["seguradora", "numeroApolice", "duracaoMinimaDias", "vias"]),
    );
    expect(campos.find((campo) => campo.id === "vias")?.ajuda).toContain("3 (três) vias");
  });

  it("identifica o aluno no termo de compromisso por nome, nascimento, CPF e matrícula", () => {
    const auto = descritorPorTemplate("tpl-termo-compromisso")?.auto ?? [];
    const ids = auto.map((campo) => campo.id);

    expect(ids).toEqual(
      expect.arrayContaining(["nomeCompleto", "dataNascimento", "cpf", "matricula"]),
    );
    expect(ids).not.toContain("rg");
  });
});
