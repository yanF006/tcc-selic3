import { describe, expect, it } from "vitest";

import {
  METADADOS_SITUACAO,
  ROTULOS_TODAS_SITUACOES,
  iconeSituacaoDocumento,
  iconeSituacaoEstagio,
  metadadoDocumento,
  metadadoEstagio,
  metadadoUsuario,
  rotuloPapel,
  rotuloSituacaoDocumento,
  rotuloSituacaoEstagio,
  transicaoDocumentoPermitida,
  transicaoEstagioPermitida,
  transicoesDocumentoPermitidas,
  varianteSituacaoDocumento,
  varianteSituacaoEstagio,
  varianteSituacaoUsuario,
} from "./status";

import type { SituacaoDocumento, SituacaoEstagio, SituacaoUsuario } from "./types";

const variantesValidas = [
  "default",
  "secondary",
  "destructive",
  "success",
  "warning",
  "info",
  "outline",
  "neutro",
];

describe("metadados de situação", () => {
  it.each(ROTULOS_TODAS_SITUACOES.documento)(
    "a situação de documento %s tem rótulo, cor e ícone",
    (situacao) => {
      const meta = metadadoDocumento(situacao as SituacaoDocumento);

      expect(meta.rotulo.length).toBeGreaterThan(0);
      expect(variantesValidas).toContain(meta.variante);
      expect(meta.Icone).toBeDefined();
      expect(rotuloSituacaoDocumento(situacao as SituacaoDocumento)).toBe(meta.rotulo);
      expect(varianteSituacaoDocumento(situacao as SituacaoDocumento)).toBe(meta.variante);
      expect(iconeSituacaoDocumento(situacao as SituacaoDocumento)).toBe(meta.Icone);
    },
  );

  it.each(ROTULOS_TODAS_SITUACOES.estagio)(
    "a situação de estágio %s tem rótulo, cor e ícone",
    (s) => {
      const meta = metadadoEstagio(s as SituacaoEstagio);

      expect(meta.rotulo.length).toBeGreaterThan(0);
      expect(variantesValidas).toContain(meta.variante);
      expect(iconeSituacaoEstagio(s as SituacaoEstagio)).toBe(meta.Icone);
    },
  );

  it.each(ROTULOS_TODAS_SITUACOES.usuario)("a situação de usuário %s tem rótulo e cor", (s) => {
    const meta = metadadoUsuario(s as SituacaoUsuario);

    expect(meta.rotulo.length).toBeGreaterThan(0);
    expect(varianteSituacaoUsuario(s as SituacaoUsuario)).toBe(meta.variante);
  });

  it("cobre todas as situações declaradas nos tipos", () => {
    expect(Object.keys(METADADOS_SITUACAO.documento).sort()).toEqual(
      [
        "aprovado",
        "em_analise",
        "inativo",
        "indeferido",
        "rascunho",
        "registrada",
        "submetido",
      ].sort(),
    );
  });
});

describe("rótulo textual acompanha a cor", () => {
  it("nenhuma situação de documento usa apenas cor", () => {
    for (const [, meta] of Object.entries(METADADOS_SITUACAO.documento)) {
      expect(meta.rotulo.trim().length).toBeGreaterThan(2);
    }
  });

  it("nenhuma situação de estágio usa apenas cor", () => {
    for (const [, meta] of Object.entries(METADADOS_SITUACAO.estagio)) {
      expect(meta.rotulo.trim().length).toBeGreaterThan(2);
    }
  });
});

describe("transições de documento", () => {
  it.each([
    ["rascunho", "submetido", true],
    ["rascunho", "registrada", true],
    ["rascunho", "aprovado", false],
    ["submetido", "em_analise", true],
    ["submetido", "rascunho", false],
    ["em_analise", "aprovado", true],
    ["em_analise", "indeferido", true],
    ["em_analise", "rascunho", false],
    ["registrada", "inativo", true],
    ["registrada", "em_analise", false],
    ["aprovado", "em_analise", false],
    ["indeferido", "rascunho", true],
    ["inativo", "rascunho", false],
  ] as const)("de %s para %s é %s", (de, para, permitido) => {
    expect(transicaoDocumentoPermitida(de, para)).toBe(permitido);
  });

  it("não deixa documento inativo voltar a situation alguma", () => {
    expect(transicoesDocumentoPermitidas("inativo")).toEqual([]);
  });

  it("rascunho só avança para registro, submissão ou inativação", () => {
    expect(transicoesDocumentoPermitidas("rascunho").sort()).toEqual([
      "inativo",
      "registrada",
      "submetido",
    ]);
  });
});

describe("transições de estágio", () => {
  it.each([
    ["em_preparacao", "em_andamento", true],
    ["em_preparacao", "concluido", false],
    ["em_andamento", "concluido", true],
    ["em_andamento", "em_andamento", false],
    ["concluido", "em_andamento", true],
  ] as const)("de %s para %s é %s", (de, para, permitido) => {
    expect(transicaoEstagioPermitida(de, para)).toBe(permitido);
  });
});

describe("rótulos de papel", () => {
  it.each([
    ["aluno", "Aluno"],
    ["coordenador_estagio", "Coordenador de Estágio"],
    ["coordenador_curso", "Coordenador de Curso"],
    ["administrador", "Administrador"],
  ] as const)("traduz %s", (papel, esperado) => {
    expect(rotuloPapel(papel)).toBe(esperado);
  });
});

describe("rótulo de estágio", () => {
  it("traduz as duas situações", () => {
    expect(rotuloSituacaoEstagio("em_andamento")).toBe("Em andamento");
    expect(rotuloSituacaoEstagio("concluido")).toBe("Concluído");
    expect(varianteSituacaoEstagio("concluido")).toBe("success");
  });
});
