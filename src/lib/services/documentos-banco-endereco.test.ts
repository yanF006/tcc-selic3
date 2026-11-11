import { expect, it } from "vitest";
import type { DocumentoPreenchido as LinhaDocumento, Prisma } from "@/generated/prisma/client";
import { paraDominioDocumento } from "@/lib/db/repositorios/documentos";
import { checksumDefinicao, definicaoKit } from "@/lib/templates/manifesto";
import { descritorDoDocumento } from "./documentos";

// A preparação relacional do endereço do titular é exercitada no MySQL por
// documentos-persistentes.integration.test.ts; reabrir não depende de hidratação.
function registro(): LinhaDocumento {
  const snapshot = definicaoKit("tpl-relatorio-semestral")!.descritor;
  snapshot.titulo = "Definição histórica salva";
  return {
    id: "doc-salvo", templateId: snapshot.templateId, alunoId: "titular", estagioId: "estagio",
    versaoTemplate: 1, definicaoChecksum: checksumDefinicao(snapshot),
    definicaoSnapshot: snapshot as unknown as Prisma.JsonValue,
    valores: { logradouro: "Endereço corrigido no documento", numero: "42", complemento: "Sala 2" },
    situacao: "rascunho", criadoEm: new Date("2026-11-10"), atualizadoEm: new Date("2026-11-10"),
    inativadoEm: null, registradoPorId: null, registradoEm: null,
    assinaturasConfirmadasPorId: null, assinaturasConfirmadasEm: null, correcaoAberta: false,
  };
}

it("reabre valores finais e a definição histórica sem reinterpretar pelo catálogo atual", () => {
  const linha = registro();
  const documento = paraDominioDocumento(linha);
  expect(documento.valores).toEqual({ logradouro: "Endereço corrigido no documento", numero: "42", complemento: "Sala 2" });
  expect(descritorDoDocumento(documento)?.titulo).toBe("Definição histórica salva");
  documento.valores.logradouro = "Alteração local";
  expect(paraDominioDocumento(linha).valores.logradouro).toBe("Endereço corrigido no documento");
});

it("recusa definição salva divergente em vez de usar a definição atual como fallback", () => {
  const linha = registro();
  linha.definicaoChecksum = "0".repeat(64);
  expect(() => paraDominioDocumento(linha)).toThrow(/definição salva/);
});
