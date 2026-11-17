/**
 * Utilitários para editar o `word/document.xml` dos DOCX do Kit de Estágio
 * (change gerar-documentos-preenchidos). Usados por `marcar-modelos.mjs` para
 * trocar as linhas "____" por marcadores do docxtemplater sem perder a
 * formatação dos trechos vizinhos.
 */
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export function lerXml(texto) {
  return new DOMParser().parseFromString(texto, "text/xml");
}

export function escreverXml(doc) {
  return new XMLSerializer().serializeToString(doc);
}

function ancestral(no, nome) {
  let atual = no.parentNode;
  while (atual && atual.nodeName !== nome) atual = atual.parentNode;
  return atual;
}

/** Todos os parágrafos, em ordem de documento (inclusive os de caixas de texto). */
export function paragrafos(doc) {
  return Array.from(doc.getElementsByTagNameNS(W, "p"));
}

/** Nós `w:t` cujo parágrafo mais próximo é `p` (ignora parágrafos aninhados). */
export function textosDoParagrafo(p) {
  return Array.from(p.getElementsByTagNameNS(W, "t")).filter((t) => ancestral(t, "w:p") === p);
}

export function textoDoParagrafo(p) {
  return textosDoParagrafo(p)
    .map((t) => t.textContent)
    .join("");
}

function definirTexto(t, texto) {
  while (t.firstChild) t.removeChild(t.firstChild);
  t.appendChild(t.ownerDocument.createTextNode(texto));
  t.setAttribute("xml:space", "preserve");
}

/**
 * Substitui o intervalo [inicio, fim) do texto do parágrafo por `novo`. O texto
 * novo entra no nó em que o intervalo começa, preservando a formatação dele.
 */
function substituirIntervalo(p, inicio, fim, novo) {
  let posicao = 0;
  let inserido = false;

  for (const t of textosDoParagrafo(p)) {
    const texto = t.textContent;
    const a = posicao;
    const b = posicao + texto.length;
    posicao = b;

    // Inserção (intervalo vazio): no primeiro nó que contém a posição.
    // Troca: em todos os nós que se sobrepõem ao intervalo.
    const afeta = inicio === fim ? !inserido && a <= inicio && inicio <= b : a < fim && b > inicio;
    if (!afeta) continue;

    const antes = texto.slice(0, Math.max(inicio - a, 0));
    const depois = texto.slice(Math.min(fim - a, texto.length));

    definirTexto(t, inserido ? antes + depois : antes + novo + depois);
    inserido = true;
  }

  if (!inserido) throw new Error(`Intervalo ${inicio}-${fim} fora do parágrafo.`);
}

/**
 * Aplica as trocas em sequência: cada padrão é procurado a partir do fim da
 * troca anterior, de modo que a ordem das trocas segue a ordem das linhas.
 */
export function trocarNoParagrafo(p, trocas, rotulo) {
  let cursor = 0;

  for (const [padrao, novo] of trocas) {
    const texto = textoDoParagrafo(p);
    const regex =
      padrao instanceof RegExp
        ? new RegExp(padrao.source, padrao.flags.replace("g", "") + "g")
        : new RegExp(escaparRegex(padrao), "g");
    regex.lastIndex = cursor;
    const achado = regex.exec(texto);

    if (!achado) {
      throw new Error(
        `${rotulo}: padrão ${padrao} não encontrado após a posição ${cursor} em "${texto}".`,
      );
    }

    // `null` só avança: a linha fica em branco no modelo, para preenchimento à mão.
    if (novo === null) {
      cursor = achado.index + Math.max(achado[0].length, 1);
      continue;
    }

    substituirIntervalo(p, achado.index, achado.index + achado[0].length, novo);
    cursor = achado.index + novo.length;
  }
}

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Troca todo o texto do parágrafo; se ele não tiver texto, cria um trecho. */
export function definirTextoDoParagrafo(p, novo) {
  const textos = textosDoParagrafo(p);

  if (textos.length === 0) {
    const doc = p.ownerDocument;
    const r = doc.createElementNS(W, "w:r");
    const t = doc.createElementNS(W, "w:t");
    definirTexto(t, novo);
    r.appendChild(t);
    p.appendChild(r);
    return;
  }

  definirTexto(textos[0], novo);
  for (const t of textos.slice(1)) definirTexto(t, "");
}

/**
 * Prepara o parágrafo que recebe texto longo: alinhamento à esquerda (o
 * justificado estica a linha que termina em quebra) e sem negrito herdado da
 * linha "____" do Kit.
 */
export function prepararTextoLongo(p) {
  for (const nome of ["jc", "b", "bCs"]) {
    for (const no of Array.from(p.getElementsByTagNameNS(W, nome))) {
      if (nome === "jc" && no.getAttribute("w:val") !== "both") continue;
      no.parentNode.removeChild(no);
    }
  }
}

/** Tira o marcador de lista do parágrafo e zera o recuo herdado do estilo. */
export function removerMarcadorDeLista(p) {
  for (const nome of ["numPr", "ind"]) {
    for (const no of Array.from(p.getElementsByTagNameNS(W, nome))) no.parentNode.removeChild(no);
  }

  const pPr = Array.from(p.childNodes).find((no) => no.nodeName === "w:pPr");
  if (!pPr) return;
  const ind = p.ownerDocument.createElementNS(W, "w:ind");
  ind.setAttribute("w:left", "0");
  ind.setAttribute("w:firstLine", "0");
  const rPr = Array.from(pPr.childNodes).find((no) => no.nodeName === "w:rPr");
  pPr.insertBefore(ind, rPr ?? null);
}

export function removerParagrafo(p) {
  p.parentNode.removeChild(p);
}

/** Linhas de tabela (`w:tr`) com as células e o texto de cada uma. */
export function linhasDeTabela(doc) {
  return Array.from(doc.getElementsByTagNameNS(W, "tr")).map((tr) => {
    const celulas = Array.from(tr.childNodes).filter((no) => no.nodeName === "w:tc");
    return {
      tr,
      celulas,
      textos: celulas.map((tc) =>
        Array.from(tc.getElementsByTagNameNS(W, "p")).map(textoDoParagrafo).join(" ").trim(),
      ),
    };
  });
}

/** Escreve `texto` no primeiro parágrafo da célula. */
export function definirTextoDaCelula(tc, texto) {
  const p = tc.getElementsByTagNameNS(W, "p")[0];
  definirTextoDoParagrafo(p, texto);
}
