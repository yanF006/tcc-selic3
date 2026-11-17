// Lista os parágrafos e as linhas de tabela de um DOCX, com os índices usados
// em `marcar-modelos.mjs`. Uso: node scripts/modelos-docx/listar.mjs arquivo.docx
import { readFileSync } from "node:fs";
import PizZip from "pizzip";
import { lerXml, linhasDeTabela, paragrafos, textoDoParagrafo } from "./docx-xml.mjs";

const zip = new PizZip(readFileSync(process.argv[2]));
const doc = lerXml(zip.file("word/document.xml").asText());
paragrafos(doc).forEach((p, i) => {
  const texto = textoDoParagrafo(p);
  if (texto.trim()) console.log(`p${i}: ${texto.replace(/_{6,}/g, (m) => `_{${m.length}}`)}`);
});
if (process.argv[3] === "--tabelas") {
  linhasDeTabela(doc).forEach((l, i) =>
    console.log(`tr${i}: ${l.textos.map((t) => t.slice(0, 30)).join(" | ")}`),
  );
}
