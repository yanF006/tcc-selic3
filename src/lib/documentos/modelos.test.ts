import PizZip from "pizzip";
import { describe, expect, it } from "vitest";

import { abrirModelo, gerarDocx, TEMPLATES_COM_MODELO } from "./gerar-docx";
import {
  camposDoTemplate,
  descritorPorTemplate,
  type CampoDescriptor,
} from "@/lib/templates/descriptors";

/**
 * Cobertura dos modelos marcados (tarefa 1.3). Para cada documento: o modelo
 * compila no docxtemplater, todo marcador corresponde a um campo do descritor,
 * todo campo preenchível tem lugar no modelo (salvo as exceções abaixo) e o
 * arquivo gerado traz os valores sem marcadores remanescentes.
 */

/**
 * Campos do descritor sem lugar no DOCX do Kit. Cada exceção é intencional: o
 * dado não existe no layout oficial, já aparece como texto fixo ou é repetição
 * de outro campo que está no modelo.
 */
const EXCECOES: Record<string, string[]> = {
  "tpl-formulario-liberacao": [
    "rg",
    "cpf",
    "instituicao",
    "dataInicio",
    "dataFim",
    "turma",
    "anoSemestre",
    "logradouroAluno",
    "numeroAluno",
    "complementoAluno",
    "cepLocal",
    "logradouroLocal",
    "numeroLocal",
    "complementoLocal",
    "bairroLocal",
    "cidadeLocal",
    "ufLocal",
  ],
  "tpl-plano-atividades": [],
  "tpl-termo-compromisso": [
    "supervisor",
    "orientador",
    "celular",
    "logradouro",
    "numero",
    "complemento",
    "uf",
    "seguradora",
    "numeroApolice",
    "cargaHorariaSemanal",
    "horario",
  ],
  "tpl-convenio-estagio": [
    "nomeFantasia",
    "uf",
    "logradouro",
    "numero",
    "complemento",
    "inicioVigencia",
  ],
  "tpl-termo-aditivo": ["justificativa"],
  "tpl-ficha-acompanhamento": [],
  "tpl-relatorio-semestral": [
    "logradouro",
    "numero",
    "complemento",
    "uf",
    "instituicaoCep",
    "instituicaoLogradouro",
    "instituicaoNumero",
    "instituicaoComplemento",
    "instituicaoBairro",
    "instituicaoCidade",
    "instituicaoUf",
  ],
  "tpl-requerimento-aproveitamento": [
    "rg",
    "cpf",
    "instituicao",
    "supervisor",
    "cargaHorariaTotal",
  ],
  "tpl-proposta-atuacao-pedagogica": ["dataInicio"],
};

const SEM_VALOR = new Set(["instrucao", "assinatura", "arquivo", "fixo"]);

function textoDoDocx(bytes: Buffer | ArrayBuffer): string {
  const xml = new PizZip(bytes).file("word/document.xml")!.asText();
  return xml.replace(/<w:tab\/>/g, "\t").replace(/<[^>]+>/g, "");
}

function marcadores(texto: string): string[] {
  return [...texto.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]);
}

/** O marcador pertence ao campo: `{id}`, `{id__opcao}`, partes de data ou linhas de grade. */
function pertence(marcador: string, campo: CampoDescriptor): boolean {
  if (marcador === campo.id) return true;
  if (campo.opcoes?.some((opcao) => marcador === `${campo.id}__${opcao.valor}`)) return true;
  if (["dia", "mes", "ano"].some((parte) => marcador === `${campo.id}_${parte}`)) return true;
  if (campo.tipo === "grade") {
    const colunas = (campo.colunas ?? []).map((coluna) => coluna.chave).join("|");
    return new RegExp(`^${campo.id}_(\\d+_(${colunas})|total)$`).test(marcador);
  }
  return false;
}

/** Valor de exemplo reconhecível no arquivo gerado. */
function exemplo(campo: CampoDescriptor): unknown {
  if (campo.tipo === "radio" || campo.tipo === "select") return campo.opcoes?.[0]?.valor;
  if (campo.tipo === "checkbox") return true;
  if (campo.tipo === "data" || campo.mascara === "data") return "2026-03-02";
  if (campo.tipo === "numero") return 12;
  if (campo.tipo === "grade") {
    return [
      Object.fromEntries(
        (campo.colunas ?? []).map((c) => [
          c.chave,
          c.tipo === "numero" ? 6 : c.tipo === "data" ? "2026-03-02" : `G-${c.chave}`,
        ]),
      ),
    ];
  }
  if (campo.mascara) return "12345678901";
  return `V-${campo.id}`;
}

describe.each(TEMPLATES_COM_MODELO.map((id) => [id]))("modelo %s", (templateId) => {
  const descriptor = descritorPorTemplate(templateId)!;
  const campos = camposDoTemplate(templateId, descriptor).filter(
    (campo) => !SEM_VALOR.has(campo.tipo),
  );
  const modelo = abrirModelo(templateId);
  const tags = marcadores(modelo.getFullText());

  it("compila e só usa marcadores de campos do descritor", () => {
    const desconhecidos = tags.filter((tag) => !campos.some((campo) => pertence(tag, campo)));
    expect(desconhecidos).toEqual([]);
  });

  it("tem lugar para todos os campos preenchíveis, salvo as exceções", () => {
    const semLugar = campos
      .filter((campo) => !tags.some((tag) => pertence(tag, campo)))
      .map((campo) => campo.id);
    expect(semLugar.sort()).toEqual([...(EXCECOES[templateId] ?? [])].sort());
  });

  it("gera o DOCX com os valores e sem marcadores", () => {
    const valores = Object.fromEntries(campos.map((campo) => [campo.id, exemplo(campo)]));
    const texto = textoDoDocx(gerarDocx(descriptor, valores));

    expect(texto).not.toMatch(/[{}]/);
    for (const campo of campos) {
      const textual = ["texto", "textarea"].includes(campo.tipo) && !campo.mascara;
      if (textual && tags.includes(campo.id)) expect(texto).toContain(`V-${campo.id}`);
    }
  });
});

describe("Termo Aditivo", () => {
  it("mantém em branco a data do Termo de Compromisso", () => {
    const descriptor = descritorPorTemplate("tpl-termo-aditivo")!;
    const texto = textoDoDocx(gerarDocx(descriptor, { novoTermino: "2026-12-20", aluno: "Maria" }));

    expect(texto).toContain("celebrado em _____/_____/____ entre o aluno(a) Maria");
    expect(texto).toContain("prorrogado até 20/12/2026");
  });
});
