import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("../../", import.meta.url));
const arquivoTrace = resolve(raiz, ".next/server/app/(catalogo)/documentos/[templateId]/baixar/route.js.nft.json");
const trace = JSON.parse(await readFile(arquivoTrace, "utf8"));
const arquivos = new Set(trace.files.map((arquivo) => resolve(dirname(arquivoTrace), arquivo)));
const checksums = JSON.parse(await readFile(resolve(raiz, "src/lib/templates/checksums-kit.json"), "utf8"));

for (const [nome, checksum] of Object.entries(checksums)) {
  const caminho = resolve(raiz, "Contexto/kit-estagio", nome);
  assert(arquivos.has(caminho), `Arquivo do Kit ausente do tracing de produção: ${nome}`);
  assert.equal(createHash("sha256").update(await readFile(caminho)).digest("hex"), checksum,
    `Checksum divergente no arquivo empacotado: ${nome}`);
}
console.log(`Build verificado: ${Object.keys(checksums).length} arquivos oficiais do Kit no tracing, com checksums válidos.`);
