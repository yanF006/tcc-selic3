import { describe, expect, it } from "vitest";

import type { Papel, Usuario } from "@/lib/domain/types";

import { gruposPara, itemVisivel, itensPara, NAV } from "./nav";

function usuario(papeis: Papel[], extras: Partial<Usuario> = {}): Usuario {
  return {
    id: `usr-${papeis.join("-")}`,
    nome: "Usuário de Teste",
    email: "teste@ifrj.edu.br",
    papeis,
    situacao: "ativo",
    campus: "Pinheiral",
    criadoEm: "2026-01-01T00:00:00.000Z",
    ...extras,
  };
}

function hrefs(papeis: Papel[], extras: Partial<Usuario> = {}): string[] {
  return itensPara(usuario(papeis, extras)).map((item) => item.href);
}

describe("registro de navegação", () => {
  it("não mostra nada sem sessão ou com cadastro inativo", () => {
    expect(itensPara(null)).toEqual([]);
    expect(itensPara(usuario(["aluno"], { situacao: "inativo" }))).toEqual([]);
  });

  it("dá ao aluno somente Documentos, Estágio e Perfil", () => {
    expect(hrefs(["aluno"])).toEqual(["/documentos", "/estagio", "/perfil"]);
    expect(itemVisivel(usuario(["aluno"]), "/admin/usuarios")).toBe(false);
  });

  it("esconde a frequência de quem não é membro da Comissão de Estágio", () => {
    expect(hrefs(["coordenador_estagio"])).not.toContain("/coordenacao/frequencia");
    expect(hrefs(["coordenador_estagio"], { membroComissaoEstagio: true })).toContain(
      "/coordenacao/frequencia",
    );
    expect(hrefs(["coordenador_curso"], { membroComissaoEstagio: true })).not.toContain(
      "/coordenacao/frequencia",
    );
  });

  it("não mostra itens de administração para coordenadores", () => {
    const curso = hrefs(["coordenador_curso"]);

    expect(curso).toContain("/coordenacao/documentos");
    expect(curso).toContain("/coordenacao/estagios");
    expect(curso).toContain("/coordenacao/estatisticas");
    expect(curso).not.toContain("/admin/usuarios");
    expect(curso).not.toContain("/admin/convenios");
    expect(curso).not.toContain("/admin/matriculas");
    expect(curso).not.toContain("/documentos");
  });

  it("mantém item de navegação e guarda da rota em acordo", () => {
    // As permissões de cada rota ficam nos layouts de (aluno), (coordenacao) e
    // (admin); o registro de navegação não pode prometer acesso a quem a guarda
    // da rota recusa.
    const papeisDaRota = (href: string): Papel[] => {
      if (href.startsWith("/admin")) return ["administrador"];
      if (href.startsWith("/coordenacao")) {
        return ["coordenador_estagio", "coordenador_curso"];
      }
      // Área de gestão compartilhada entre coordenação e administração.
      if (href === "/solicitacoes") {
        return ["coordenador_estagio", "coordenador_curso", "administrador"];
      }

      return ["aluno"];
    };

    for (const item of NAV) {
      const exigidos = papeisDaRota(item.href);

      for (const papel of item.requiredRoles) {
        // O administrador satisfaz qualquer guarda (§4 do design).
        if (papel === "administrador") continue;

        expect(exigidos, `${item.href} × ${papel}`).toContain(papel);
      }
    }
  });

  it("dá ao administrador acesso a todos os itens registrados", () => {
    const admin = hrefs(["administrador"]);

    expect([...admin].sort()).toEqual(NAV.map((item) => item.href).sort());
    expect(hrefs(["administrador"])).toContain("/documentos");
    expect(hrefs(["administrador"])).toContain("/admin/usuarios");
  });

  it("mantém a ordem de exibição dentro de cada grupo", () => {
    const grupos = gruposPara(usuario(["administrador"]));

    expect(grupos.map((secao) => secao.grupo)).toEqual(["principal", "gestao", "administracao"]);
    expect(grupos[0].itens.map((item) => item.rotulo)).toEqual(["Documentos", "Estágio", "Perfil"]);
    expect(grupos[1].itens.map((item) => item.href)).toEqual([
      "/coordenacao/estagios",
      "/coordenacao/frequencia",
      "/coordenacao/documentos",
      "/solicitacoes",
      "/coordenacao/estatisticas",
    ]);
  });

  it("não deixa item de navegação sem papéis exigidos declarados", () => {
    for (const item of NAV) {
      expect(item.rotulo.length, item.href).toBeGreaterThan(0);
      expect(
        item.requiredRoles.length + (item.exigeComissaoDeEstagio ? 1 : 0),
        item.href,
      ).toBeGreaterThan(0);
      expect(item.href.startsWith("/"), item.href).toBe(true);
    }
  });
});
