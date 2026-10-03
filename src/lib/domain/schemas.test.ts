import { describe, expect, it } from "vitest";

import {
  INTERVALO_ALMOCO,
  LIMITE_HORAS_DIA,
  LIMITE_HORAS_SEMANA,
  arredondarMeiaHora,
  calcularHorasDia,
  cpfValido,
  esquemaCelular,
  esquemaCpf,
  esquemaDadosPessoais,
  esquemaEmail,
  esquemaEstagio,
  esquemaIdCadastrado,
  esquemaTelefone,
} from "./schemas";

describe("cpfValido", () => {
  it.each(["529.982.247-25", "111.444.777-35", "390.533.447-05"])(
    "aceita o CPF válido %s",
    (cpf) => {
      expect(cpfValido(cpf)).toBe(true);
    },
  );

  it.each(["529.982.247-26", "111.444.777-00", "123.456.789-00", "000.000.000-00", "11111111111"])(
    "recusa o CPF %s",
    (cpf) => {
      expect(cpfValido(cpf)).toBe(false);
    },
  );

  it("recusa CPF com tamanho errado", () => {
    expect(cpfValido("1234567890")).toBe(false);
  });
});

describe("esquemas de contato", () => {
  it("normaliza o e-mail", () => {
    const resultado = esquemaEmail.parse("  MARIA@Exemplo.COM ");

    expect(resultado).toBe("maria@exemplo.com");
  });

  it("recusa e-mail malformado", () => {
    expect(esquemaEmail.safeParse("maria@").success).toBe(false);
  });

  it("recusa telefone sem DDD", () => {
    expect(esquemaTelefone.safeParse("3333-4444").success).toBe(false);
  });

  it("aceita telefone com DDD", () => {
    expect(esquemaTelefone.safeParse("(21) 3333-4444").success).toBe(true);
  });

  it("recusa celular com oito dígitos", () => {
    expect(esquemaCelular.safeParse("(21) 9876-5432").success).toBe(false);
  });

  it("recusa celular que não começa por 9", () => {
    expect(esquemaCelular.safeParse("(21) 8876-5432").success).toBe(false);
  });

  it("aceita celular com onze dígitos começando por 9", () => {
    expect(esquemaCelular.safeParse("(21) 99876-5432").success).toBe(true);
  });
});

describe("esquemaCpf", () => {
  it("remove a máscara e valida", () => {
    expect(esquemaCpf.parse("529.982.247-25")).toBe("52998224725");
  });

  it("sinaliza CPF inválido", () => {
    const resultado = esquemaCpf.safeParse("111.111.111-11");

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0].message).toBe("CPF inválido.");
  });
});

describe("seleção entre valores cadastrados", () => {
  const esquema = esquemaIdCadastrado(["ads", "eletro"], "o curso");

  it("aceita valor cadastrado", () => {
    expect(esquema.safeParse("ads").success).toBe(true);
  });

  it("recusa valor não cadastrado", () => {
    expect(esquema.safeParse("digitado").success).toBe(false);
  });
});

describe("esquemaDadosPessoais", () => {
  const opcoes = {
    cursosIds: ["ads", "eletro"],
    turmasPorCurso: { ads: ["ads-2026-1a"], eletro: ["eletro-2026-1a"] },
    periodosIds: ["2026-1", "2026-2"],
  };

  const base = {
    nomeCompleto: "Maria de Souza",
    cpf: "529.982.247-25",
    rg: "12.34567-89",
    dataNascimento: "01/02/2005",
    email: "maria@exemplo.com",
    telefone: "(21) 3333-4444",
    celular: "(21) 99876-5432",
    endereco: {
      cep: "23940-000",
      logradouro: "Rua Exemplo",
      numero: "123",
      complemento: "",
      bairro: "Centro",
      cidade: "Pinheiral",
      estado: "rj",
    },
    cursoId: "ads",
    turmaId: "ads-2026-1a",
    periodoId: "2026-1",
  };

  it("aceita cadastro completo", () => {
    const resultado = esquemaDadosPessoais(opcoes).safeParse(base);

    expect(resultado.success).toBe(true);
  });

  it("normaliza o estado para sigla maiúscula", () => {
    const resultado = esquemaDadosPessoais(opcoes).parse(base);

    expect(resultado.endereco.estado).toBe("RJ");
  });

  it("recusa turma de outro curso", () => {
    const resultado = esquemaDadosPessoais(opcoes).safeParse({
      ...base,
      turmaId: "eletro-2026-1a",
    });

    expect(resultado.success).toBe(false);
  });

  it("recusa curso não cadastrado", () => {
    expect(esquemaDadosPessoais(opcoes).safeParse({ ...base, cursoId: "outro" }).success).toBe(
      false,
    );
  });

  it("recusa nome em branco", () => {
    expect(esquemaDadosPessoais(opcoes).safeParse({ ...base, nomeCompleto: "" }).success).toBe(
      false,
    );
  });
});

describe("esquemaEstagio", () => {
  const hoje = "2026-06-01";
  const esquema = esquemaEstagio({ dirname: () => hoje });

  it("aceita período válido em andamento", () => {
    const resultado = esquema.safeParse({
      convenioId: "conv-1",
      supervisorId: "sup-1",
      orientadorId: "ori-1",
      dataInicio: "01/06/2026",
      dataFim: "30/11/2026",
      situacao: "em_andamento",
    });

    expect(resultado.success).toBe(true);
  });

  it("recusa data final anterior à inicial", () => {
    const resultado = esquema.safeParse({
      convenioId: "conv-1",
      supervisorId: "sup-1",
      orientadorId: "ori-1",
      dataInicio: "01/06/2026",
      dataFim: "30/05/2026",
      situacao: "em_andamento",
    });

    expect(resultado.success).toBe(false);
  });

  it("recusa concluído com data final futura", () => {
    const resultado = esquema.safeParse({
      convenioId: "conv-1",
      supervisorId: "sup-1",
      orientadorId: "ori-1",
      dataInicio: "01/06/2026",
      dataFim: "30/11/2026",
      situacao: "concluido",
    });

    expect(resultado.success).toBe(false);
  });
});

describe("cálculo de horas", () => {
  it("desconta o intervalo de almoço quando desligado", () => {
    expect(calcularHorasDia("08:00", "17:00", true)).toBe(8);
    expect(calcularHorasDia("08:00", "17:00", false)).toBe(9);
  });

  it("desconta uma hora de almoço", () => {
    expect(calcularHorasDia("09:00", "18:00", true)).toBe(8);
    expect(INTERVALO_ALMOCO).toBe(1);
  });

  it("devolve zero quando a saída é anterior à entrada", () => {
    expect(calcularHorasDia("17:00", "08:00", true)).toBe(0);
  });

  it("arredonda para meia hora", () => {
    expect(arredondarMeiaHora(7.4)).toBe(7.5);
  });

  it("publica os limites do regulamento", () => {
    expect(LIMITE_HORAS_DIA).toBe(6);
    expect(LIMITE_HORAS_SEMANA).toBe(30);
  });
});
