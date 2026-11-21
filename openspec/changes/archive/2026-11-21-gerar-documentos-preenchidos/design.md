## Context

O download (`baixarDocumentoAction` e a rota `baixar-preenchido`) chama
`arquivoDoDocumento` (`src/lib/documentos/baixar-documento.ts`). Essa função já
valida os obrigatórios e depois monta um arquivo demonstrativo. Os descritores
(`src/lib/templates/descriptors.ts`) definem os campos de cada documento, com ids
estáveis e tipos texto, data, número, textarea, rádio, checkbox, grade, fixo,
instrução, assinatura e externa. Os DOCX do Kit não têm marcadores: os espaços de
preenchimento são linhas `____` e parênteses `(   )`.

## Goals / Non-Goals

**Goals:** DOCX no layout oficial para os 9 documentos, reaproveitando validação,
autorização e valores salvos. **Non-Goals:** PDF, editor de modelos, versões
antigas de modelo.

## Decisions

1. **docxtemplater + PizZip sobre modelos marcados à mão.** Os modelos ficam
   versionados em `src/lib/documentos/modelos/<templateId>.docx`, como cópias dos
   arquivos do Kit em que as linhas `____` foram trocadas por `{id_do_campo}`. A
   marcação é feita no LibreOffice ou no Word.
   *Alternativa descartada:* biblioteca `docx` montando o documento por código.
   Exigiria redesenhar os 9 layouts e ficaria menos fiel.
   *Alternativa descartada:* converter HTML para DOCX. A fidelidade ao layout é
   baixa.

2. **Dados do modelo em uma função só.** `dadosDoModelo(descriptor, valores)`
   devolve um objeto plano:
   - textos e datas já formatados (reaproveitando as máscaras e
     `valores-legiveis.ts`);
   - rádio e checkbox como `{campo_opcao}` igual a `X` ou vazio, para os `(   )`;
   - grades como listas para laços `{#campo}…{/campo}`;
   - assinatura, instrução e externa omitidos, deixando o espaço em branco.

   O docxtemplater roda com `nullGetter` que devolve vazio, para um campo
   opcional não aparecer como "undefined".

3. **Sem PDF.** Converter DOCX em PDF com fidelidade exige LibreOffice ou um
   serviço externo, e nenhum dos dois roda na função serverless da Vercel sem
   custo ou configuração. O botão de PDF sai, a action e a rota recusam
   `formato=pdf` e `gerar-demo.ts` é removido.

4. **Um modelo por documento (versão vigente).** O Kit é fixo. Documentos salvos
   com `versaoTemplate` anterior usam o mesmo modelo, já que os ids de campo não
   mudaram entre as versões `.doc` e `.docx` do Convênio e do Termo. Isso será
   confirmado no teste de cobertura.

5. **Arquivos no build da Vercel.** Os modelos são lidos com `fs`, a partir de
   `process.cwd()`. Por isso entram em `outputFileTracingIncludes`, para a rota
   `baixar-preenchido` e para a página do documento, onde roda a server action.

## Risks / Trade-offs

- **Marcador quebrado em vários `<w:r>` pelo Word.** O docxtemplater gera erro
  de template. Mitigação: o teste de cada modelo compila o arquivo e falha com
  a mensagem do docxtemplater. Ao marcar, digitar cada marcador de uma vez,
  sem formatação no meio.
- **Campo do descritor sem lugar no modelo.** Mitigação: o teste lista os campos
  preenchíveis do descritor que não aparecem como marcador. Exceções
  intencionais ficam numa lista explícita no próprio teste.
- **Textos longos (textarea) podem mudar a paginação.** Aceito: a fidelidade é
  de conteúdo e estrutura, não pixel a pixel.
- **Remover o PDF muda um requisito vigente.** Registrado como MODIFIED na spec
  e combinado com o responsável.
