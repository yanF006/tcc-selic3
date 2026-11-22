import { describe, expect, it } from "vitest";

import { dadosDoModelo, formatarData, LINHA_EM_BRANCO } from "./dados-modelo";
import type { DescriptorDocumento } from "@/lib/templates/descriptors";

const descriptor: DescriptorDocumento = {
  templateId: "tpl-exemplo",
  titulo: "Exemplo",
  descricao: "",
  preenchivel: true,
  secoes: [
    {
      id: "s",
      titulo: "Seção",
      campos: [
        { id: "nome", rotulo: "Nome", tipo: "texto", origem: "digitado" },
        { id: "cpf", rotulo: "CPF", tipo: "texto", origem: "aluno", mascara: "cpf" },
        { id: "inicio", rotulo: "Início", tipo: "data", origem: "estagio" },
        { id: "horas", rotulo: "Horas", tipo: "numero", origem: "digitado" },
        {
          id: "tipo",
          rotulo: "Tipo",
          tipo: "radio",
          origem: "digitado",
          opcoes: [
            { valor: "a", rotulo: "Opção A" },
            { valor: "b", rotulo: "Opção B" },
          ],
        },
        { id: "anexo", rotulo: "Anexo", tipo: "checkbox", origem: "digitado" },
        { id: "assinatura", rotulo: "Assinatura", tipo: "assinatura", origem: "digitado" },
        { id: "dica", rotulo: "Dica", tipo: "instrucao", origem: "literal" },
        {
          id: "lancamentos",
          rotulo: "Lançamentos",
          tipo: "grade",
          origem: "digitado",
          colunas: [
            { chave: "data", rotulo: "Data", tipo: "data" },
            { chave: "duracao", rotulo: "Duração", tipo: "numero" },
          ],
        },
      ],
    },
  ],
};

describe("dadosDoModelo", () => {
  const dados = dadosDoModelo(descriptor, {
    nome: "Maria de Souza",
    cpf: "12345678901",
    inicio: "2026-03-02",
    horas: 7.5,
    tipo: "b",
    anexo: true,
    lancamentos: [
      { data: "2026-03-02", duracao: 6 },
      { data: "03/03/2026", duracao: 4 },
    ],
  });

  it("formata texto, máscara, data e número", () => {
    expect(dados.nome).toBe("Maria de Souza");
    expect(dados.cpf).toBe("123.456.789-01");
    expect(dados.inicio).toBe("02/03/2026");
    expect(dados.inicio_dia).toBe("02");
    expect(dados.inicio_mes).toBe("março");
    expect(dados.inicio_ano).toBe("2026");
    expect(dados.horas).toBe("7,5");
  });

  it("marca rádio e checkbox com X", () => {
    expect(dados.tipo).toBe("Opção B");
    expect(dados.tipo__a).toBe(" ");
    expect(dados.tipo__b).toBe("X");
    expect(dados.anexo).toBe("X");
  });

  it("abre as linhas da grade e soma a coluna numérica", () => {
    expect(dados.lancamentos_1_data).toBe("02/03/2026");
    expect(dados.lancamentos_2_data).toBe("03/03/2026");
    expect(dados.lancamentos_2_duracao).toBe("4");
    expect(dados.lancamentos_total).toBe("10");
  });

  it("deixa linha para campo vazio e omite assinatura e instrução", () => {
    const vazio = dadosDoModelo(descriptor, {});

    expect(vazio.nome).toBe(LINHA_EM_BRANCO);
    expect(vazio.inicio_dia).toBe(LINHA_EM_BRANCO);
    expect(vazio.anexo).toBe(" ");
    expect(vazio).not.toHaveProperty("assinatura");
    expect(vazio).not.toHaveProperty("dica");
  });
});

describe("formatarData", () => {
  it("aceita ISO, data com hora, dd/mm/aaaa e só dígitos", () => {
    expect(formatarData("2026-03-02T10:00:00-03:00")).toBe("02/03/2026");
    expect(formatarData("02/03/2026")).toBe("02/03/2026");
    expect(formatarData("02032026")).toBe("02/03/2026");
    expect(formatarData(undefined)).toBe("");
  });
});
