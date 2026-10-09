import { describe, expect, it } from "vitest";

import { gerarDocxDemo, gerarPdfDemo } from "./gerar-demo";

describe("gerarDocxDemo", () => {
  it("devolve um zip com as partes mínimas do OOXML e o texto informado", () => {
    const arquivo = gerarDocxDemo("Termo de Compromisso", ["Nome: Maria de Souza"]);

    // Assinatura de arquivo zip.
    expect(arquivo.subarray(0, 4).toString("latin1")).toBe("PK\u0003\u0004");

    const conteudo = arquivo.toString("utf8");

    expect(conteudo).toContain("word/document.xml");
    expect(conteudo).toContain("[Content_Types].xml");
    expect(conteudo).toContain("Termo de Compromisso");
    expect(conteudo).toContain("Nome: Maria de Souza");
  });

  it("escapa os caracteres reservados do XML", () => {
    const conteudo = gerarDocxDemo("Título", ["Maria & João <teste>"]).toString("utf8");

    expect(conteudo).toContain("Maria &amp; João &lt;teste&gt;");
    expect(conteudo).not.toContain("João <teste>");
  });
});

describe("gerarPdfDemo", () => {
  it("devolve um PDF de uma página com o texto informado", () => {
    const conteudo = gerarPdfDemo("Plano de Atividades", ["Atividade: docência"]).toString("latin1");

    expect(conteudo.startsWith("%PDF-1.4")).toBe(true);
    expect(conteudo.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(conteudo).toContain("Plano de Atividades");
    expect(conteudo).toContain("Atividade: docência");
    expect(conteudo).toContain("trailer");
  });
});
