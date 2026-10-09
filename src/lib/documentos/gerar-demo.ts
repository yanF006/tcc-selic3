import { Buffer } from "node:buffer";

/**
 * Arquivo de demonstração do download (D6, 8.14). A geração real com
 * docxtemplater só entra na mudança de backend; aqui a mesma interface devolve
 * um arquivo válido — um `.docx` montado na mão e um PDF de uma página — para
 * que o fluxo de download seja testável ponta a ponta sem antecipar o gerador
 * definitivo.
 */

export type FormatoDocumento = "docx" | "pdf";

/* ------------------------------------------------------------------ */
/* DOCX mínimo (zip sem compressão + OOXML essencial)                */
/* ------------------------------------------------------------------ */

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    tabela[n] = c >>> 0;
  }

  return tabela;
})();

function crc32(dados: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of dados) {
    crc = TABELA_CRC[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

interface ArquivoZip {
  nome: string;
  conteudo: Buffer;
}

/** Monta um zip sem compressão (método store); suficiente para os poucos XML do docx. */
function montarZip(arquivos: ArquivoZip[]): Buffer {
  const partes: Buffer[] = [];
  const centrais: Buffer[] = [];
  let deslocamento = 0;

  for (const arquivo of arquivos) {
    const nome = Buffer.from(arquivo.nome, "utf8");
    const crc = crc32(arquivo.conteudo);
    const tamanho = arquivo.conteudo.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(tamanho, 18);
    local.writeUInt32LE(tamanho, 22);
    local.writeUInt16LE(nome.length, 26);
    local.writeUInt16LE(0, 28);

    partes.push(local, nome, arquivo.conteudo);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(tamanho, 20);
    central.writeUInt32LE(tamanho, 24);
    central.writeUInt16LE(nome.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(deslocamento, 42);

    centrais.push(central, nome);

    deslocamento += local.length + nome.length + tamanho;
  }

  const corpoCentral = Buffer.concat(centrais);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(arquivos.length, 8);
  eocd.writeUInt16LE(arquivos.length, 10);
  eocd.writeUInt32LE(corpoCentral.length, 12);
  eocd.writeUInt32LE(deslocamento, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...partes, corpoCentral, eocd]);
}

function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function paragrafoXml(texto: string, negrito = false): string {
  const conteudo = `<w:r><w:rPr>${negrito ? "<w:b/>" : ""}</w:rPr><w:t xml:space="preserve">${escaparXml(texto)}</w:t></w:r>`;

  return `<w:p>${conteudo}</w:p>`;
}

export function gerarDocxDemo(titulo: string, linhas: string[]): Buffer {
  const corpo = [paragrafoXml(titulo, true), ...linhas.map((linha) => paragrafoXml(linha))].join("");

  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${corpo}</w:body></w:document>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `</Types>`;

  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`;

  return montarZip([
    { nome: "[Content_Types].xml", conteudo: Buffer.from(contentTypes, "utf8") },
    { nome: "_rels/.rels", conteudo: Buffer.from(rels, "utf8") },
    { nome: "word/document.xml", conteudo: Buffer.from(documentXml, "utf8") },
  ]);
}

/* ------------------------------------------------------------------ */
/* PDF mínimo de uma página                                          */
/* ------------------------------------------------------------------ */

function escaparPdf(texto: string): string {
  return texto.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function gerarPdfDemo(titulo: string, linhas: string[]): Buffer {
  const conteudoTexto = [
    "BT",
    "/F1 14 Tf",
    "72 760 Td",
    `(${escaparPdf(titulo)}) Tj`,
    "/F1 10 Tf",
    "0 -24 Td",
    ...linhas.flatMap((linha) => [`(${escaparPdf(linha)}) Tj`, "0 -16 Td"]),
    "ET",
  ].join("\n");

  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(conteudoTexto, "latin1")} >>\nstream\n${conteudoTexto}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  objetos.forEach((objeto, indice) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${indice + 1} 0 obj\n${objeto}\nendobj\n`;
  });

  const inicioXref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;

  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

export const TIPO_CONTEUDO: Record<FormatoDocumento, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};
