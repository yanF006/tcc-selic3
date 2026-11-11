import "server-only";

import type { DocumentoPreenchido as LinhaDocumento, PrismaClient } from "@/generated/prisma/client";
import type { DocumentoPreenchido } from "@/lib/domain/types";
import type { DescriptorDocumento } from "@/lib/templates/descriptors";
import { checksumDefinicao } from "@/lib/templates/manifesto";
import { ErroDeRegra } from "@/lib/domain/erros";

export type ClienteDocumentos = Pick<PrismaClient, "documentoPreenchido">;

export function paraDominioDocumento(linha: LinhaDocumento): DocumentoPreenchido {
  const snapshot = linha.definicaoSnapshot as unknown as DescriptorDocumento;
  if (!snapshot || snapshot.templateId !== linha.templateId || !Array.isArray(snapshot.secoes) || checksumDefinicao(snapshot) !== linha.definicaoChecksum) {
    throw new ErroDeRegra("A definição salva deste documento está indisponível.", "definicao_indisponivel");
  }
  return {
    id: linha.id, templateId: linha.templateId, alunoId: linha.alunoId, estagioId: linha.estagioId ?? undefined,
    versaoTemplate: linha.versaoTemplate, definicaoChecksum: linha.definicaoChecksum,
    definicaoSnapshot: structuredClone(snapshot), valores: structuredClone(linha.valores) as Record<string, unknown>,
    situacao: linha.situacao as DocumentoPreenchido["situacao"], criadoEm: linha.criadoEm.toISOString(), atualizadoEm: linha.atualizadoEm.toISOString(),
    inativadoEm: linha.inativadoEm?.toISOString(), registradoPorId: linha.registradoPorId ?? undefined,
    registradoEm: linha.registradoEm?.toISOString(), assinaturasConfirmadasPorId: linha.assinaturasConfirmadasPorId ?? undefined,
    assinaturasConfirmadasEm: linha.assinaturasConfirmadasEm?.toISOString(), correcaoAberta: linha.correcaoAberta,
  };
}

export async function buscarDocumento(cliente: ClienteDocumentos, id: string): Promise<DocumentoPreenchido | null> {
  const linha = await cliente.documentoPreenchido.findUnique({ where: { id } });
  return linha ? paraDominioDocumento(linha) : null;
}
