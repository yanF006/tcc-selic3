/**
 * Gera os modelos marcados do docxtemplater a partir dos DOCX do Kit de Estágio
 * (change gerar-documentos-preenchidos).
 *
 * Cada modelo é uma cópia do arquivo do Kit em que as linhas "____" e os
 * parênteses "(   )" deram lugar a marcadores `{id}` com os ids dos descritores
 * (`src/lib/templates/descriptors.ts`). Os nomes derivados seguem
 * `src/lib/documentos/dados-modelo.ts`:
 *   - `{campo__opcao}`: "X" na opção marcada de rádio;
 *   - `{campo_dia}`, `{campo_mes}`, `{campo_ano}`: partes de uma data;
 *   - `{grade_N_coluna}` e `{grade_total}`: linhas de grade.
 * Linhas sem campo no descritor (assinaturas, local e data da assinatura etc.)
 * ficam como no Kit, para preenchimento à mão.
 *
 * Uso: node scripts/modelos-docx/marcar-modelos.mjs
 * Os índices `pN` e `trN` vêm de `node scripts/modelos-docx/listar.mjs <docx> --tabelas`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import {
  definirTextoDaCelula,
  definirTextoDoParagrafo,
  escreverXml,
  lerXml,
  linhasDeTabela,
  paragrafos,
  prepararTextoLongo,
  removerMarcadorDeLista,
  removerParagrafo,
  trocarNoParagrafo,
} from "./docx-xml.mjs";

const KIT = "Contexto/kit-estagio";
const DESTINO = "src/lib/documentos/modelos";

const L = /_+/;
const DATA = /_+\s*\/\s*_+\s*\/\s*_+/;
const PAR = /\(\s*\)/;
const PULA = null;

const radio = (id, valor) => `( {${id}__${valor}} )`;
const avaliacao = (n) =>
  ["otimo", "bom", "regular", "insuficiente"].map((v) => `{autoavaliacao_${n}__${v}}`);

/**
 * Operações por documento:
 *   trocas: { pN: [[padrão, marcador | null], ...] } — em sequência no parágrafo;
 *   textos: { pN: "texto" } — substitui o parágrafo inteiro;
 *   remover: [N, ...] — instruções do Kit que o descritor descarta;
 *   celulas: { trN: { indiceCelula: "texto" } }.
 */
const MODELOS = {
  "tpl-formulario-liberacao": {
    arquivo: "04 - Formulario de Liberacao Licenciatura.docx",
    trocas: {
      3: [[L, "{curso}"]],
      7: [[L, "{nomeCompleto}"]],
      8: [[L, "{turmaSemestreAno}"]],
      9: [[L, "{enderecoAluno}"]],
      10: [
        [L, "{bairroAluno} {cidadeAluno} {ufAluno}"],
        [L, "{cepAluno}"],
      ],
      11: [
        [L, "{telefoneAluno}"],
        [L, "{celularAluno}"],
      ],
      12: [[L, "{emailAluno}"]],
      14: [[L, "{localEstagio}"]],
      15: [[L, "{enderecoLocal}"]],
      16: [[L, "{supervisor}"]],
      17: [[L, "{telefoneSupervisor}"]],
      19: [[L, "{orientador}"]],
      29: [
        [PAR, radio("planoDeAcordo", "sim")],
        [PAR, radio("planoDeAcordo", "nao")],
      ],
      30: [
        [L, "{consideracoes}"],
        [L, ""],
      ],
      32: [
        [L, PULA],
        [L, "{dataParecer_dia}"],
        [L, "{dataParecer_mes}"],
        [L, "{dataParecer_ano}"],
      ],
    },
  },
  "tpl-plano-atividades": {
    arquivo: "05 - Plano de atividades de estágio.docx",
    trocas: {
      5: [
        [PAR, radio("tipoAtividade", "estagio")],
        [PAR, radio("tipoAtividade", "projeto_monitoria_pratica")],
      ],
      8: [[L, "{nomeCompleto}"]],
      9: [[DATA, "{dataNascimento}"]],
      10: [[L, "{curso}"]],
      11: [
        [/RG:\s*/, "RG: {rg}   "],
        [/CPF:\s*/, "CPF: {cpf}"],
      ],
      13: [[L, "{instituicao}"]],
      14: [[DATA, "{dataInicioPrevista}"]],
      15: [[DATA, "{dataFimPrevista}"]],
      16: [[L, "{supervisor}"]],
      17: [[L, "{orientador}"]],
      20: [[L, "{atividades}"]],
    },
  },
  "tpl-termo-compromisso": {
    arquivo: "06 - Termo de compromisso. Licenciatura.docx",
    trocas: {
      5: [[L, "{instituicao}"]],
      6: [[L, "{endereco}"]],
      7: [
        [L, "{bairro}"],
        [L, "{cidade}"],
      ],
      8: [
        [L, "{cep}"],
        [L, "{telefone}"],
        [L, "{fax}"],
      ],
      9: [[L, "{email}"]],
      10: [[L, "{nomeDiretor}"]],
      12: [[L, "{nomeCompleto}"]],
      13: [
        [L, "{matricula}"],
        [L, "{curso}"],
      ],
      14: [
        [DATA, "{dataNascimento}"],
        [L, "{cpf}"],
      ],
      20: [
        [DATA, "{dataInicio}"],
        [DATA, "{dataFim}"],
      ],
      23: [
        [L, "{instituicao}"],
        [L, "{cnpj}"],
        [L, "{responsavel}"],
        [L, "{nomeCompleto}"],
        [L, "{curso}"],
      ],
      28: [
        [L, "{cargaHorariaTotal}"],
        [DATA, "{dataInicio}"],
        [DATA, "{dataFim}"],
      ],
    },
  },
  "tpl-convenio-estagio": {
    arquivo: "03 - Convenio de estagio - Campus Pinheiral.docx",
    trocas: {
      3: [
        [L, "{razaoSocial}"],
        [L, "{endereco}"],
        [L, "{bairro}"],
        [L, "{cidade}"],
        [L, "{cep}"],
        [L, "{telefone}"],
        [L, "{ramal}"],
        [L, "{fax}"],
        [L, "{email}"],
        [L, PULA],
        [L, "{cnpj}"],
        [L, "{ramoAtividade}"],
        [L, "{responsavel}"],
      ],
      4: [
        [L, "{identidade}"],
        [L, "{cic}"],
        [L, "{cargo}"],
      ],
    },
  },
  "tpl-termo-aditivo": {
    arquivo: "11 - EXTRA - Termo aditivo.docx",
    trocas: {
      // A data do Termo de Compromisso fica em branco: é preenchida na assinatura.
      7: [
        [/(?<=aluno\(a\) )_+/, "{aluno}"],
        [/(?<=Curso de )_+/, "{curso}"],
        [/(?<=do )_+(?= semestre)/, "{semestre}"],
        [/(?<=turma )_+/, "{turma}"],
        [/(?<=Instituição )_+/, "{instituicao}"],
      ],
      8: [
        [/(?<=até )_+/, "{novoTermino}"],
        [/_+(?= \()/, "{vias}"],
      ],
    },
  },
  "tpl-ficha-acompanhamento": {
    arquivo: "07 - Ficha de Acompanhamento de Estagio.docx",
    trocas: {
      3: [[L, "{instituicao}"]],
      4: [[L, "{supervisor}"]],
      5: [[L, "{aluno}"]],
      6: [
        [L, "{curso}"],
        [L, "{turma}"],
        [L, "{anoSemestre}"],
      ],
      7: [
        [DATA, "{dataInicio}"],
        [DATA, "{dataFim}"],
      ],
    },
    celulas: Object.assign(
      Object.fromEntries(
        Array.from({ length: 80 }, (_, i) => [
          i + 1,
          Object.fromEntries(
            ["data", "entrada", "saida", "duracao"].map((coluna, c) => [
              c + 1,
              `{lancamentos_${i + 1}_${coluna}}`,
            ]),
          ),
        ]),
      ),
      { 82: { 4: "{lancamentos_total}" } },
    ),
  },
  "tpl-relatorio-semestral": {
    arquivo: "09 - Relatorio Semestral de Estagio 2019.docx",
    trocas: {
      4: [[L, "{nomeCompleto}"]],
      20: [[L, "{orientador}"]],
      40: [[/NOME:\s*/, "NOME: {nomeCompleto}"]],
      41: [
        [L, "{telefone}"],
        [/E-MAIL:\s*/, "E-MAIL: {email}"],
      ],
      42: [[/ENDEREÇO:\s*/, "ENDEREÇO: {endereco}"]],
      43: [
        [L, "{bairro}"],
        [L, "{cidade}"],
        [/CEP:\s*/, "CEP: {cep}"],
      ],
      44: [
        [L, "{curso}"],
        [L, "{turma}"],
        [/SEMESTRE:\s*/, "SEMESTRE: {anoSemestre}"],
      ],
      46: [[/INSTITUIÇÃO:\s*/, "INSTITUIÇÃO: {instituicao}"]],
      47: [[/ENDEREÇO:\s*/, "ENDEREÇO: {instituicaoEndereco}"]],
      48: [
        [L, "{instituicaoTelefone}"],
        [/E-MAIL:\s*/, "E-MAIL: {instituicaoEmail}"],
      ],
      49: [[/ESTAGIÁRIO:\s*/, "ESTAGIÁRIO: {responsavel}"]],
      52: [[/ESTÁGIO:\s*$/, "ESTÁGIO: {supervisor} – {formacaoSupervisor}"]],
      55: [[/ESTÁGIO:\s*$/, "ESTÁGIO: {orientador}"]],
    },
    textos: {
      61: "{descricaoEmpresa}",
      66: "{objetivos}",
      70: "{desenvolvimento}",
      74: "{dificuldades}",
      75: "",
      79: "{consideracoesFinais}",
      80: "",
    },
    celulas: Object.fromEntries(
      Array.from({ length: 11 }, (_, i) => [
        i + 1,
        Object.fromEntries(avaliacao(i + 1).map((marcador, c) => [c + 2, marcador])),
      ]),
    ),
  },
  "tpl-requerimento-aproveitamento": {
    arquivo: "10 - EXTRA -  Requerimento para Aproveitamento de horas Licenciatura.docx",
    trocas: {
      3: [
        [L, "{nomeCompleto}"],
        [L, "{periodo}"],
      ],
      // A lista aparece duas vezes no XML (caixa de texto e alternativa de compatibilidade).
      ...Object.fromEntries(
        [12, 13, 14, 15, 16, 18, 19, 20, 21, 22].map((p) => [
          p,
          [[/^/, `({comprovante_${p < 17 ? p - 11 : p - 17}}) `]],
        ]),
      ),
      41: [[L, "{consideracoes}"]],
      44: [
        [PAR, radio("decisao", "deferido")],
        [PAR, radio("decisao", "indeferido")],
      ],
    },
    textos: { 42: "" },
    // O "(X)" alonga a lista: a caixa de texto ganha duas linhas de altura.
    ajustesXml: [
      ['cy="1042670"', 'cy="1360170"'],
      ["height:82.1pt", "height:107.1pt"],
      // A linha horizontal abaixo da caixa desce a mesma distância.
      ["<wp:posOffset>1260475</wp:posOffset>", "<wp:posOffset>1577975</wp:posOffset>"],
      ["margin-top:99.25pt", "margin-top:124.25pt"],
    ],
    celulas: {
      1: { 1: "{parecer_plano__sim}", 2: "{parecer_plano__nao}" },
      2: { 1: "{parecer_contextualizacao__sim}", 2: "{parecer_contextualizacao__nao}" },
      3: { 1: "{parecer_itinerario__sim}", 2: "{parecer_itinerario__nao}" },
    },
  },
  "tpl-proposta-atuacao-pedagogica": {
    arquivo: "12 - Proposta de Atuação Pedagógica_note_ago24.docx",
    trocas: {
      8: [[/Nome do aluno/, "{nomeCompleto}"]],
      10: [[/Nome do aluno/, "{nomeCompleto}"]],
      27: [[/\[Inserir o título da intervenção\]/, "{titulo}"]],
    },
    textos: {
      32: "{introducao}",
      38: "{objetivos}",
      51: "{fundamentacao}",
      58: "{metodologia}",
      68: "{recursos}",
      76: "{avaliacao}",
      88: "{resultados}",
      94: "{consideracoes}",
      99: "{referencias}",
    },
    // Orientações e exemplos do Kit: o descritor as trata como instrução.
    remover: [
      29, 34, 36, 41, 43, 45, 46, 47, 53, 60, 62, 63, 64, 65, 71, 73, 79, 81, 82, 83, 84, 90, 96,
    ],
  },
};

function marcar(templateId, definicao) {
  const origem = path.join(KIT, definicao.arquivo);
  const zip = new PizZip(readFileSync(origem));
  let xml = zip.file("word/document.xml").asText();
  for (const [de, para] of definicao.ajustesXml ?? []) {
    if (!xml.includes(de)) throw new Error(`${templateId}: ajuste "${de}" não encontrado.`);
    xml = xml.split(de).join(para);
  }
  const doc = lerXml(xml);
  const ps = paragrafos(doc);
  const linhas = linhasDeTabela(doc);

  for (const [indice, trocas] of Object.entries(definicao.trocas ?? {})) {
    trocarNoParagrafo(ps[Number(indice)], trocas, `${templateId} p${indice}`);
  }

  for (const [indice, texto] of Object.entries(definicao.textos ?? {})) {
    definirTextoDoParagrafo(ps[Number(indice)], texto);
    if (texto) prepararTextoLongo(ps[Number(indice)]);
  }

  for (const [linha, celulas] of Object.entries(definicao.celulas ?? {})) {
    const { celulas: tcs } = linhas[Number(linha)];
    for (const [celula, texto] of Object.entries(celulas)) {
      definirTextoDaCelula(tcs[Number(celula)], texto);
    }
  }

  for (const indice of definicao.semMarcador ?? []) removerMarcadorDeLista(ps[indice]);
  for (const indice of definicao.remover ?? []) removerParagrafo(ps[indice]);

  zip.file("word/document.xml", escreverXml(doc));
  const destino = path.join(DESTINO, `${templateId}.docx`);
  writeFileSync(destino, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`${destino} ← ${definicao.arquivo}`);
}

mkdirSync(DESTINO, { recursive: true });
const filtro = process.argv.slice(2);
for (const [templateId, definicao] of Object.entries(MODELOS)) {
  if (filtro.length === 0 || filtro.includes(templateId)) marcar(templateId, definicao);
}
