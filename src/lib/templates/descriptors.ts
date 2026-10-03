/**
 * Descritores dos documentos (D6). Os formulários são gerados a partir daqui:
 * nenhuma tela escreve o layout de um documento em JSX.
 *
 * Os textos de apoio reproduzem o Kit de Estágio; a contagem de palavras da
 * Proposta de Atuação Pedagógica vem dos limites impressos no formulário 12.
 */

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
  | "auto";

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
  /** Campo calculado pelo sistema a partir das demais colunas da linha. */
  automatica?: boolean;
  largura?: string;
}

export interface CampoDescriptor {
  id: string;
  rotulo: string;
  tipo: TipoCampoDescriptor;
  obrigatorio?: boolean;
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
  /** Campos preenchidos automaticamente a partir do estágio e do cadastro. */
  auto?: CampoDescriptor[];
  secoes: SecaoDescriptor[];
  observacao?: string;
}

const IDENTIFICACAO_ALUNO: CampoDescriptor[] = [
  {
    id: "nomeCompleto",
    rotulo: "Nome do aluno(a)",
    tipo: "texto",
    obrigatorio: true,
    somenteLeitura: true,
  },
  { id: "rg", rotulo: "RG", tipo: "texto", somenteLeitura: true },
  { id: "cpf", rotulo: "CPF", tipo: "texto", somenteLeitura: true },
  { id: "dataNascimento", rotulo: "Data de nascimento", tipo: "data", somenteLeitura: true },
  { id: "telefone", rotulo: "Telefone", tipo: "texto", somenteLeitura: true, largura: "meia" },
  { id: "celular", rotulo: "Celular", tipo: "texto", somenteLeitura: true, largura: "meia" },
  { id: "email", rotulo: "E-mail", tipo: "texto", somenteLeitura: true },
  {
    id: "endereco",
    rotulo: "Endereço",
    tipo: "texto",
    somenteLeitura: true,
    ajuda: "Endereço do cadastro do aluno.",
  },
];

const IDENTIFICACAO_ESTAGIO: CampoDescriptor[] = [
  {
    id: "instituicao",
    rotulo: "Local de estágio (escola/empresa)",
    tipo: "texto",
    obrigatorio: true,
    somenteLeitura: true,
  },
  {
    id: "supervisor",
    rotulo: "Supervisor(a) de estágio",
    tipo: "texto",
    obrigatorio: true,
    somenteLeitura: true,
  },
  {
    id: "orientador",
    rotulo: "Professor(a) orientador(a) de estágio",
    tipo: "texto",
    obrigatorio: true,
    somenteLeitura: true,
  },
  {
    id: "dataInicio",
    rotulo: "Início do estágio",
    tipo: "data",
    somenteLeitura: true,
    largura: "meia",
  },
  {
    id: "dataFim",
    rotulo: "Término do estágio",
    tipo: "data",
    somenteLeitura: true,
    largura: "meia",
  },
  { id: "curso", rotulo: "Curso", tipo: "texto", somenteLeitura: true, largura: "meia" },
  { id: "turma", rotulo: "Turma", tipo: "texto", somenteLeitura: true, largura: "meia" },
  {
    id: "anoSemestre",
    rotulo: "Ano/semestre",
    tipo: "texto",
    somenteLeitura: true,
    largura: "meia",
  },
];

const ASSINATURAS: CampoDescriptor[] = [
  { id: "assinaturaAluno", rotulo: "Assinatura do(a) aluno(a)", tipo: "assinatura" },
  { id: "assinaturaSupervisor", rotulo: "Assinatura do(a) supervisor(a)", tipo: "assinatura" },
];

const TEMPO_NA_ATIVIDADE = [
  { valor: "estagio", rotulo: "Estágio" },
  { valor: "projeto_monitoria_pratica", rotulo: "Projeto/Monitoria/Prática profissional" },
];

const FATORES_RELATORIO = [
  "Facilidade de Compreensão",
  "Nível de Conhecimento Teórico",
  "Organização e Método no Trabalho",
  "Iniciativa, Criatividade e Independência",
  "Cooperação",
  "Interesse",
];

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

const PESAGEM_AVALIACAO = FATORES_RELATORIO.map((fator, indice) => ({
  id: `autoavaliacao_${indice + 1}`,
  rotulo: fator,
  tipo: "radio" as const,
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
  min: 0,
  max: 10,
  passo: 0.1,
  largura: "meia" as const,
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
    auto: [...IDENTIFICACAO_ALUNO.slice(0, 3), ...IDENTIFICACAO_ESTAGIO],
    secoes: [
      {
        id: "identificacao",
        titulo: "Identificação",
        campos: [
          {
            id: "turmaSemestreAno",
            rotulo: "Turma/semestre/ano",
            tipo: "texto",
            obrigatorio: true,
            somenteLeitura: true,
          },
          { id: "enderecoAluno", rotulo: "Endereço do aluno", tipo: "texto", obrigatorio: true },
          { id: "cepAluno", rotulo: "CEP", tipo: "texto", obrigatorio: true, largura: "meia" },
          {
            id: "telefoneAluno",
            rotulo: "Telefone",
            tipo: "texto",
            obrigatorio: true,
            largura: "meia",
          },
          {
            id: "celularAluno",
            rotulo: "Celular",
            tipo: "texto",
            obrigatorio: true,
            largura: "meia",
          },
          { id: "emailAluno", rotulo: "E-mail", tipo: "texto", obrigatorio: true, largura: "meia" },
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
            obrigatorio: true,
            somenteLeitura: true,
          },
          { id: "enderecoLocal", rotulo: "Endereço", tipo: "texto", obrigatorio: true },
          {
            id: "telefoneSupervisor",
            rotulo: "Telefone do(a) supervisor(a)",
            tipo: "texto",
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
            tipo: "textarea",
            somenteLeitura: true,
            linhas: 6,
            ajuda:
              "Orientar quanto às normas de conduta; esclarecer dúvidas; orientar sobre o relatório técnico; avaliar e assinar a versão final; compor a banca do seminário.",
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
    auto: [...IDENTIFICACAO_ALUNO.slice(0, 1), ...IDENTIFICACAO_ESTAGIO.slice(0, 1)],
    secoes: [
      {
        id: "identificacao",
        titulo: "Identificação",
        campos: [
          {
            id: "tipoAtividade",
            rotulo: "Tipo de atividade",
            tipo: "radio",
            obrigatorio: true,
            opcoes: TEMPO_NA_ATIVIDADE,
          },
          { id: "curso", rotulo: "Curso", tipo: "texto", obrigatorio: true, somenteLeitura: true },
          { id: "rg", rotulo: "RG", tipo: "texto", somenteLeitura: true, largura: "meia" },
          { id: "cpf", rotulo: "CPF", tipo: "texto", somenteLeitura: true, largura: "meia" },
          {
            id: "dataInicioPrevista",
            rotulo: "Data prevista de início",
            tipo: "data",
            obrigatorio: true,
            largura: "meia",
          },
          {
            id: "dataFimPrevista",
            rotulo: "Data prevista de término",
            tipo: "data",
            obrigatorio: true,
            largura: "meia",
          },
          {
            id: "supervisor",
            rotulo: "Supervisor(a) de estágio",
            tipo: "texto",
            obrigatorio: true,
            somenteLeitura: true,
          },
          {
            id: "orientador",
            rotulo: "Professor(a) orientador(a) de estágio",
            tipo: "texto",
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
    observacao:
      "Layout provisário: o original está em .doc e depende da conversão para .docx (tarefa 15.1).",
    secoes: [
      {
        id: "instituicao",
        titulo: "Instituição concedente",
        campos: [
          { id: "razaoSocial", rotulo: "Razão social", tipo: "texto", obrigatorio: true },
          { id: "nomeFantasia", rotulo: "Nome fantasia", tipo: "texto" },
          { id: "cnpj", rotulo: "CNPJ", tipo: "texto", obrigatorio: true, maximoCaracteres: 18 },
          { id: "endereco", rotulo: "Endereço", tipo: "texto", obrigatorio: true },
          { id: "bairro", rotulo: "Bairro", tipo: "texto", largura: "meia" },
          { id: "cidade", rotulo: "Cidade", tipo: "texto", largura: "meia" },
          { id: "uf", rotulo: "UF", tipo: "texto", largura: "quarto" },
          { id: "cep", rotulo: "CEP", tipo: "texto", largura: "quarto" },
          { id: "telefone", rotulo: "Telefone", tipo: "texto", largura: "meia" },
          { id: "email", rotulo: "E-mail", tipo: "texto", largura: "meia" },
          { id: "responsavel", rotulo: "Responsável legal", tipo: "texto", obrigatorio: true },
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
            obrigatorio: true,
            largura: "meia",
          },
          {
            id: "fimVigencia",
            rotulo: "Fim da vigência",
            tipo: "data",
            obrigatorio: true,
            largura: "meia",
            ajuda: "Calculado como início + 5 anos.",
          },
          {
            id: "renovacoes",
            rotulo: "Renovações",
            tipo: "numero",
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
          { id: "assinaturaCoordenador", rotulo: "Coordenador(a) de Estágio", tipo: "assinatura" },
          {
            id: "assinaturaInstituicao",
            rotulo: "Representante da instituição",
            tipo: "assinatura",
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
    observacao:
      "Layout provisório: o original está em .doc e depende da conversão para .docx (tarefa 15.1).",
    auto: [...IDENTIFICACAO_ALUNO.slice(0, 3), ...IDENTIFICACAO_ESTAGIO.slice(0, 3)],
    secoes: [
      {
        id: "vigencia",
        titulo: "Vigência do estágio",
        campos: [
          {
            id: "dataInicio",
            rotulo: "Início",
            tipo: "data",
            obrigatorio: true,
            somenteLeitura: true,
            largura: "meia",
          },
          {
            id: "dataFim",
            rotulo: "Término",
            tipo: "data",
            obrigatorio: true,
            somenteLeitura: true,
            largura: "meia",
          },
          {
            id: "cargaHorariaSemanal",
            rotulo: "Carga horária semanal",
            tipo: "numero",
            obrigatorio: true,
            min: 1,
            max: 30,
            largura: "meia",
          },
          {
            id: "horario",
            rotulo: "Horário do estágio",
            tipo: "texto",
            obrigatorio: true,
            largura: "meia",
          },
        ],
      },
      {
        id: "assinaturas",
        titulo: "Assinaturas",
        campos: [
          { id: "assinaturaAluno", rotulo: "Estagiário(a)", tipo: "assinatura" },
          { id: "assinaturaSupervisor", rotulo: "Supervisor(a) de estágio", tipo: "assinatura" },
          { id: "assinaturaOrientador", rotulo: "Professor(a) orientador(a)", tipo: "assinatura" },
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
    auto: IDENTIFICACAO_ESTAGIO,
    secoes: [
      {
        id: "lancamentos",
        titulo: "Lançamentos",
        campos: [
          {
            id: "lancamentos",
            rotulo: "Lançamentos",
            tipo: "grade",
            maximoLinhas: 80,
            totalAutomatico: true,
            ajuda: "Correções preservam o histórico: o valor anterior fica registrado.",
            colunas: [
              { chave: "data", rotulo: "Data", tipo: "data" },
              { chave: "entrada", rotulo: "Entrada", tipo: "hora" },
              { chave: "saida", rotulo: "Saída", tipo: "hora" },
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
    observacao:
      "No Kit, o preenchimento é feito fora do sistema; aqui a COIEE registra os dados e as assinaturas externas ficam pendentes.",
    auto: [
      {
        id: "campus",
        rotulo: "Campus",
        tipo: "texto",
        somenteLeitura: true,
        largura: "meia",
        ajuda: "Pinheiral",
      },
      { id: "aluno", rotulo: "Nome do aluno", tipo: "texto", somenteLeitura: true },
      {
        id: "periodoEstagio",
        rotulo: "Período de estágio",
        tipo: "texto",
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
            obrigatorio: true,
            somenteLeitura: true,
          },
          { id: "nomeFantasia", rotulo: "Nome fantasia", tipo: "texto" },
          { id: "endereco", rotulo: "Endereço", tipo: "texto", obrigatorio: true },
          { id: "bairro", rotulo: "Bairro", tipo: "texto", largura: "meia" },
          { id: "cidade", rotulo: "Cidade", tipo: "texto", largura: "meia" },
          { id: "uf", rotulo: "UF", tipo: "texto", largura: "quarto" },
          { id: "cep", rotulo: "CEP", tipo: "texto", largura: "quarto" },
          { id: "site", rotulo: "Site", tipo: "texto", largura: "meia" },
          { id: "telefone", rotulo: "Telefone", tipo: "texto", largura: "meia" },
          { id: "email", rotulo: "E-mail", tipo: "texto" },
          {
            id: "areaAtuacao",
            rotulo: "Área de atuação do estágio",
            tipo: "texto",
            obrigatorio: true,
          },
          { id: "setor", rotulo: "Setor", tipo: "texto", obrigatorio: true },
          { id: "responsavel", rotulo: "Responsável", tipo: "texto", obrigatorio: true },
          {
            id: "cargaHorariaSemanal",
            rotulo: "Carga horária semanal",
            tipo: "numero",
            min: 1,
            max: 30,
            largura: "meia",
          },
          { id: "horario", rotulo: "Horário do estágio", tipo: "texto", largura: "meia" },
          { id: "bolsa", rotulo: "Bolsa de trabalho", tipo: "texto" },
          { id: "beneficios", rotulo: "Benefícios concedidos", tipo: "texto" },
          { id: "controleFrequencia", rotulo: "Controle de frequência", tipo: "texto" },
          { id: "observacoes", rotulo: "Observações importantes", tipo: "textarea", linhas: 3 },
        ],
      },
      {
        id: "frequencia",
        titulo: "Controle de frequência",
        campos: [
          {
            id: "meses",
            rotulo: "Meses",
            tipo: "grade",
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
            tipo: "auto",
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
            min: 0,
            max: 10,
            passo: 0.1,
            largura: "meia",
          },
          { id: "observacoesFinais", rotulo: "Observações", tipo: "textarea", linhas: 3 },
          {
            id: "nomeSupervisor",
            rotulo: "Nome do(a) supervisor(a) da concedente",
            tipo: "texto",
            obrigatorio: true,
          },
          { id: "cargo", rotulo: "Cargo ou função", tipo: "texto" },
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
    auto: [...IDENTIFICACAO_ALUNO, ...IDENTIFICACAO_ESTAGIO],
    secoes: [
      {
        id: "identificacao",
        titulo: "Dados de identificação",
        campos: [
          { id: "instituicaoEndereco", rotulo: "Endereço da instituição", tipo: "texto" },
          {
            id: "instituicaoTelefone",
            rotulo: "Telefone da instituição",
            tipo: "texto",
            largura: "meia",
          },
          {
            id: "instituicaoEmail",
            rotulo: "E-mail da instituição",
            tipo: "texto",
            largura: "meia",
          },
          {
            id: "responsavel",
            rotulo: "Responsável pelo estagiário",
            tipo: "texto",
            largura: "meia",
          },
          {
            id: "formacaoSupervisor",
            rotulo: "Formação do(a) supervisor(a)",
            tipo: "texto",
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
            obrigatorio: true,
            linhas: 6,
            ajuda: "Informações sobre a empresa e breve histórico.",
          },
          {
            id: "objetivos",
            rotulo: "Objetivos do estágio",
            tipo: "textarea",
            obrigatorio: true,
            linhas: 6,
            ajuda: "Expectativa e objetivos atingidos: aprendizagem, recomendações.",
          },
          {
            id: "desenvolvimento",
            rotulo: "Desenvolvimento das atividades",
            tipo: "textarea",
            obrigatorio: true,
            linhas: 8,
          },
          {
            id: "dificuldades",
            rotulo: "Dificuldades encontradas",
            tipo: "textarea",
            obrigatorio: true,
            linhas: 5,
            ajuda: "Se não houve dificuldades, justifique.",
          },
          {
            id: "consideracoesFinais",
            rotulo: "Considerações finais",
            tipo: "textarea",
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
            somenteLeitura: true,
            largura: "meia",
          },
          {
            id: "cargaHorariaTotal",
            rotulo: "Carga horária total a aproveitar",
            tipo: "numero",
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
            opcoes: [
              { valor: "sim", rotulo: "Sim" },
              { valor: "nao", rotulo: "Não" },
            ],
          },
          {
            id: "parecer_itinerario",
            rotulo: "Estão de acordo com o itinerário formativo do educando, proposto pelo curso?",
            tipo: "radio",
            opcoes: [
              { valor: "sim", rotulo: "Sim" },
              { valor: "nao", rotulo: "Não" },
            ],
          },
          { id: "consideracoes", rotulo: "Considerações", tipo: "textarea", linhas: 3 },
          {
            id: "decisao",
            rotulo: "Decisão",
            tipo: "radio",
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
    auto: [...IDENTIFICACAO_ESTAGIO.slice(0, 3)],
    secoes: [
      {
        id: "aditamento",
        titulo: "Aditamento",
        campos: [
          {
            id: "termoCompromissoData",
            rotulo: "Data do Termo de Compromisso",
            tipo: "data",
            obrigatorio: true,
            somenteLeitura: true,
            largura: "meia",
          },
          {
            id: "novoTermino",
            rotulo: "Novo término",
            tipo: "data",
            obrigatorio: true,
            ajuda: "O período fica prorrogado até esta data.",
            largura: "meia",
          },
          { id: "vias", rotulo: "Número de vias", tipo: "numero", min: 1, max: 4, largura: "meia" },
          {
            id: "justificativa",
            rotulo: "Justificativa da prorrogação",
            tipo: "textarea",
            obrigatorio: true,
            linhas: 4,
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
            tipo: "textarea",
            somenteLeitura: true,
            linhas: 4,
            ajuda:
              "Gerada pelo sistema: o período de estágio curricular supervisionado fica prorrogado até a nova data, permanecendo inalteradas as demais cláusulas.",
          },
        ],
      },
      {
        id: "assinaturas",
        titulo: "Assinaturas",
        campos: [
          { id: "assinaturaConcedente", rotulo: "Concedente", tipo: "assinatura" },
          { id: "assinaturaEstagiario", rotulo: "Estagiário(a)", tipo: "assinatura" },
          { id: "assinaturaConvenente", rotulo: "Convenente", tipo: "assinatura" },
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
    auto: [...IDENTIFICACAO_ALUNO.slice(0, 1), ...IDENTIFICACAO_ESTAGIO.slice(3, 4)],
    observacao:
      "Cabeçalho e texto exibidos de forma genérica: o modelo original traz um curso de exemplo e o sistema não o reproduz (tarefa 15.3).",
    secoes: [
      {
        id: "titulo",
        titulo: "Título da Atuação Pedagógica",
        campos: [
          {
            id: "titulo",
            rotulo: "Título",
            tipo: "texto",
            obrigatorio: true,
            ajuda: "Título criativo que representa a disciplina e a proposta.",
          },
        ],
      },
      {
        id: "introducao",
        titulo: "Introdução",
        descricao: "Máximo de 400 palavras.",
        campos: [
          {
            id: "introducao",
            rotulo: "Introdução",
            tipo: "textarea",
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
            obrigatorio: true,
            maximoPalavras: 200,
            linhas: 6,
            ajuda: "Materiais, equipamentos e infraestrutura.",
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
            obrigatorio: true,
            maximoPalavras: 200,
            linhas: 6,
            ajuda: "Critérios e instrumentos de avaliação.",
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
          { id: "assinaturaAluno", rotulo: "Aluno(a)", tipo: "assinatura" },
          {
            id: "assinaturaOrientador",
            rotulo: "Professor(a) orientador(a) de estágio",
            tipo: "assinatura",
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
