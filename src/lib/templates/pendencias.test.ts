import { describe, expect, it } from "vitest";

import { descritorPorTemplate } from "./descriptors";
import { pendenciasDoDocumento } from "./pendencias";

describe("pendenciasDoDocumento", () => {
  const termo = descritorPorTemplate("tpl-termo-compromisso")!;

  it("lista os campos digitáveis obrigatórios ainda vazios", () => {
    const pendencias = pendenciasDoDocumento(termo, {});

    expect(pendencias).toContain("Seguradora");
    expect(pendencias).toContain("Carga horária semanal");
    // Dados automáticos e assinaturas não bloqueiam o avanço.
    expect(pendencias).not.toContain("Estagiário(a)");
  });

  it("aponta número fora da faixa e telefone em formato inválido", () => {
    const pendencias = pendenciasDoDocumento(termo, {
      cargaHorariaSemanal: 99,
      telefone: "(24) 33",
    });

    expect(pendencias).toContain("Carga horária semanal");
    expect(pendencias).toContain("Telefone");
  });

  it("não exige o telefone fixo do aluno no Formulário de Liberação", () => {
    const liberacao = descritorPorTemplate("tpl-formulario-liberacao")!;

    expect(pendenciasDoDocumento(liberacao, {})).not.toContain("Telefone");
  });
});
