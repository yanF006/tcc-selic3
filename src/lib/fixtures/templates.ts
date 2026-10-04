import type { TemplateDocumento } from "@/lib/domain/types";
import { descritorPorTemplate } from "@/lib/templates/descriptors";

/**
 * Catálogo dos 12 documentos do Kit de Estágio (D6). Os identificadores seguem
 * `tpl-<slug>`; versões `vigente: false` são mantidas para histórico.
 *
 * Quem preenche, a fila de parecer e as assinaturas exigidas não são repetidos
 * aqui: o descritor do documento é a única tabela desse metadado (D5), e o
 * catálogo apenas aponta para ele.
 */

const kit = "Contexto/kit-estagio";

/** Metadados de preenchimento declarados no descritor do documento. */
function metadados(templateId: string): TemplateDocumento["metadados"] {
  return descritorPorTemplate(templateId)?.metadados;
}

export const templates: TemplateDocumento[] = [
  {
    id: "tpl-lei-estagio",
    nome: "Lei de Estágio",
    tipo: "download",
    versoes: [
      {
        versao: 1,
        arquivo: `${kit}/01 - Lei de Estágio 11788.pdf`,
        registradaEm: "2026-01-15",
        vigente: true,
      },
    ],
    situacao: "ativo",
  },
  {
    id: "tpl-regulamento-licenciatura",
    nome: "Regulamento de Estágio dos Cursos de Licenciatura",
    tipo: "download",
    versoes: [
      {
        versao: 1,
        arquivo: `${kit}/02 - Regulamento_de_estagio_dos_cursos_de_licenciatura_novo (2).pdf`,
        registradaEm: "2026-01-15",
        vigente: true,
      },
    ],
    situacao: "ativo",
  },
  {
    id: "tpl-formulario-liberacao",
    nome: "Formulário de Liberação",
    tipo: "preenchivel",
    metadados: metadados("tpl-formulario-liberacao"),
    versoes: [
      {
        versao: 1,
        arquivo: `${kit}/04 - Formulario de Liberacao Licenciatura.docx`,
        registradaEm: "2026-01-15",
        vigente: true,
      },
    ],
    situacao: "ativo",
  },
  {
    id: "tpl-plano-atividades",
    nome: "Plano de Atividades de Estágio",
    tipo: "preenchivel",
    metadados: metadados("tpl-plano-atividades"),
    versoes: [
      {
        versao: 1,
        arquivo: `${kit}/05 - Plano de atividades de estágio.docx`,
        registradaEm: "2026-01-15",
        vigente: true,
      },
    ],
    situacao: "ativo",
  },
  {
    id: "tpl-convenio-estagio",
    nome: "Convênio de Estágio",
    tipo: "preenchivel",
    metadados: metadados("tpl-convenio-estagio"),
    versoes: [
      {
        versao: 1,
        arquivo: `${kit}/03 - Convenio de estagio - Campus Pinheiral.doc`,
        registradaEm: "2026-01-15",
        vigente: false,
      },
      {
        versao: 2,
        arquivo: `${kit}/03 - Convenio de estagio - Campus Pinheiral.docx`,
        registradaEm: "2026-02-01",
        vigente: true,
      },
    ],
    situacao: "ativo",
  },
  {
    id: "tpl-termo-compromisso",
    nome: "Termo de Compromisso",
    tipo: "preenchivel",
    metadados: metadados("tpl-termo-compromisso"),
    versoes: [
      {
        versao: 1,
        arquivo: `${kit}/06 - Termo de compromisso. Licenciatura.doc`,
        registradaEm: "2026-01-15",
        vigente: false,
      },
      {
        versao: 2,
        arquivo: `${kit}/06 - Termo de compromisso. Licenciatura.docx`,
        registradaEm: "2026-02-01",
        vigente: true,
      },
    ],
    situacao: "ativo",
  },
  {
    id: "tpl-ficha-acompanhamento",
    nome: "Ficha de Acompanhamento de Estagiário",
    tipo: "preenchivel",
    metadados: metadados("tpl-ficha-acompanhamento"),
    versoes: [
      {
        versao: 1,
        arquivo: `${kit}/07 - Ficha de Acompanhamento de Estagio.docx`,
        registradaEm: "2026-01-15",
        vigente: true,
      },
    ],
    situacao: "ativo",
  },
  {
    id: "tpl-ficha-frequencia",
    nome: "Ficha de Frequência e Avaliação do Estagiário",
    tipo: "preenchivel",
    metadados: metadados("tpl-ficha-frequencia"),
    versoes: [
      {
        versao: 1,
        arquivo: `${kit}/08 - Ficha de Frequencia e Avaliacao do Estagiário.docx`,
        registradaEm: "2026-01-15",
        vigente: true,
      },
    ],
    situacao: "ativo",
  },
  {
    id: "tpl-relatorio-semestral",
    nome: "Relatório Semestral de Estágio",
    tipo: "preenchivel",
    metadados: metadados("tpl-relatorio-semestral"),
    versoes: [
      {
        versao: 1,
        arquivo: `${kit}/09 - Relatorio Semestral de Estagio 2019.docx`,
        registradaEm: "2026-01-15",
        vigente: true,
      },
    ],
    situacao: "ativo",
  },
  {
    id: "tpl-requerimento-aproveitamento",
    nome: "Requerimento para Aproveitamento de Horas",
    tipo: "preenchivel",
    metadados: metadados("tpl-requerimento-aproveitamento"),
    versoes: [
      {
        versao: 1,
        arquivo: `${kit}/10 - EXTRA -  Requerimento para Aproveitamento de horas Licenciatura.docx`,
        registradaEm: "2026-01-15",
        vigente: true,
      },
    ],
    situacao: "ativo",
  },
  {
    id: "tpl-termo-aditivo",
    nome: "Termo Aditivo",
    tipo: "preenchivel",
    metadados: metadados("tpl-termo-aditivo"),
    versoes: [
      {
        versao: 1,
        arquivo: `${kit}/11 - EXTRA - Termo aditivo.docx`,
        registradaEm: "2026-01-15",
        vigente: true,
      },
    ],
    situacao: "ativo",
  },
  {
    id: "tpl-proposta-atuacao-pedagogica",
    nome: "Proposta de Atuação Pedagógica",
    tipo: "preenchivel",
    metadados: metadados("tpl-proposta-atuacao-pedagogica"),
    versoes: [
      {
        versao: 1,
        arquivo: `${kit}/12 - Proposta de Atuação Pedagógica_note_ago24.docx`,
        registradaEm: "2026-08-24",
        vigente: true,
      },
    ],
    situacao: "ativo",
  },
];

export const templatesPreenchiveis = templates.filter(
  (template) => template.tipo === "preenchivel",
);

export const templatesDownload = templates.filter((template) => template.tipo === "download");
