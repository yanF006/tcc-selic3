/** Marcador de checksum de anexo cujo conteúdo foi removido após a exclusão de dados pessoais. */
export const CHECKSUM_ANEXO_REMOVIDO = "removido";
export const LIMITE_ARQUIVO_BYTES = 4 * 1024 * 1024;
export type FinalidadeArquivo = "assinado" | "comprovante";

export interface MetadadosArquivo {
  id: string;
  documentoId: string;
  nome: string;
  mimeType: string;
  finalidade: FinalidadeArquivo;
  tamanhoBytes: number;
  checksum: string;
  autorId: string;
  criadoEm: string;
}

export const TIPOS_ARQUIVO = {
  assinado: ["application/pdf"],
  comprovante: ["application/pdf", "image/jpeg", "image/png"],
} as const;
