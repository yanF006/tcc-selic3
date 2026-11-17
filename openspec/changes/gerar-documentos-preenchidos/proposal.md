## Why

O download dos documentos preenchidos ainda devolve arquivos demonstrativos
(`src/lib/documentos/gerar-demo.ts`): um DOCX montado à mão e um PDF de uma
página com a lista "rótulo: valor". Esses arquivos não seguem o layout do Kit de
Estágio e não servem para coletar as assinaturas externas. Gerar o documento
oficial preenchido é a principal entrega que falta no sistema.

## What Changes

- Criar, a partir dos DOCX do Kit (`Contexto/kit-estagio`), um **modelo marcado**
  para cada um dos 9 documentos preenchíveis no sistema. Nos modelos, as linhas
  `____` dão lugar a marcadores `{campo}` com os ids dos descritores.
- Gerar o DOCX oficial preenchido com **docxtemplater** + **PizZip** (bibliotecas
  JavaScript, executadas no servidor), reaproveitando os valores salvos e a
  validação de campos obrigatórios que já existem.
- **BREAKING (escopo):** remover o download em PDF e o gerador demonstrativo. Quem
  precisar de PDF abre o DOCX no Word ou LibreOffice e exporta. A página de
  impressão continua como conferência, sem mudança.
- Um teste por modelo confere que todo marcador existe no descritor e que o
  arquivo gerado contém os valores informados.

Documentos cobertos: Formulário de Liberação, Plano de Atividades, Convênio de
Estágio, Termo de Compromisso, Ficha de Acompanhamento, Relatório Semestral,
Requerimento para Aproveitamento de Horas, Termo Aditivo e Proposta de Atuação
Pedagógica.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `documentos-estagio`: o requisito "Download do documento preenchido" passa a
  exigir o DOCX no layout oficial do Kit e deixa de exigir PDF; a Ficha de
  Frequência e Avaliação fica sem geração de arquivo.

## Impact

- Dependências novas: `docxtemplater` e `pizzip`.
- Código: `src/lib/documentos/` (gerador e modelos), a server action de download,
  a rota `baixar-preenchido`, o botão de PDF em `conteudo-documento.tsx` e
  `next.config.ts` (inclusão dos modelos no build da Vercel).
- Removidos: `gerar-demo.ts` e seu teste.
- README: a seção de documentos deixa de citar arquivos demonstrativos.
- Nenhuma variável de ambiente nem configuração no Aiven ou na Vercel.

## Fora de escopo

- PDF gerado pelo sistema, seja com layout oficial ou simplificado.
- Ficha de Frequência e Avaliação: chega preenchida e assinada pela concedente e
  é apenas registrada.
- Lei de Estágio e Regulamento: continuam como download fixo.
- Editor ou versionamento de modelos pelo administrador.
- Assinatura digital: as assinaturas continuam externas ao sistema.
- Reprodução pixel a pixel: pequenas diferenças de quebra de linha em relação ao
  original são aceitas.
