import type { TemplateDocumento } from "@/lib/domain/types";

/**
 * Catálogo dos 12 documentos do Kit de Estágio (D6). Os identificadores seguem
 * `tpl-<slug>`; versões `vigente: false` são mantidas para histórico.
 */

const kit = "Contexto/kit-estagio";

/** Documentos com `.doc` no Kit, aguardando conversão para `.docx`. */
export const OBSERVACAO_CONVERSAO =
  "Arquivo original em formato .doc no Kit de Estágio; dependende da conversão para .docx (tarefa 15.1).";

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
    metadados: {
      papeisPreenchimento: ["aluno"],
      tipoParecer: "coordenador_curso",
      exigeEstagio: true,
      assinaturas: [
        { papel: "coordenador_curso", rotulo: "Coordenador(a) de Área/Curso", tipo: "interna" },
        { papel: "aluno", rotulo: "Aluno(a)", tipo: "interna" },
      ],
      arquivoOrigem: `${kit}/04 - Formulario de Liberacao Licenciatura.docx`,
    },
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
    metadados: {
      papeisPreenchimento: ["aluno"],
      tipoParecer: "coordenador_curso",
      exigeEstagio: true,
      assinaturas: [
        { papel: "aluno", rotulo: "Aluno(a)", tipo: "interna" },
        { papel: "externo", rotulo: "Supervisor(a) de Estágio", tipo: "externa" },
      ],
      arquivoOrigem: `${kit}/05 - Plano de atividades de estágio.docx`,
    },
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
    metadados: {
      papeisPreenchimento: ["coordenador_estagio"],
      tipoParecer: "externo",
      exigeEstagio: false,
      assinaturas: [
        { papel: "coordenador_estagio", rotulo: "Coordenador(a) de Estágio", tipo: "interna" },
        { papel: "externo", rotulo: "Representante da instituição", tipo: "externa" },
      ],
      arquivoOrigem: `${kit}/03 - Convenio de estagio - Campus Pinheiral.doc`,
      observacao: OBSERVACAO_CONVERSAO,
    },
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
    metadados: {
      papeisPreenchimento: ["aluno"],
      tipoParecer: "externo",
      exigeEstagio: true,
      assinaturas: [
        { papel: "aluno", rotulo: "Estagiário(a)", tipo: "interna" },
        { papel: "externo", rotulo: "Supervisor(a) de Estágio", tipo: "externa" },
        { papel: "orientador", rotulo: "Professor(a) Orientador(a)", tipo: "interna" },
      ],
      arquivoOrigem: `${kit}/06 - Termo de compromisso. Licenciatura.doc`,
      observacao: OBSERVACAO_CONVERSAO,
    },
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
    metadados: {
      papeisPreenchimento: ["aluno"],
      tipoParecer: "nenhum",
      exigeEstagio: true,
      assinaturas: [
        { papel: "aluno", rotulo: "Aluno(a) estagiário(a)", tipo: "interna" },
        { papel: "externo", rotulo: "Supervisor(a) do local de estágio", tipo: "externa" },
      ],
      arquivoOrigem: `${kit}/07 - Ficha de Acompanhamento de Estagio.docx`,
    },
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
    metadados: {
      papeisPreenchimento: ["coordenador_estagio"],
      tipoParecer: "externo",
      exigeEstagio: true,
      assinaturas: [
        {
          papel: "externo",
          rotulo: "Responsável da concedente (RH ou chefe imediato)",
          tipo: "externa",
        },
        { papel: "coordenador_estagio", rotulo: "Responsável da COIEE", tipo: "interna" },
      ],
      arquivoOrigem: `${kit}/08 - Ficha de Frequencia e Avaliacao do Estagiário.docx`,
    },
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
    metadados: {
      papeisPreenchimento: ["aluno"],
      tipoParecer: "coordenador_curso",
      exigeEstagio: true,
      assinaturas: [
        { papel: "aluno", rotulo: "Aluno(a)", tipo: "interna" },
        { papel: "orientador", rotulo: "Professor(a) Orientador(a)", tipo: "interna" },
        { papel: "coordenador_curso", rotulo: "Coordenador(a) do Curso", tipo: "interna" },
      ],
      arquivoOrigem: `${kit}/09 - Relatorio Semestral de Estagio 2019.docx`,
    },
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
    metadados: {
      papeisPreenchimento: ["aluno"],
      tipoParecer: "comissao_estagio",
      exigeEstagio: true,
      assinaturas: [
        { papel: "aluno", rotulo: "Aluno(a)", tipo: "interna" },
        { papel: "coordenador_curso", rotulo: "Coordenador(a) do Curso", tipo: "interna" },
        { papel: "comissao_estagio", rotulo: "Coordenador(a) da COIEE", tipo: "interna" },
        { papel: "diretor_ensino", rotulo: "Diretor(a) de Ensino", tipo: "interna" },
      ],
      arquivoOrigem: `${kit}/10 - EXTRA -  Requerimento para Aproveitamento de horas Licenciatura.docx`,
    },
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
    metadados: {
      papeisPreenchimento: ["aluno"],
      tipoParecer: "externo",
      exigeEstagio: true,
      assinaturas: [
        { papel: "externo", rotulo: "Concedente", tipo: "externa" },
        { papel: "aluno", rotulo: "Estagiário(a)", tipo: "interna" },
        { papel: "convenente", rotulo: "Convenente (IFRJ)", tipo: "interna" },
      ],
      arquivoOrigem: `${kit}/11 - EXTRA - Termo aditivo.docx`,
    },
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
    metadados: {
      papeisPreenchimento: ["aluno"],
      tipoParecer: "coordenador_curso",
      exigeEstagio: true,
      assinaturas: [
        { papel: "aluno", rotulo: "Aluno(a)", tipo: "interna" },
        { papel: "orientador", rotulo: "Professor(a) Orientador(a) de Estágio", tipo: "interna" },
      ],
      arquivoOrigem: `${kit}/12 - Proposta de Atuação Pedagógica_note_ago24.docx`,
    },
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
