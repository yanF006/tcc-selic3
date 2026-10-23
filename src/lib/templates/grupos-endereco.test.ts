import { describe, expect, it } from "vitest";
import { DESCRITORES, camposDoTemplate } from "./descriptors";
import { esquemaEndereco } from "@/lib/domain/schemas";
import { validarValores } from "@/lib/services/documentos";

describe("inventário de grupos de endereço", () => {
  it("mapeia sete grupos de documentos, com dois CEPs nos dois templates compostos", () => {
    expect(DESCRITORES.flatMap((d) => d.gruposEndereco ?? [])).toHaveLength(7);
    for (const descritor of DESCRITORES) {
      const usados = new Set<string>();
      for (const grupo of descritor.gruposEndereco ?? []) {
        const campos = camposDoTemplate(descritor.templateId);
        expect(Object.keys(grupo.campos)).toHaveLength(7);
        for (const id of Object.values(grupo.campos)) {
          expect(usados.has(id)).toBe(false);
          usados.add(id);
          expect(campos.some((campo) => campo.id === id)).toBe(true);
        }
        expect(campos.find((c) => c.id === grupo.campos.cep)).toMatchObject({
          mascara: "cep",
          validacao: ["cep"],
        });
        expect(campos.find((c) => c.id === grupo.campos.numero)?.tipo).toBe("texto");
        expect(campos.find((c) => c.id === grupo.campos.complemento)?.obrigatorio).not.toBe(true);
      }
    }
    for (const id of ["tpl-formulario-liberacao", "tpl-relatorio-semestral"]) {
      const grupos = DESCRITORES.find((d) => d.templateId === id)!.gruposEndereco!;
      expect(grupos.map((g) => g.origemInicial)).toEqual(["aluno", "concedente"]);
    }
    for (const id of ["tpl-convenio-estagio", "tpl-termo-compromisso", "tpl-ficha-frequencia"]) {
      expect(DESCRITORES.find((d) => d.templateId === id)!.gruposEndereco![0].origemInicial).toBe(
        "concedente",
      );
    }
  });
  it("aceita número s/n e não exige sucesso da consulta", () => {
    expect(
      esquemaEndereco.safeParse({
        cep: "23940000",
        logradouro: "Estrada",
        numero: "s/n",
        bairro: "Centro",
        cidade: "Pinheiral",
        estado: "RJ",
      }).success,
    ).toBe(true);
    const problemas = validarValores("tpl-convenio-estagio", {
      cep: "23940-000",
      logradouro: "Estrada",
      numero: "s/n",
    });
    expect(problemas.some((p) => ["cep", "numero", "complemento"].includes(p.campo))).toBe(false);
  });
});
