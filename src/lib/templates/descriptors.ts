import type { AssinaturaTemplate, Papel, TipoParecer } from "@/lib/domain/types";
import type { NomeMascara } from "@/lib/mask";

/**
 * Descritores dos documentos (D5). Os formulários são gerados a partir daqui:
 * nenhuma tela escreve o layout de um documento em JSX.
 *
 * O descritor é a configuração do documento — identidade, quem preenche, fila de
 * parecer, assinaturas exigidas e a lista de campos —, então o catálogo de
 * `fixtures/templates.ts` lê os metadados daqui em vez de manter uma segunda
 * tabela de permissão.
 *
 * Os textos de apoio reproduzem o Kit de Estágio; a contagem de palavras da
 * Proposta de Atuação Pedagógica vem dos limites impressos no formulário 12.
 */

/** De onde vem o valor do campo: do cadastro do aluno, do estágio ou do próprio documento. */
export type OrigemCampo = "aluno" | "estagio" | "literal" | "digitado";

/**
 * Classificação do trecho do template (D5). `campo` é preenchido, `fixo` é
 * texto que entra no documento final e `instrucao` é texto de preenchimento que
 * o gerador futuro descarta.
 */
export type ClassificacaoTrecho = "campo" | "fixo" | "instrucao";

/**
 * Regras reaproveitadas pelos formulários dirigidos pelo descritor (D7). Cada
 * nome aponta para um esquema Zod de `lib/domain/schemas`, o mesmo que o
 * backend vai importar.
 */
export type RegraValidacao =
  | "cpf"
  | "rg"
  | "email"
  | "telefone"
  | "celular"
  | "cep"
  | "data"
  | "hora"
  | "intervalo_datas"
  | "numero"
  | "limite_palavras";

export type TipoCampoDescriptor =
  | "texto"
  | "textarea"
  | "numero"
  | "data"
  | "hora"
  | "select"
  | "radio"
  | "checkbox"
  | "arquivo"
  | "assinatura"
  | "grade"
  | "auto"
  | "fixo"
  | "instrucao";

/** Metadados de preenchimento do documento, na forma que o catálogo consome. */
export interface MetadadosDescritor {
  /** Quem pode abrir o formulário de preenchimento. */
  papeisPreenchimento: Papel[];
  /** Fila que analisa o parecer deste documento. */
  tipoParecer: TipoParecer;
  /** O preenchimento depende de um estágio selecionado. */
  exigeEstagio: boolean;
  /** Papéis que podem assinar o documento gerado. */
  assinaturas: AssinaturaTemplate[];
  /** Arquivo do Kit de Estágio de onde o descritor foi escrito. */
  arquivoOrigem?: string;
  /** Pendência do arquivo original, quando houver. */
  observacao?: string;
}

export interface OpcaoDescriptor {
  valor: string;
  rotulo: string;
  /** Marcado quando a opção exige justificativa ou anexos. */
  exigeAnexo?: boolean;
}

export interface ColunaGrade {
  chave: string;
  rotulo: string;
  tipo: "texto" | "data" | "hora" | "numero";
  /** Máscara de `lib/mask` aplicada enquanto o aluno digita. */
  mascara?: NomeMascara;
  /** Campo calculado pelo sistema a partir das demais colunas da linha. */
  automatica?: boolean;
  largura?: string;
}

export interface CampoDescriptor {
  id: string;
  rotulo: string;
  tipo: TipoCampoDescriptor;
  /** Origem do valor; `aluno` e `estagio` são preenchidos em modo somente leitura. */
  origem: OrigemCampo;
  obrigatorio?: boolean;
  /** Máscara de `lib/mask` aplicada enquanto o usuário digita. */
  mascara?: NomeMascara;
  /** Esquemas Zod reaproveitados na validação do campo. */
  validacao?: RegraValidacao[];
  opcoes?: OpcaoDescriptor[];
  /** Limite de palavras impresso no documento do Kit. */
  maximoPalavras?: number;
  maximoCaracteres?: number;
  minimo?: number;
  maximo?: number;
  min?: number;
  max?: number;
  passo?: number;
  linhas?: number;
  ajuda?: string;
  largura?: "completa" | "meia" | "terco" | "quarto";
  colunas?: ColunaGrade[];
  maximoLinhas?: number;
  totalAutomatico?: boolean;
  /** Valor vem do estágio selecionado e não pode ser editado. */
  somenteLeitura?: boolean;
}

export interface SecaoDescriptor {
  id: string;
  titulo: string;
  descricao?: string;
  campos: CampoDescriptor[];
}

export interface DescriptorDocumento {
  templateId: string;
  titulo: string;
  descricao: string;
  preenchivel: boolean;
  /** Quem preenche, fila de parecer e assinaturas; presente quando preenchível. */
  metadados?: MetadadosDescritor;
  /** Campos preenchidos automaticamente a partir do estágio e do cadastro. */
  auto?: CampoDescriptor[];
  secoes: SecaoDescriptor[];
  observacao?: string;
}

/**
 * Convênio e Termo de Compromisso chegaram ao Kit como `.doc` legado e foram
 * convertidos para `.docx` fora do sistema (15.1); o descritor passa a apontar
 * para o `.docx`, que é a versão vigente no catálogo de templates.
 */
export const OBSERVACAO_CONVERSAO =
  "O original em .doc foi convertido para .docx fora do sistema e a versão .docx é a vigente no catálogo.";

/** Tipos de campo que não são preenchidos: texto fixo e instruções do template. */
const TRECHOS_NAO_PREENCHIVEIS = ["fixo", "instrucao"] as const;

/**
 * Classificação do trecho do documento. Só `campo` chega ao formulário; `fixo` e
 * `instrucao` são trechos do template, não valores.
 */
export function classificacaoDoCampo(campo: CampoDescriptor): ClassificacaoTrecho {
  if (campo.tipo === "instrucao") return "instrucao";
  if (campo.tipo === "fixo") return "fixo";

  return "campo";
}

/** Trechos de texto que o formulário não edita, na ordem do documento. */
export function trechosNaoPreenchiveis(templateId: string): CampoDescriptor[] {
  return camposDoTemplate(templateId).filter((campo) =>
    (TRECHOS_NAO_PREENCHIVEIS as readonly string[]).includes(campo.tipo),
  );
}

const IDENTIFICACAO_ALUNO: CampoDescriptor[] = [
  {
    id: "nomeCompleto",
    rotulo: "Nome do aluno(a)",
    tipo: "texto",
    origem: "aluno",
    obrigatorio: true,
    somenteLeitura: true,
  },
  {
    id: "rg",
    rotulo: "RG",
    tipo: "texto",
    origem: "aluno",
    mascara: "rg",
    validacao: ["rg"],
    somenteLeitura: true,
  },
  {
    id: "cpf",
    rotulo: "CPF",
    tipo: "texto",
    origem: "aluno",
    mascara: "cpf",
    validacao: ["cpf"],
    somenteLeitura: true,
  },
  {
    id: "dataNascimento",
    rotulo: "Data de nascimento",
    tipo: "data",
    origem: "aluno",
    mascara: "data",
    validacao: ["data"],
    somenteLeitura: true,
  },
  {
    id: "telefone",
    rotulo: "Telefone",
    tipo: "texto",
    origem: "aluno",
    mascara: "telefone",
    validacao: ["telefone"],
    somenteLeitura: true,
    largura: "meia",
  },
  {
    id: "celular",
    rotulo: "Celular",
    tipo: "texto",
    origem: "aluno",
    mascara: "celular",
    validacao: ["celular"],
    somenteLeitura: true,
    largura: "meia",
  },
  {
    id: "email",
    rotulo: "E-mail",
    tipo: "texto",
    origem: "aluno",
    validacao: ["email"],
    somenteLeitura: true,
  },
  {
    id: "endereco",
    rotulo: "Endereço",
    tipo: "texto",
    origem: "aluno",
    somenteLeitura: true,
    ajuda: "Endereço do cadastro do aluno.",
  },
];

const IDENTIFICACAO_ESTAGIO: CampoDescriptor[] = [
  {
    id: "instituicao",
    rotulo: "Local de estágio (escola/empresa)",
    tipo: "texto",
    origem: "estagio",
    obrigatorio: true,
    somenteLeitura: true,
  },
  {
    id: "supervisor",
    rotulo: "Supervisor(a) de estágio",
    tipo: "texto",
    origem: "estagio",
    obrigatorio: true,
    somenteLeitura: true,
  },
  {
    id: "orientador",
    rotulo: "Professor(a) orientador(a) de estágio",
    tipo: "texto",
    origem: "estagio",
    obrigatorio: true,
    somenteLeitura: true,
  },
  {
    id: "dataInicio",
    rotulo: "Início do estágio",
    tipo: "data",
    origem: "estagio",
    mascara: "data",
    validacao: ["data"],
    somenteLeitura: true,
    largura: "meia",
  },
  {
    id: "dataFim",
    rotulo: "Término do estágio",
    tipo: "data",
    origem: "estagio",
    mascara: "data",
    validacao: ["data"],
    somenteLeitura: true,
    largura: "meia",
  },
  {
    id: "curso",
    rotulo: "Curso",
    tipo: "texto",
    origem: "aluno",
    somenteLeitura: true,
    largura: "meia",
  },
  {
    id: "turma",
    rotulo: "Turma",
    tipo: "texto",
    origem: "aluno",
    somenteLeitura: true,
    largura: "meia",
  },
  {
    id: "anoSemestre",
    rotulo: "Ano/semestre",
    tipo: "texto",
    origem: "aluno",
    somenteLeitura: true,
    largura: "meia",
  },
];

/** Nome do aluno no formato dos documentos que não trazem identificação completa. */
const ALUNO_ESTAGIARIO: CampoDescriptor = {
  id: "aluno",
  rotulo: "Aluno(a) estagiário(a)",
  tipo: "texto",
  origem: "aluno",
  somenteLeitura: true,
};

const DATA_NASCIMENTO_ALUNO: CampoDescriptor = {
  id: "dataNascimento",
  rotulo: "Data de nascimento",
  tipo: "data",
  origem: "aluno",
  mascara: "data",
  validacao: ["data"],
  somenteLeitura: true,
};

const ASSINATURAS: CampoDescriptor[] = [
  {
    id: "assinaturaAluno",
    rotulo: "Assinatura do(a) aluno(a)",
    tipo: "assinatura",
    origem: "digitado",
  },
  {
    id: "assinaturaSupervisor",
    rotulo: "Assinatura do(a) supervisor(a)",
    tipo: "assinatura",
    origem: "digitado",
  },
];

const TEMPO_NA_ATIVIDADE = [
  { valor: "estagio", rotulo: "Estágio" },
  { valor: "projeto_monitoria_pratica", rotulo: "Projeto/Monitoria/Prática profissional" },
];

const RESPOSTAS_SIM_NAO = [
  { valor: "sim", rotulo: "Sim" },
  { valor: "nao", rotulo: "Não" },
];

/**
 * Fatores da autoavaliação do Relatório Semestral, com a definição impressa ao
 * lado de cada um na tabela do formulário 09.
 */
const FATORES_RELATORIO = [
  [
    "Facilidade de Compreensão",
    "Rapidez e facilidade de interpretar, pôr em prática ou entender as informações verbais ou escritas.",
  ],
  [
    "Nível de Conhecimento Teórico",
    "Conhecimento demonstrado no cumprimento do estágio, tendo em vista a sua escolaridade.",
  ],
  [
    "Organização e Método no Trabalho",
    "Uso de meios racionais visando melhorar a organização para a adequada realização do trabalho.",
  ],
  [
    "Iniciativa, Criatividade e Independência",
    "Capacidade de procurar novas soluções dentro dos padrões adequados.",
  ],
  [
    "Cooperação",
    "Atuação junto a outras pessoas no sentido de contribuir para o alcance de um objetivo comum.",
  ],
  [
    "Interesse",
    "Envolvimento natural para o desenvolvimento das tarefas e conhecimento da empresa.",
  ],
  ["Assiduidade", "Comparecimento nos dias exigidos, cumprindo o número de horas/dia."],
  [
    "Pontualidade",
    "Comparecimento na hora determinada para o início dos trabalhos e saída no horário estabelecido.",
  ],
  ["Responsabilidade", "Cumprimento das atribuições e deveres decorrentes do estágio."],
  [
    "Sociabilidade e Desembaraço",
    "Facilidade e espontaneidade com que age com relação às pessoas, fatos e situações.",
  ],
  [
    "Postura Profissional e Comprometimento nas tarefas",
    "Atitude adequada no desempenho das atividades na empresa.",
  ],
] as const;

const CRITERIOS_FICHA_FREQUENCIA = [
  "Assiduidade",
  "Pontualidade",
  "Sociabilidade",
  "Ética Profissional",
  "Cuidados Pessoais",
  "Produtividade",
  "Maturidade Profissional",
  "Flexibilidade",
  "Raciocínio Lógico e Objetivo",
  "Criatividade",
  "Habilidade na Aplicação da Tecnologia",
  "Iniciativa",
  "Aplicação das Normas de Segurança",
];

const FAIXAS_AVALIACAO = [
  { valor: "E", rotulo: "E — Excelente (10,0 a 9,0)" },
  { valor: "B", rotulo: "B — Bom (8,9 a 7,0)" },
  { valor: "R", rotulo: "R — Regular (6,9 a 5,0)" },
  { valor: "I", rotulo: "I — Insuficiente (4,9 a 0,0)" },
];

const COMPROVANTES_APROVEITAMENTO = [
  "Cópia da Carteira de Trabalho (frente e verso da folha de identificação e da folha do contrato)",
  "Declaração do(a) Supervisor(a) informando a realização da iniciação científica, monitoria ou atividade de extensão",
  "Programa de Atividades Desenvolvidas assinado e carimbado pelo(a) supervisor(a)",
  "Ficha de Avaliação e Frequência do estagiário assinada e carimbada pelo(a) supervisor(a)",
  "Formulário para escolha do professor(a) orientador(a)",
];

const PESAGEM_AVALIACAO = FATORES_RELATORIO.map(([fator, definicao], indice) => ({
  id: `autoavaliacao_${indice + 1}`,
  rotulo: fator,
  tipo: "radio" as const,
  origem: "digitado" as const,
  ajuda: definicao,
  opcoes: [
    { valor: "otimo", rotulo: "Ótimo" },
    { valor: "bom", rotulo: "Bom" },
    { valor: "regular", rotulo: "Regular" },
    { valor: "insuficiente", rotulo: "Insuficiente" },
  ],
}));

const PESAGEM_FREQUENCIA = CRITERIOS_FICHA_FREQUENCIA.map((criterio, indice) => ({
  id: `criterio_${indice + 1}`,
  rotulo: criterio,
  tipo: "numero" as const,
  origem: "digitado" as const,
  min: 0,
  max: 10,
  passo: 0.1,
  largura: "meia" as const,
  validacao: ["numero"] as RegraValidacao[],
  ajuda: "Conceito de 0,0 a 10,0. Ver faixas de avaliação.",
}));

export const DESCRITORES: DescriptorDocumento[] = [
  {
    templateId: "tpl-lei-estagio",
    titulo: "Lei de Estágio",
    descricao: "Lei nº 11.788/2008, para consulta e download.",
    preenchivel: false,
    secoes: [],
  },
  {
    templateId: "tpl-regulamento-licenciatura",
    titulo: "Regulamento de Estágio dos Cursos de Licenciatura",
    descricao: "Regulamento que define carga horária, jornada e aproveitamento de horas.",
    preenchivel: false,
    secoes: [],
  },
  {
    templateId: "tpl-formulario-liberacao",
    titulo: "Formulário de Liberação para Estágio Curricular Supervisionado",
    descricao:
      "Encaminhado ao Coordenador(a) do Curso para avaliação antes do início do estágio; a COIEE recebe o termo de compromisso, este formulário e o programa de estágio.",
    preenchivel: true,
    metadados: {
      papeisPreenchimento: ["aluno"],
      tipoParecer: "coordenador_curso",
      exigeEstagio: true,
      assinaturas: [
        { papel: "coordenador_curso", rotulo: "Coordenador(a) de Área/Curso", tipo: "interna" },
        { papel: "aluno", rotulo: "Aluno(a)", tipo: "interna" },
      ],
      arquivoOrigem: "Contexto/kit-estagio/04 - Formulario de Liberacao Licenciatura.docx",
    },
    auto: [...IDENTIFICACAO_ALUNO.slice(0, 3), ...IDENTIFICACAO_ESTAGIO],
    secoes: [
      {
        id: "identificacao",
        titulo: "Identificação",
        campos: [
          {
            id: "instrucaoEntrega",
            rotulo: "Orientações de entrega",
            tipo: "instrucao",
            origem: "literal",
            ajuda:
              "Este formulário e o programa de estágio deverão ser entregues ao(a) Coordenador(a) do Curso para serem avaliados. A COIEE só receberá as vias do termo de compromisso, este formulário e o programa de estágio, após os dois últimos terem sido aprovados pelo Coordenador de Curso.",
          },
          {
            id: "turmaSemestreAno",
            rotulo: "Turma/semestre/ano",
            tipo: "texto",
            origem: "aluno",
            obrigatorio: true,
            somenteLeitura: true,
          },
          {
            id: "enderecoAluno",
            rotulo: "Endereço do aluno",
            tipo: "texto",
            origem: "digitado",
            obrigatorio: true,
          },
          {
            id: "cepAluno",
            rotulo: "CEP",
            tipo: "texto",
            origem: "digitado",
            mascara: "cep",
            validacao: ["cep"],
            obrigatorio: true,
            largura: "meia",
          },
          {
            id: "telefoneAluno",
            rotulo: "Telefone",
            tipo: "texto",
            origem: "digitado",
            mascara: "telefone",
            validacao: ["telefone"],
            obrigatorio: true,
            largura: "meia",
          },
          {
            id: "celularAluno",
            rotulo: "Celular",
            tipo: "texto",
            origem: "digitado",
            mascara: "celular",
            validacao: ["celular"],
            obrigatorio: true,
            largura: "meia",
          },
          {
            id: "emailAluno",
            rotulo: "E-mail",
            tipo: "texto",
            origem: "digitado",
            validacao: ["email"],
            obrigatorio: true,
            largura: "meia",
          },
        ],
      },
      {
        id: "local",
        titulo: "Local de estágio",
        campos: [
          {
            id: "localEstagio",
            rotulo: "Escola/empresa",
            tipo: "texto",
            origem: "estagio",
            obrigatorio: true,
            somenteLeitura: true,
          },
          {
            id: "enderecoLocal",
            rotulo: "Endereço",
            tipo: "texto",
            origem: "digitado",
            obrigatorio: true,
          },
          {
            id: "telefoneSupervisor",
            rotulo: "Telefone do(a) supervisor(a)",
            tipo: "texto",
            origem: "digitado",
            mascara: "telefone",
            validacao: ["telefone"],
            obrigatorio: true,
          },
        ],
      },
      {
        id: "atribuicoes",
        titulo: "Atribuições do(a) professor(a) orientador(a)",
        descricao: "Texto informativo do formulário; o aluno não altera este bloco.",
        campos: [
          {
            id: "atribuicoesOrientador",
            rotulo: "Atribuições",
            tipo: "fixo",
            origem: "literal",
            linhas: 5,
            ajuda:
              "Orientar o aluno-estagiário quanto às normas de conduta no estágio; esclarecer dúvidas relativas às atividades exercidas no estágio; orientar o aluno no que diz respeito à correta interpretação das Normas para Elaboração do Relatório Técnico de Estágio; auxiliar na elaboração, avaliar e assinar a versão final do Relatório de Estágio, bem como orientar sobre as normas de conduta e de linguagem a serem observadas durante a exposição oral do Seminário de Estágio; compor, caso julgue necessário, a banca examinadora do Seminário de Estágio, arguindo e avaliando o aluno.",
          },
        ],
      },
      {
        id: "parecer",
        titulo: "Parecer da coordenação de curso",
        descricao: "Bloco preenchido pelo(a) coordenador(a) de área/curso.",
        campos: [
          {
            id: "planoDeAcordo",
            rotulo: "O Programa de Estágio está de acordo com o Plano do Curso?",
            tipo: "radio",
            origem: "digitado",
            obrigatorio: true,
            opcoes: RESPOSTAS_SIM_NAO,
          },
          {
            id: "consideracoes",
            rotulo: "Considerações",
            tipo: "textarea",
            origem: "digitado",
            linhas: 3,
          },
          {
            id: "dataParecer",
            rotulo: "Data do parecer",
            tipo: "data",
            origem: "digitado",
            mascara: "data",
            validacao: ["data"],
            obrigatorio: true,
            largura: "meia",
          },
        ],
      },
    ],
  },
  {
    templateId: "tpl-plano-atividades",
    titulo: "Plano de Atividades de Estágio",
    descricao:
      "Atividades que o estagiário desenvolverá durante o período, assinadas pelo(a) supervisor(a).",
    preenchivel: true,
    metadados: {
      papeisPreenchimento: ["aluno"],
      tipoParecer: "coordenador_curso",
      exigeEstagio: true,
      assinaturas: [
        { papel: "aluno", rotulo: "Aluno(a)", tipo: "interna" },
        { papel: "externo", rotulo: "Supervisor(a) de Estágio", tipo: "externa" },
      ],
      arquivoOrigem: "Contexto/kit-estagio/05 - Plano de atividades de estágio.docx",
    },
    auto: [
      ...IDENTIFICACAO_ALUNO.slice(0, 1),
      DATA_NASCIMENTO_ALUNO,
      ...IDENTIFICACAO_ESTAGIO.slice(0, 1),
    ],
    secoes: [
      {
        id: "identificacao",
        titulo: "Identificação",
        campos: [
          {
            id: "tipoAtividade",
            rotulo: "Tipo de atividade",
            tipo: "radio",
            origem: "digitado",
            obrigatorio: true,
            opcoes: TEMPO_NA_ATIVIDADE,
          },
          {
            id: "curso",
            rotulo: "Curso",
            tipo: "texto",
            origem: "aluno",
            obrigatorio: true,
            somenteLeitura: true,
          },
          {
            id: "rg",
            rotulo: "RG",
            tipo: "texto",
            origem: "aluno",
            mascara: "rg",
            validacao: ["rg"],
            somenteLeitura: true,
            largura: "meia",
          },
          {
            id: "cpf",
            rotulo: "CPF",
            tipo: "texto",
            origem: "aluno",
            mascara: "cpf",
            validacao: ["cpf"],
            somenteLeitura: true,
            largura: "meia",
          },
          {
            id: "dataInicioPrevista",
            rotulo: "Data prevista de início",
            tipo: "data",
            origem: "digitado",
            mascara: "data",
            validacao: ["data", "intervalo_datas"],
            obrigatorio: true,
            largura: "meia",
          },
          {
            id: "dataFimPrevista",
            rotulo: "Data prevista de término",
            tipo: "data",
            origem: "digitado",
            mascara: "data",
            validacao: ["data", "intervalo_datas"],
            obrigatorio: true,
            largura: "meia",
          },
          {
            id: "supervisor",
            rotulo: "Supervisor(a) de estágio",
            tipo: "texto",
            origem: "estagio",
            obrigatorio: true,
            somenteLeitura: true,
          },
          {
            id: "orientador",
            rotulo: "Professor(a) orientador(a) de estágio",
            tipo: "texto",
            origem: "estagio",
            obrigatorio: true,
            somenteLeitura: true,
          },
        ],
      },
      {
        id: "atividades",
        titulo: "Atividades a desenvolver",
        campos: [
          {
            id: "atividades",
            rotulo: "Atividades",
            tipo: "textarea",
            origem: "digitado",
            obrigatorio: true,
            linhas: 8,
            ajuda: "Descreva as atividades que serão desenvolvidas durante o estágio.",
          },
        ],
      },
      { id: "assinaturas", titulo: "Assinaturas", campos: ASSINATURAS },
    ],
  },
  {
    templateId: "tpl-convenio-estagio",
    titulo: "Convênio de Estágio",
    descricao:
      "Convênio entre o IFRJ e a instituição concedente, com vigência de 5 anos a partir da assinatura.",
    preenchivel: true,
    metadados: {
      papeisPreenchimento: ["coordenador_estagio"],
      tipoParecer: "externo",
      exigeEstagio: false,
      assinaturas: [
        { papel: "coordenador_estagio", rotulo: "Coordenador(a) de Estágio", tipo: "interna" },
        { papel: "externo", rotulo: "Representante da instituição", tipo: "externa" },
      ],
      arquivoOrigem: "Contexto/kit-estagio/03 - Convenio de estagio - Campus Pinheiral.docx",
      observacao: OBSERVACAO_CONVERSAO,
    },
    observacao:
      "O layout segue o .docx convertido do arquivo 03 e a instituição concedente é livre; o sistema atende somente o Campus Pinheiral, sem escolha de campus no cadastro (15.4).",
    secoes: [
      {
        id: "instituicao",
        titulo: "Instituição concedente",
        campos: [
          {
            id: "razaoSocial",
            rotulo: "Razão social",
            tipo: "texto",
            origem: "digitado",
            obrigatorio: true,
          },
          {
            id: "nomeFantasia",
            rotulo: "Nome fantasia",
            tipo: "texto",
            origem: "digitado",
          },
          {
            id: "cnpj",
            rotulo: "CNPJ",
            tipo: "texto",
            origem: "digitado",
            obrigatorio: true,
            maximoCaracteres: 18,
          },
          {
            id: "endereco",
            rotulo: "Endereço",
            tipo: "texto",
            origem: "digitado",
            obrigatorio: true,
          },
          { id: "bairro", rotulo: "Bairro", tipo: "texto", origem: "digitado", largura: "meia" },
          { id: "cidade", rotulo: "Cidade", tipo: "texto", origem: "digitado", largura: "meia" },
          { id: "uf", rotulo: "UF", tipo: "texto", origem: "digitado", largura: "quarto" },
          {
            id: "cep",
            rotulo: "CEP",
            tipo: "texto",
            origem: "digitado",
            mascara: "cep",
            validacao: ["cep"],
            largura: "quarto",
          },
          {
            id: "telefone",
            rotulo: "Telefone",
            tipo: "texto",
            origem: "digitado",
            mascara: "telefone",
            validacao: ["telefone"],
            largura: "meia",
          },
          {
            id: "email",
            rotulo: "E-mail",
            tipo: "texto",
            origem: "digitado",
            validacao: ["email"],
            largura: "meia",
          },
          {
            id: "ramal",
            rotulo: "Ramal",
            tipo: "texto",
            origem: "digitado",
            largura: "meia",
          },
          {
            id: "fax",
            rotulo: "Fax",
            tipo: "texto",
            origem: "digitado",
            mascara: "telefone",
            validacao: ["telefone"],
            largura: "meia",
          },
          {
            id: "ramoAtividade",
            rotulo: "Ramo de atividade",
            tipo: "texto",
            origem: "digitado",
            largura: "meia",
          },
          {
            id: "identidade",
            rotulo: "Identidade",
            tipo: "texto",
            origem: "digitado",
            largura: "meia",
          },
          {
            id: "cic",
            rotulo: "CIC",
            tipo: "texto",
            origem: "digitado",
            largura: "meia",
          },
          {
            id: "cargo",
            rotulo: "Cargo",
            tipo: "texto",
            origem: "digitado",
            largura: "meia",
          },
          {
            id: "responsavel",
            rotulo: "Responsável legal",
            tipo: "texto",
            origem: "digitado",
            obrigatorio: true,
          },
        ],
      },
      {
        id: "clausulas",
        titulo: "Cláusulas do convênio",
        descricao: "Texto do instrumento; não é preenchido pelo usuário.",
        campos: [
          {
            id: "clausulas",
            rotulo: "Cláusulas",
            tipo: "fixo",
            origem: "literal",
            ajuda:
              "DO OBJETO · DO PRAZO · DO RECRUTAMENTO · DA BOLSA · DA JORNADA DO ESTÁGIO · DA LIBERAÇÃO · DA SUPERVISÃO · DA VINCULAÇÃO · DO SEGURO · DO TERMO DE COMPROMISSO · DO FORO",
          },
        ],
      },
      {
        id: "vigencia",
        titulo: "Vigência",
        descricao: "O convênio vale por 5 anos, conforme regra do Kit de Estágio.",
        campos: [
          {
            id: "inicioVigencia",
            rotulo: "Início da vigência",
            tipo: "data",
            origem: "digitado",
            mascara: "data",
            validacao: ["data", "intervalo_datas"],
            obrigatorio: true,
            largura: "meia",
          },
          {
            id: "fimVigencia",
            rotulo: "Fim da vigência",
            tipo: "data",
            origem: "digitado",
            mascara: "data",
            validacao: ["data", "intervalo_datas"],
            obrigatorio: true,
            largura: "meia",
            ajuda: "Calculado como início + 5 anos.",
          },
          {
            id: "renovacoes",
            rotulo: "Renovações",
            tipo: "numero",
            origem: "digitado",
            validacao: ["numero"],
            min: 0,
            max: 10,
            largura: "meia",
          },
        ],
      },
      {
        id: "assinaturas",
        titulo: "Assinaturas",
        campos: [
          {
            id: "assinaturaCoordenador",
            rotulo: "Coordenador(a) de Estágio",
            tipo: "assinatura",
            origem: "digitado",
          },
          {
            id: "assinaturaInstituicao",
            rotulo: "Representante da instituição",
            tipo: "assinatura",
            origem: "digitado",
          },
          {
            id: "testemunha1",
            rotulo: "Testemunha 1",
            tipo: "assinatura",
            origem: "digitado",
          },
          {
            id: "testemunha2",
            rotulo: "Testemunha 2",
            tipo: "assinatura",
            origem: "digitado",
          },
        ],
      },
    ],
  },
  {
    templateId: "tpl-termo-compromisso",
    titulo: "Termo de Compromisso",
    descricao:
      "Compromisso do estagiário, da instituição concedente e do IFRJ para a realização do estágio.",
    preenchivel: true,
    metadados: {
      papeisPreenchimento: ["aluno"],
      tipoParecer: "externo",
      exigeEstagio: true,
      assinaturas: [
        { papel: "aluno", rotulo: "Estagiário(a)", tipo: "interna" },
        { papel: "externo", rotulo: "Supervisor(a) de Estágio", tipo: "externa" },
        { papel: "orientador", rotulo: "Professor(a) Orientador(a)", tipo: "interna" },
      ],
      arquivoOrigem: "Contexto/kit-estagio/06 - Termo de compromisso. Licenciatura.docx",
      observacao: OBSERVACAO_CONVERSAO,
    },
    observacao:
      "O layout segue o .docx convertido do arquivo 06. O instrumento é preenchido em 3 vias e prevê duas testemunhas.",
    auto: [
      ...IDENTIFICACAO_ALUNO.slice(0, 1),
      DATA_NASCIMENTO_ALUNO,
      {
        id: "cpf",
        rotulo: "CPF",
        tipo: "texto",
        origem: "aluno",
        mascara: "cpf",
        validacao: ["cpf"],
        somenteLeitura: true,
      },
      {
        id: "matricula",
        rotulo: "Matrícula",
        tipo: "texto",
        origem: "aluno",
        somenteLeitura: true,
        largura: "meia",
      },
      ...IDENTIFICACAO_ESTAGIO.filter((campo) =>
        ["instituicao", "supervisor", "orientador", "curso"].includes(campo.id),
      ),
    ],
    secoes: [
      {
        id: "concedente",
        titulo: "Concedente",
        campos: [
          {
            id: "cnpj",
            rotulo: "CNPJ da instituição",
            tipo: "texto",
            origem: "digitado",
            obrigatorio: true,
            maximoCaracteres: 18,
            largura: "meia",
          },
          {
            id: "responsavel",
            rotulo: "Representada por",
            tipo: "texto",
            origem: "digitado",
            obrigatorio: true,
          },
          {
            id: "nomeDiretor",
            rotulo: "Nome do diretor",
            tipo: "texto",
            origem: "digitado",
            obrigatorio: true,
            largura: "meia",
          },
          {
            id: "endereco",
            rotulo: "Endereço",
            tipo: "texto",
            origem: "digitado",
            obrigatorio: true,
          },
          { id: "bairro", rotulo: "Bairro", tipo: "texto", origem: "digitado", largura: "meia" },
          { id: "cidade", rotulo: "Cidade", tipo: "texto", origem: "digitado", largura: "meia" },
          {
            id: "cep",
            rotulo: "CEP",
            tipo: "texto",
            origem: "digitado",
            mascara: "cep",
            validacao: ["cep"],
            largura: "quarto",
          },
          {
            id: "telefone",
            rotulo: "Telefone",
            tipo: "texto",
            origem: "digitado",
            mascara: "telefone",
            validacao: ["telefone"],
            largura: "meia",
          },
          {
            id: "celular",
            rotulo: "Celular",
            tipo: "texto",
            origem: "digitado",
            mascara: "celular",
            validacao: ["celular"],
            largura: "meia",
          },
          {
            id: "fax",
            rotulo: "Fax",
            tipo: "texto",
            origem: "digitado",
            mascara: "telefone",
            validacao: ["telefone"],
            largura: "meia",
          },
          {
            id: "email",
            rotulo: "E-mail",
            tipo: "texto",
            origem: "digitado",
            validacao: ["email"],
            largura: "meia",
          },
        ],
      },
      {
        id: "seguro",
        titulo: "Seguro de acidentes pessoais",
        campos: [
          {
            id: "seguradora",
            rotulo: "Seguradora",
            tipo: "texto",
            origem: "digitado",
            obrigatorio: true,
          },
          {
            id: "numeroApolice",
            rotulo: "Número da apólice",
            tipo: "texto",
            origem: "digitado",
            obrigatorio: true,
            largura: "meia",
          },
        ],
      },
      {
        id: "vigencia",
        titulo: "Vigência do estágio",
        campos: [
          {
            id: "cargaHorariaTotal",
            rotulo: "Carga horária total",
            tipo: "numero",
            origem: "digitado",
            mascara: "horas",
            validacao: ["numero"],
            obrigatorio: true,
            min: 1,
            max: 4000,
            largura: "meia",
          },
          {
            id: "cargaHorariaSemanal",
            rotulo: "Carga horária semanal",
            tipo: "numero",
            origem: "digitado",
            mascara: "horas",
            validacao: ["numero"],
            obrigatorio: true,
            min: 1,
            max: 30,
            largura: "meia",
          },
          {
            id: "duracaoMinimaDias",
            rotulo: "Duração mínima (dias)",
            tipo: "numero",
            origem: "literal",
            validacao: ["numero"],
            min: 5,
            max: 5,
            ajuda: "O instrumento fixa 5 (cinco) dias como duração mínima.",
            largura: "meia",
          },
          {
            id: "vias",
            rotulo: "Número de vias",
            tipo: "numero",
            origem: "literal",
            validacao: ["numero"],
            min: 3,
            max: 3,
            ajuda: "O instrumento é preenchido em 3 (três) vias.",
            largura: "meia",
          },
          {
            id: "dataInicio",
            rotulo: "Início",
            tipo: "data",
            origem: "estagio",
            mascara: "data",
            validacao: ["data", "intervalo_datas"],
            obrigatorio: true,
            somenteLeitura: true,
            largura: "meia",
          },
          {
            id: "dataFim",
            rotulo: "Término",
            tipo: "data",
            origem: "estagio",
            mascara: "data",
            validacao: ["data", "intervalo_datas"],
            obrigatorio: true,
            somenteLeitura: true,
            largura: "meia",
          },
          {
            id: "horario",
            rotulo: "Horário do estágio",
            tipo: "texto",
            origem: "digitado",
            obrigatorio: true,
            largura: "meia",
          },
        ],
      },
      {
        id: "assinaturas",
        titulo: "Assinaturas",
        campos: [
          {
            id: "assinaturaAluno",
            rotulo: "Estagiário(a)",
            tipo: "assinatura",
            origem: "digitado",
          },
          {
            id: "assinaturaSupervisor",
            rotulo: "Supervisor(a) de estágio",
            tipo: "assinatura",
            origem: "digitado",
          },
          {
            id: "assinaturaOrientador",
            rotulo: "Professor(a) orientador(a)",
            tipo: "assinatura",
            origem: "digitado",
          },
          {
            id: "testemunha1",
            rotulo: "Testemunha 1",
            tipo: "assinatura",
            origem: "digitado",
          },
          {
            id: "testemunha2",
            rotulo: "Testemunha 2",
            tipo: "assinatura",
            origem: "digitado",
          },
        ],
      },
    ],
  },
  {
    templateId: "tpl-ficha-acompanhamento",
    titulo: "Ficha de Acompanhamento de Estagiário",
    descricao:
      "Grade de 80 linhas com data, entrada, saída, duração e rubrica do aluno. Não aceita rasura; a jornada é de no máximo 6 h por dia, excluído o almoço, e 30 h por semana.",
    preenchivel: true,
    metadados: {
      papeisPreenchimento: ["aluno"],
      tipoParecer: "nenhum",
      exigeEstagio: true,
      assinaturas: [
        { papel: "aluno", rotulo: "Aluno(a) estagiário(a)", tipo: "interna" },
        { papel: "externo", rotulo: "Supervisor(a) do local de estágio", tipo: "externa" },
      ],
      arquivoOrigem: "Contexto/kit-estagio/07 - Ficha de Acompanhamento de Estagio.docx",
    },
    observacao:
      "O formulário 07 do Kit não tem campo de professor orientador; a assinatura do(a) aluno(a) e do(a) supervisor(a) é a única prevista.",
    auto: [ALUNO_ESTAGIARIO, ...IDENTIFICACAO_ESTAGIO.filter((campo) => campo.id !== "orientador")],
    secoes: [
      {
        id: "lancamentos",
        titulo: "Lançamentos",
        campos: [
          {
            id: "instrucaoObs",
            rotulo: "Orientações de preenchimento",
            tipo: "instrucao",
            origem: "literal",
            ajuda:
              "A ficha não deve conter nenhuma rasura. A jornada máxima é de 6 (seis) horas diárias, descontado o intervalo para almoço, e de 30 (trinta) horas semanais.",
          },
          {
            id: "lancamentos",
            rotulo: "Lançamentos",
            tipo: "grade",
            origem: "digitado",
            maximoLinhas: 80,
            totalAutomatico: true,
            ajuda: "Correções preservam o histórico: o valor anterior fica registrado.",
            colunas: [
              { chave: "data", rotulo: "Data", tipo: "data", mascara: "data" },
              { chave: "entrada", rotulo: "Entrada", tipo: "hora", mascara: "hora" },
              { chave: "saida", rotulo: "Saída", tipo: "hora", mascara: "hora" },
              { chave: "duracao", rotulo: "Duração (h)", tipo: "numero", automatica: true },
              { chave: "rubrica", rotulo: "Rubrica do aluno", tipo: "texto" },
            ],
          },
        ],
      },
      { id: "assinaturas", titulo: "Assinaturas", campos: ASSINATURAS },
    ],
  },
  {
    templateId: "tpl-ficha-frequencia",
    titulo: "Ficha Individual de Frequência e Avaliação",
    descricao:
      "Preenchida pelo RH ou pelo chefe imediato, assinada e carimbada pelo supervisor da concedente e remetida à COIEE como “Ficha de Estagiário — Confidencial”.",
    preenchivel: true,
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
      arquivoOrigem: "Contexto/kit-estagio/08 - Ficha de Frequencia e Avaliacao do Estagiário.docx",
    },
    observacao:
      "No Kit, o preenchimento é feito fora do sistema; aqui a COIEE registra os dados e as assinaturas externas ficam pendentes. O rodapé do formulário lista os endereços de todos os campi do IFRJ, mas o sistema exibe e valida apenas o Campus Pinheiral.",
    auto: [
      {
        id: "campus",
        rotulo: "Campus",
        tipo: "texto",
        origem: "literal",
        somenteLeitura: true,
        largura: "meia",
        ajuda: "Pinheiral",
      },
      {
        id: "aluno",
        rotulo: "Nome do aluno",
        tipo: "texto",
        origem: "aluno",
        somenteLeitura: true,
      },
      {
        id: "curso",
        rotulo: "Curso",
        tipo: "texto",
        origem: "aluno",
        somenteLeitura: true,
        largura: "meia",
      },
      {
        id: "turma",
        rotulo: "Turma",
        tipo: "texto",
        origem: "aluno",
        somenteLeitura: true,
        largura: "meia",
      },
      {
        id: "ano",
        rotulo: "Ano",
        tipo: "texto",
        origem: "aluno",
        somenteLeitura: true,
        largura: "meia",
      },
      {
        id: "dataInicio",
        rotulo: "Início do estágio",
        tipo: "data",
        origem: "estagio",
        mascara: "data",
        validacao: ["data"],
        somenteLeitura: true,
        largura: "meia",
      },
      {
        id: "dataFim",
        rotulo: "Término do estágio",
        tipo: "data",
        origem: "estagio",
        mascara: "data",
        validacao: ["data", "intervalo_datas"],
        somenteLeitura: true,
        largura: "meia",
      },
    ],
    secoes: [
      {
        id: "situacaoFuncional",
        titulo: "Situação funcional do estagiário",
        campos: [
          {
            id: "razaoSocial",
            rotulo: "Concedente — razão social",
            tipo: "texto",
            origem: "estagio",
            obrigatorio: true,
            somenteLeitura: true,
          },
          {
            id: "nomeFantasia",
            rotulo: "Nome fantasia",
            tipo: "texto",
            origem: "digitado",
          },
          {
            id: "endereco",
            rotulo: "Endereço",
            tipo: "texto",
            origem: "digitado",
            obrigatorio: true,
          },
          { id: "bairro", rotulo: "Bairro", tipo: "texto", origem: "digitado", largura: "meia" },
          { id: "cidade", rotulo: "Cidade", tipo: "texto", origem: "digitado", largura: "meia" },
          { id: "uf", rotulo: "UF", tipo: "texto", origem: "digitado", largura: "quarto" },
          {
            id: "cep",
            rotulo: "CEP",
            tipo: "texto",
            origem: "digitado",
            mascara: "cep",
            validacao: ["cep"],
            largura: "quarto",
          },
          { id: "site", rotulo: "Site", tipo: "texto", origem: "digitado", largura: "meia" },
          {
            id: "telefone",
            rotulo: "Telefone",
            tipo: "texto",
            origem: "digitado",
            mascara: "telefone",
            validacao: ["telefone"],
            largura: "meia",
          },
          { id: "ramal", rotulo: "Ramal", tipo: "texto", origem: "digitado", largura: "meia" },
          {
            id: "fax",
            rotulo: "Fax",
            tipo: "texto",
            origem: "digitado",
            mascara: "telefone",
            validacao: ["telefone"],
            largura: "meia",
          },
          {
            id: "email",
            rotulo: "E-mail",
            tipo: "texto",
            origem: "digitado",
            validacao: ["email"],
          },
          {
            id: "areaAtuacao",
            rotulo: "Área de atuação do estágio",
            tipo: "texto",
            origem: "digitado",
            obrigatorio: true,
          },
          {
            id: "setor",
            rotulo: "Setor",
            tipo: "texto",
            origem: "digitado",
            obrigatorio: true,
          },
          {
            id: "responsavel",
            rotulo: "Responsável",
            tipo: "texto",
            origem: "digitado",
            obrigatorio: true,
          },
          {
            id: "cargaHorariaSemanal",
            rotulo: "Carga horária semanal",
            tipo: "numero",
            origem: "digitado",
            mascara: "horas",
            validacao: ["numero"],
            min: 1,
            max: 30,
            largura: "meia",
          },
          {
            id: "horario",
            rotulo: "Horário do estágio",
            tipo: "texto",
            origem: "digitado",
            largura: "meia",
          },
          { id: "bolsa", rotulo: "Bolsa de trabalho", tipo: "texto", origem: "digitado" },
          { id: "beneficios", rotulo: "Benefícios concedidos", tipo: "texto", origem: "digitado" },
        ],
      },
      {
        id: "frequencia",
        titulo: "Controle de frequência",
        campos: [
          {
            id: "instrucaoPreenchimento",
            rotulo: "Orientações de preenchimento",
            tipo: "instrucao",
            origem: "literal",
            ajuda:
              "1. Esta ficha somente poderá ser preenchida pelo Setor de Recursos Humanos ou pelo chefe imediato a quem o estagiário/empregado estiver subordinado. 2. A ficha deverá ser assinada e carimbada pelo Supervisor da Concedente. 3. Esta ficha, após ser preenchida, assinada e carimbada, deverá ser remetida à Coordenação de Integração Escola-Empresa (COIEE) do Campus de origem do IFRJ, com a menção: Ficha de Estagiário — Confidencial.",
          },
          {
            id: "observacoes",
            rotulo: "Observações importantes",
            tipo: "textarea",
            origem: "digitado",
            linhas: 3,
          },
          {
            id: "meses",
            rotulo: "Meses",
            tipo: "grade",
            origem: "digitado",
            validacao: ["numero"],
            maximoLinhas: 12,
            totalAutomatico: true,
            colunas: [
              { chave: "ano", rotulo: "Ano", tipo: "numero" },
              { chave: "mes", rotulo: "Mês", tipo: "texto" },
              { chave: "diasUteis", rotulo: "Dias úteis", tipo: "numero" },
              { chave: "diasTrabalhados", rotulo: "Dias trabalhados", tipo: "numero" },
              { chave: "horasTrabalhadas", rotulo: "Horas trabalhadas", tipo: "numero" },
            ],
          },
        ],
      },
      {
        id: "avaliacao",
        titulo: "Avaliação conceitual do estagiário",
        descricao: "Conceito de 0,0 a 10,0 por critério.",
        campos: [
          ...PESAGEM_FREQUENCIA,
          {
            id: "faixas",
            rotulo: "Faixas de avaliação",
            tipo: "fixo",
            origem: "literal",
            ajuda: FAIXAS_AVALIACAO.map((f) => f.rotulo).join(" · "),
          },
        ],
      },
      {
        id: "conceitoGlobal",
        titulo: "Conceito global e observações",
        campos: [
          {
            id: "conceitoGlobal",
            rotulo: "Conceito global",
            tipo: "numero",
            origem: "digitado",
            validacao: ["numero"],
            min: 0,
            max: 10,
            passo: 0.1,
            largura: "meia",
          },
          {
            id: "observacoesFinais",
            rotulo: "Observações",
            tipo: "textarea",
            origem: "digitado",
            linhas: 3,
          },
          {
            id: "nomeSupervisor",
            rotulo: "Nome do(a) supervisor(a) da concedente",
            tipo: "texto",
            origem: "digitado",
            obrigatorio: true,
          },
          {
            id: "dataFicha",
            rotulo: "Data",
            tipo: "data",
            origem: "digitado",
            mascara: "data",
            validacao: ["data"],
            largura: "meia",
          },
          { id: "cargo", rotulo: "Cargo ou função", tipo: "texto", origem: "digitado" },
        ],
      },
      {
        id: "usoIfrj",
        titulo: "Para uso do IFRJ",
        campos: [
          {
            id: "secretaria",
            rotulo: "Secretaria de Ensino de Graduação",
            tipo: "texto",
            origem: "digitado",
            largura: "meia",
          },
          {
            id: "diplomadoEm",
            rotulo: "Diplomado em",
            tipo: "data",
            origem: "digitado",
            mascara: "data",
            validacao: ["data"],
            largura: "meia",
          },
        ],
      },
    ],
  },
  {
    templateId: "tpl-relatorio-semestral",
    titulo: "Relatório Semestral de Estágio",
    descricao:
      "Relatório com identificação, descrição da empresa, objetivos, atividades, dificuldades, considerações finais e autoavaliação.",
    preenchivel: true,
    metadados: {
      papeisPreenchimento: ["aluno"],
      tipoParecer: "coordenador_curso",
      exigeEstagio: true,
      assinaturas: [
        { papel: "aluno", rotulo: "Aluno(a)", tipo: "interna" },
        { papel: "orientador", rotulo: "Professor(a) Orientador(a)", tipo: "interna" },
        { papel: "coordenador_curso", rotulo: "Coordenador(a) do Curso", tipo: "interna" },
      ],
      arquivoOrigem: "Contexto/kit-estagio/09 - Relatorio Semestral de Estagio 2019.docx",
    },
    observacao:
      "O formulário 09 do Kit traz 11 fatores na autoavaliação (o descritor os reproduz na íntegra) e não repete RG, CPF e data de nascimento, que já constam da identificação do aluno no sistema.",
    auto: [
      ...IDENTIFICACAO_ALUNO.filter((campo) =>
        ["nomeCompleto", "telefone", "email", "endereco"].includes(campo.id),
      ),
      ...IDENTIFICACAO_ESTAGIO.filter((campo) =>
        ["instituicao", "supervisor", "orientador", "curso", "turma", "anoSemestre"].includes(
          campo.id,
        ),
      ),
      {
        id: "bairro",
        rotulo: "Bairro",
        tipo: "texto",
        origem: "aluno",
        somenteLeitura: true,
        largura: "meia",
      },
      {
        id: "cidade",
        rotulo: "Cidade",
        tipo: "texto",
        origem: "aluno",
        somenteLeitura: true,
        largura: "meia",
      },
      {
        id: "cep",
        rotulo: "CEP",
        tipo: "texto",
        origem: "aluno",
        mascara: "cep",
        validacao: ["cep"],
        somenteLeitura: true,
        largura: "quarto",
      },
    ],
    secoes: [
      {
        id: "identificacao",
        titulo: "Dados de identificação",
        campos: [
          {
            id: "instituicaoEndereco",
            rotulo: "Endereço da instituição",
            tipo: "texto",
            origem: "digitado",
          },
          {
            id: "instituicaoTelefone",
            rotulo: "Telefone da instituição",
            tipo: "texto",
            origem: "digitado",
            mascara: "telefone",
            validacao: ["telefone"],
            largura: "meia",
          },
          {
            id: "instituicaoEmail",
            rotulo: "E-mail da instituição",
            tipo: "texto",
            origem: "digitado",
            validacao: ["email"],
            largura: "meia",
          },
          {
            id: "responsavel",
            rotulo: "Responsável pelo estagiário",
            tipo: "texto",
            origem: "digitado",
            largura: "meia",
          },
          {
            id: "formacaoSupervisor",
            rotulo: "Formação do(a) supervisor(a)",
            tipo: "texto",
            origem: "digitado",
            largura: "meia",
          },
        ],
      },
      {
        id: "narrativa",
        titulo: "Relato",
        campos: [
          {
            id: "descricaoEmpresa",
            rotulo: "Descrição da empresa",
            tipo: "textarea",
            origem: "digitado",
            obrigatorio: true,
            linhas: 6,
            ajuda: "Informações sobre a empresa e breve histórico.",
          },
          {
            id: "objetivos",
            rotulo: "Objetivos do estágio",
            tipo: "textarea",
            origem: "digitado",
            obrigatorio: true,
            linhas: 6,
            ajuda: "Expectativa e objetivos atingidos: aprendizagem, recomendações.",
          },
          {
            id: "desenvolvimento",
            rotulo: "Desenvolvimento das atividades",
            tipo: "textarea",
            origem: "digitado",
            obrigatorio: true,
            linhas: 8,
          },
          {
            id: "dificuldades",
            rotulo: "Dificuldades encontradas",
            tipo: "textarea",
            origem: "digitado",
            obrigatorio: true,
            linhas: 5,
            ajuda: "Se não houve dificuldades, justifique.",
          },
          {
            id: "consideracoesFinais",
            rotulo: "Considerações finais",
            tipo: "textarea",
            origem: "digitado",
            obrigatorio: true,
            linhas: 6,
          },
        ],
      },
      {
        id: "autoavaliacao",
        titulo: "Autoavaliação",
        descricao: "Marque um X por fator, conforme o grau de desempenho.",
        campos: PESAGEM_AVALIACAO,
      },
    ],
  },
  {
    templateId: "tpl-requerimento-aproveitamento",
    titulo: "Requerimento para Aproveitamento de Carga Horária",
    descricao:
      "Requerimento de aproveitamento das horas de atividades de prática profissional, com os comprovantes anexados e o parecer da Comissão de Estágio.",
    preenchivel: true,
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
      arquivoOrigem:
        "Contexto/kit-estagio/10 - EXTRA -  Requerimento para Aproveitamento de horas Licenciatura.docx",
    },
    auto: [...IDENTIFICACAO_ALUNO.slice(0, 3), ...IDENTIFICACAO_ESTAGIO.slice(0, 2)],
    observacao:
      "O parecer traz as assinaturas do Coordenador(a) do Curso, do Diretor(a) de Ensino e do Coordenador(a) da COIEE.",
    secoes: [
      {
        id: "solicitacao",
        titulo: "Solicitação",
        campos: [
          {
            id: "periodo",
            rotulo: "Período do curso",
            tipo: "texto",
            origem: "aluno",
            somenteLeitura: true,
            largura: "meia",
          },
          {
            id: "cargaHorariaTotal",
            rotulo: "Carga horária total a aproveitar",
            tipo: "numero",
            origem: "digitado",
            mascara: "horas",
            validacao: ["numero"],
            obrigatorio: true,
            min: 1,
            max: 400,
            largura: "meia",
          },
        ],
      },
      {
        id: "comprovantes",
        titulo: "Documentação comprobatória",
        descricao: "Todos os itens são obrigatórios; anexe o arquivo de cada um.",
        campos: COMPROVANTES_APROVEITAMENTO.map((rotulo, indice) => ({
          id: `comprovante_${indice + 1}`,
          rotulo,
          tipo: "checkbox" as const,
          origem: "digitado" as const,
          obrigatorio: true,
        })),
      },
      {
        id: "parecer",
        titulo: "Parecer da Comissão de Estágio",
        campos: [
          {
            id: "parecer_plano",
            rotulo: "As atividades desenvolvidas estão de acordo com o plano de curso?",
            tipo: "radio",
            origem: "digitado",
            opcoes: [
              { valor: "sim", rotulo: "Sim" },
              { valor: "nao", rotulo: "Não" },
            ],
          },
          {
            id: "parecer_contextualizacao",
            rotulo:
              "Estão de acordo com a contextualização e os componentes curriculares do curso?",
            tipo: "radio",
            origem: "digitado",
            opcoes: [
              { valor: "sim", rotulo: "Sim" },
              { valor: "nao", rotulo: "Não" },
            ],
          },
          {
            id: "parecer_itinerario",
            rotulo: "Estão de acordo com o itinerário formativo do educando, proposto pelo curso?",
            tipo: "radio",
            origem: "digitado",
            opcoes: [
              { valor: "sim", rotulo: "Sim" },
              { valor: "nao", rotulo: "Não" },
            ],
          },
          {
            id: "consideracoes",
            rotulo: "Considerações",
            tipo: "textarea",
            origem: "digitado",
            linhas: 3,
          },
          {
            id: "decisao",
            rotulo: "Decisão",
            tipo: "radio",
            origem: "digitado",
            opcoes: [
              { valor: "deferido", rotulo: "Deferido" },
              { valor: "indeferido", rotulo: "Indeferido" },
            ],
          },
        ],
      },
    ],
  },
  {
    templateId: "tpl-termo-aditivo",
    titulo: "Termo Aditivo",
    descricao:
      "Adita o Termo de Compromisso, prorrogando o período do estágio e mantendo as demais cláusulas.",
    preenchivel: true,
    metadados: {
      papeisPreenchimento: ["aluno"],
      tipoParecer: "externo",
      exigeEstagio: true,
      assinaturas: [
        { papel: "externo", rotulo: "Concedente", tipo: "externa" },
        { papel: "aluno", rotulo: "Estagiário(a)", tipo: "interna" },
        { papel: "convenente", rotulo: "Convenente (IFRJ)", tipo: "interna" },
      ],
      arquivoOrigem: "Contexto/kit-estagio/11 - EXTRA - Termo aditivo.docx",
    },
    observacao:
      "O aditivo 11 do Kit identifica aluno, curso, semestre, turma e instituição; não traz campo de supervisor nem de professor orientador. A justificativa da prorrogação não existe no formulário original e está mantida aqui apenas para registro — sua remoção ou exigência é decisão da revisão com a cliente.",
    auto: [
      ALUNO_ESTAGIARIO,
      ...IDENTIFICACAO_ESTAGIO.filter((campo) =>
        ["instituicao", "curso", "turma"].includes(campo.id),
      ),
      {
        id: "semestre",
        rotulo: "Semestre",
        tipo: "texto",
        origem: "aluno",
        somenteLeitura: true,
        largura: "meia",
      },
    ],
    secoes: [
      {
        id: "aditamento",
        titulo: "Aditamento",
        campos: [
          {
            id: "preambulo",
            rotulo: "Preâmbulo do aditamento",
            tipo: "fixo",
            origem: "literal",
            ajuda:
              "Neste documento, formaliza-se o ADITAMENTO ao Termo de Compromisso celebrado entre o aluno(a), do Curso, do semestre, da turma, e a Empresa/Instituição, com a interveniência do Instituto Federal de Educação, Ciência e Tecnologia do Rio de Janeiro (IFRJ), com o fim de formalizar a realização de estágio curricular supervisionado, de acordo com o estabelecido na Lei 11.788 de 25 de setembro de 2008.",
          },
          {
            id: "termoCompromissoData",
            rotulo: "Data do Termo de Compromisso",
            tipo: "data",
            origem: "estagio",
            mascara: "data",
            validacao: ["data"],
            obrigatorio: true,
            somenteLeitura: true,
            largura: "meia",
          },
          {
            id: "novoTermino",
            rotulo: "Novo término",
            tipo: "data",
            origem: "digitado",
            mascara: "data",
            validacao: ["data"],
            obrigatorio: true,
            ajuda: "O período fica prorrogado até esta data.",
            largura: "meia",
          },
          {
            id: "vias",
            rotulo: "Número de vias",
            tipo: "numero",
            origem: "digitado",
            validacao: ["numero"],
            min: 1,
            max: 4,
            largura: "meia",
          },
          {
            id: "justificativa",
            rotulo: "Justificativa da prorrogação",
            tipo: "textarea",
            origem: "digitado",
            linhas: 4,
            ajuda: "Campo extra: o formulário 11 do Kit não traz este campo.",
          },
        ],
      },
      {
        id: "clausula",
        titulo: "Cláusula única",
        campos: [
          {
            id: "clausulaUnica",
            rotulo: "Redação da cláusula",
            tipo: "fixo",
            origem: "literal",
            ajuda:
              "CLÁUSULA ÚNICA: O período de estágio curricular supervisionado fica prorrogado até a nova data, permanecendo inalteradas as demais cláusulas do Termo de Compromisso. As partes firmam o presente em N (N) vias de igual teor e forma.",
          },
        ],
      },
      {
        id: "assinaturas",
        titulo: "Assinaturas",
        campos: [
          {
            id: "assinaturaConcedente",
            rotulo: "Concedente",
            tipo: "assinatura",
            origem: "digitado",
          },
          {
            id: "assinaturaEstagiario",
            rotulo: "Estagiário(a)",
            tipo: "assinatura",
            origem: "digitado",
          },
          {
            id: "assinaturaConvenente",
            rotulo: "Convenente",
            tipo: "assinatura",
            origem: "digitado",
          },
        ],
      },
    ],
  },
  {
    templateId: "tpl-proposta-atuacao-pedagogica",
    titulo: "Proposta de Atuação Pedagógica",
    descricao:
      "Proposta de intervenção pedagógica com as seções e os limites de palavras impressos no formulário 12 do Kit.",
    preenchivel: true,
    metadados: {
      papeisPreenchimento: ["aluno"],
      tipoParecer: "coordenador_curso",
      exigeEstagio: true,
      assinaturas: [
        { papel: "aluno", rotulo: "Aluno(a)", tipo: "interna" },
        { papel: "orientador", rotulo: "Professor(a) Orientador(a) de Estágio", tipo: "interna" },
      ],
      arquivoOrigem: "Contexto/kit-estagio/12 - Proposta de Atuação Pedagógica_note_ago24.docx",
    },
    auto: [...IDENTIFICACAO_ALUNO.slice(0, 1), ...IDENTIFICACAO_ESTAGIO.slice(3, 4)],
    observacao:
      "Cabeçalho e texto exibidos de forma genérica: o modelo original traz um curso de exemplo e o sistema não o reproduz (tarefa 15.3).",
    secoes: [
      {
        id: "titulo",
        titulo: "Título da Atuação Pedagógica",
        campos: [
          {
            id: "instrucaoTitulo",
            rotulo: "Como escrever o título",
            tipo: "instrucao",
            origem: "literal",
            ajuda:
              "Elabore um título criativo que represente a disciplina e a proposta apresentada.",
          },
          {
            id: "titulo",
            rotulo: "Título",
            tipo: "texto",
            origem: "digitado",
            obrigatorio: true,
            largura: "meia",
          },
        ],
      },
      {
        id: "introducao",
        titulo: "Introdução",
        descricao: "Máximo de 400 palavras.",
        campos: [
          {
            id: "instrucaoIntroducao",
            rotulo: "Como escrever a introdução",
            tipo: "instrucao",
            origem: "literal",
            ajuda:
              "Contextualização: apresente o ambiente educacional da intervenção (escola, turma e nível de ensino) e justifique a proposta com base em observações do ambiente escolar, problemas identificados e literatura especializada.",
          },
          {
            id: "introducao",
            rotulo: "Introdução",
            tipo: "textarea",
            origem: "digitado",
            validacao: ["limite_palavras"],
            obrigatorio: true,
            maximoPalavras: 400,
            linhas: 10,
          },
        ],
      },
      {
        id: "objetivos",
        titulo: "Objetivos",
        descricao: "Máximo de 200 palavras.",
        campos: [
          {
            id: "objetivos",
            rotulo: "Objetivos",
            tipo: "textarea",
            origem: "digitado",
            validacao: ["limite_palavras"],
            obrigatorio: true,
            maximoPalavras: 200,
            linhas: 6,
          },
        ],
      },
      {
        id: "fundamentacao",
        titulo: "Fundamentação Teórica",
        descricao: "Máximo de 300 palavras.",
        campos: [
          {
            id: "fundamentacao",
            rotulo: "Fundamentação teórica",
            tipo: "textarea",
            origem: "digitado",
            validacao: ["limite_palavras"],
            obrigatorio: true,
            maximoPalavras: 300,
            linhas: 8,
          },
        ],
      },
      {
        id: "metodologia",
        titulo: "Metodologia",
        descricao: "Máximo de 200 palavras.",
        campos: [
          {
            id: "metodologia",
            rotulo: "Metodologia",
            tipo: "textarea",
            origem: "digitado",
            validacao: ["limite_palavras"],
            obrigatorio: true,
            maximoPalavras: 200,
            linhas: 6,
            ajuda: "Inclua o cronograma das atividades, com datas e duração de cada etapa.",
          },
        ],
      },
      {
        id: "recursos",
        titulo: "Recursos Necessários",
        descricao: "Máximo de 200 palavras.",
        campos: [
          {
            id: "recursos",
            rotulo: "Recursos necessários",
            tipo: "textarea",
            origem: "digitado",
            validacao: ["limite_palavras"],
            obrigatorio: true,
            maximoPalavras: 200,
            linhas: 6,
            ajuda: "Materiais, equipamentos e infraestrutura.",
          },
          {
            id: "instrucaoRecursos",
            rotulo: "Como escrever recursos necessários",
            tipo: "instrucao",
            origem: "literal",
            ajuda:
              "Materiais e equipamentos: liste os necessários (computadores, softwares, materiais didáticos). Infraestrutura: descreva as condições físicas necessárias, como sala de informática e acesso à internet.",
          },
        ],
      },
      {
        id: "avaliacao",
        titulo: "Avaliação",
        descricao: "Máximo de 200 palavras.",
        campos: [
          {
            id: "avaliacao",
            rotulo: "Avaliação",
            tipo: "textarea",
            origem: "digitado",
            validacao: ["limite_palavras"],
            obrigatorio: true,
            maximoPalavras: 200,
            linhas: 6,
            ajuda: "Critérios e instrumentos de avaliação.",
          },
          {
            id: "instrucaoAvaliacao",
            rotulo: "Como escrever a avaliação",
            tipo: "instrucao",
            origem: "literal",
            ajuda:
              "Critérios de avaliação: defina os critérios de desempenho dos alunos e a eficácia da intervenção. Instrumentos: descreva os instrumentos (questionários, observação direta, portfólios).",
          },
        ],
      },
      {
        id: "resultados",
        titulo: "Resultados Esperados",
        descricao: "Máximo de 200 palavras.",
        campos: [
          {
            id: "resultados",
            rotulo: "Resultados esperados",
            tipo: "textarea",
            origem: "digitado",
            validacao: ["limite_palavras"],
            obrigatorio: true,
            maximoPalavras: 200,
            linhas: 6,
          },
        ],
      },
      {
        id: "consideracoes",
        titulo: "Considerações Finais",
        descricao: "Máximo de 400 palavras.",
        campos: [
          {
            id: "consideracoes",
            rotulo: "Considerações finais",
            tipo: "textarea",
            origem: "digitado",
            validacao: ["limite_palavras"],
            obrigatorio: true,
            maximoPalavras: 400,
            linhas: 10,
          },
        ],
      },
      {
        id: "referencias",
        titulo: "Referências",
        campos: [
          {
            id: "referencias",
            rotulo: "Bibliografia",
            tipo: "textarea",
            origem: "digitado",
            obrigatorio: true,
            linhas: 8,
            ajuda: "Referências no padrão ABNT.",
          },
        ],
      },
      {
        id: "assinaturas",
        titulo: "Assinaturas",
        campos: [
          {
            id: "assinaturaAluno",
            rotulo: "Aluno(a)",
            tipo: "assinatura",
            origem: "digitado",
          },
          {
            id: "assinaturaOrientador",
            rotulo: "Professor(a) orientador(a) de estágio",
            tipo: "assinatura",
            origem: "digitado",
          },
        ],
      },
    ],
  },
];

const POR_TEMPLATE = new Map(DESCRITORES.map((descriptor) => [descriptor.templateId, descriptor]));

export function descritorPorTemplate(templateId: string): DescriptorDocumento | undefined {
  return POR_TEMPLATE.get(templateId);
}

/** Todos os campos de um template, na ordem em que aparecem no documento. */
export function camposDoTemplate(templateId: string): CampoDescriptor[] {
  const descriptor = descritorPorTemplate(templateId);

  if (!descriptor) return [];

  return [...(descriptor.auto ?? []), ...descriptor.secoes.flatMap((secao) => secao.campos)];
}

/** Limites de palavras por seção, para validação e contador na tela. */
export function limitesDePalavras(templateId: string): Record<string, number> {
  return Object.fromEntries(
    camposDoTemplate(templateId)
      .filter((campo) => typeof campo.maximoPalavras === "number")
      .map((campo) => [campo.id, campo.maximoPalavras as number]),
  );
}
