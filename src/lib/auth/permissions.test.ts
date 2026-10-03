import { describe, expect, it } from "vitest";

import { rotuloPapel } from "@/lib/domain/status";
import type { Papel, Usuario } from "@/lib/domain/types";

import {
  areaDe,
  avaliarAcesso,
  podeAcessar,
  podeAcessarAlgum,
  participaDaComissaoDeEstagio,
  satisfazTodas,
} from "./permissions";

function usuario(papeis: Papel[], situacao: Usuario["situacao"] = "ativo"): Usuario {
  return {
    id: `usr-${papeis.join("-")}`,
    nome: "Usuário de Teste",
    email: "teste@ifrj.edu.br",
    papeis,
    situacao,
    campus: "Pinheiral",
    criadoEm: "2026-01-01T00:00:00.000Z",
  };
}

describe("matriz de autorização", () => {
  it("nega acesso a quem não tem sessão", () => {
    expect(podeAcessar(null, [])).toBe(false);
    expect(avaliarAcesso(null, ["aluno"])).toEqual({
      permitido: false,
      motivo: "sem_sessao",
    });
  });

  it("exige o conjunto de papéis informado", () => {
    expect(podeAcessar(usuario(["aluno"]), ["aluno"])).toBe(true);
    expect(podeAcessar(usuario(["aluno"]), ["aluno", "coordenador_curso"])).toBe(false);
    expect(podeAcessar(usuario(["aluno"]), [])).toBe(true);
    expect(satisfazTodas(["coordenador_curso"], ["aluno"])).toBe(false);
  });

  it("dá ao administrador acesso a qualquer área", () => {
    const admin = usuario(["administrador"]);

    expect(podeAcessar(admin, ["aluno"])).toBe(true);
    expect(podeAcessar(admin, ["coordenador_estagio"])).toBe(true);
    expect(podeAcessar(admin, ["coordenador_curso", "administrador"])).toBe(true);
    expect(avaliarAcesso(admin, ["aluno"])).toEqual({ permitido: true });
  });

  it("nega acesso a cadastro inativo ou pendente, mesmo com o papel certo", () => {
    expect(podeAcessar(usuario(["aluno"], "inativo"), ["aluno"])).toBe(false);
    expect(podeAcessar(usuario(["aluno"], "pendente"), ["aluno"])).toBe(false);
    expect(avaliarAcesso(usuario(["aluno"], "inativo"), ["aluno"])).toEqual({
      permitido: false,
      motivo: "cadastro_inativo",
    });
  });

  it("distingue motivo de papel insuficiente", () => {
    expect(avaliarAcesso(usuario(["coordenador_curso"]), ["administrador"])).toEqual({
      permitido: false,
      motivo: "papel_insuficiente",
    });
  });

  it("aceita qualquer um dos papéis com podeAcessarAlgum", () => {
    const aluno = usuario(["aluno"]);

    expect(podeAcessarAlgum(aluno, ["coordenador_estagio", "aluno"])).toBe(true);
    expect(podeAcessarAlgum(aluno, ["coordenador_estagio"])).toBe(false);
    expect(podeAcessarAlgum(null, ["aluno"])).toBe(false);
  });

  it("trata a comissão de estágio como condição do coordenador de estágio", () => {
    const semComissao = usuario(["coordenador_estagio"]);

    expect(participaDaComissaoDeEstagio(semComissao)).toBe(false);
    expect(participaDaComissaoDeEstagio({ ...semComissao, membroComissaoEstagio: true })).toBe(
      true,
    );
    expect(
      participaDaComissaoDeEstagio({
        ...usuario(["coordenador_curso"]),
        membroComissaoEstagio: true,
      }),
    ).toBe(false);
    expect(participaDaComissaoDeEstagio(null)).toBe(false);
  });

  it("classifica a área inicial de cada papel", () => {
    expect(areaDe(usuario(["aluno"]))).toBe("aluno");
    expect(areaDe(usuario(["coordenador_estagio"]))).toBe("coordenacao");
    expect(areaDe(usuario(["coordenador_curso"]))).toBe("coordenacao");
    expect(areaDe(usuario(["administrador"]))).toBe("admin");
    expect(areaDe(usuario(["administrador", "aluno"]))).toBe("admin");
    expect(areaDe(null)).toBe(null);
    expect(areaDe(usuario(["aluno"], "inativo"))).toBe(null);
  });

  it("usa os quatro papéis canônicos", () => {
    expect(rotuloPapel("aluno")).toBe("Aluno");
    expect(rotuloPapel("coordenador_estagio")).toBe("Coordenador de Estágio");
    expect(rotuloPapel("coordenador_curso")).toBe("Coordenador de Curso");
    expect(rotuloPapel("administrador")).toBe("Administrador");
  });
});
