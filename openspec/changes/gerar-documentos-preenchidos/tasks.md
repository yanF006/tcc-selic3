## 1. Base do gerador

- [x] 1.1 Instalar `docxtemplater` e `pizzip`. Verificação: `npm ls docxtemplater pizzip` lista as duas e `npm run typecheck` passa. Evidência: docxtemplater 3.71.1 e pizzip 3.3.0 instalados; `@xmldom/xmldom` entrou como devDependency do script de marcação. Typecheck passa.
- [x] 1.2 Criar `src/lib/documentos/gerar-docx.ts` (server-only), que lê `modelos/<templateId>.docx` e aplica `dadosDoModelo` com `nullGetter` vazio, e `dados-modelo.ts`, com textos formatados, `X` para rádio e checkbox, listas para as grades e campos de assinatura, instrução e externa omitidos. Verificação: teste unitário de `dadosDoModelo` com um descritor de exemplo. Evidência: `dados-modelo.test.ts` com 5 testes passando. `modelos-disponiveis.ts` guarda a lista dos 9 documentos, para a tela usar sem importar código de servidor.
- [x] 1.3 Criar o teste de cobertura `modelos.test.ts`. Para cada modelo, ele compila o arquivo, falha em marcador desconhecido, lista os campos preenchíveis do descritor sem marcador (com exceções explícitas), gera com valores de exemplo e confere que `word/document.xml` contém os valores e nenhum `{`. Verificação: o teste roda e falha, com mensagem clara, enquanto faltar um modelo. Evidência: `modelos.test.ts` com 28 testes. Retirar a exceção `justificativa` do Termo Aditivo faz o teste falhar, o que confirma a detecção.

## 2. Modelos marcados (cópias dos DOCX do Kit)

- [x] 2.1 Marcar o Formulário de Liberação, o Plano de Atividades e o Termo de Compromisso. Verificação: os casos dos três em `modelos.test.ts` passam. Evidência: a marcação é feita por script reproduzível (`scripts/modelos-docx/marcar-modelos.mjs`), não à mão no LibreOffice. Os casos dos três documentos passam.
- [x] 2.2 Marcar o Convênio de Estágio e o Termo Aditivo, deixando em branco a data do Termo de Compromisso no Termo Aditivo. Verificação: os casos passam, e o do Termo Aditivo confere que a data ficou em branco. Evidência: casos passam; o teste do Termo Aditivo confere `celebrado em _____/_____/____`.
- [x] 2.3 Marcar a Ficha de Acompanhamento e o Relatório Semestral, incluindo grades e escalas de avaliação. Verificação: os casos passam. Evidência: a Ficha tem 80 linhas da tabela marcadas, mais o total; o Relatório tem as 11 linhas de autoavaliação. Casos passam.
- [x] 2.4 Marcar o Requerimento para Aproveitamento de Horas e a Proposta de Atuação Pedagógica. Verificação: os casos passam e o teste cobre os 9 modelos. Evidência: casos passam; 9 modelos cobertos.

## 3. Ligação com o download

- [x] 3.1 Trocar a geração em `arquivoDoDocumento` por `gerar-docx.ts`. Recusar `pdf` na action e na rota `baixar-preenchido` com a mensagem "Download disponível apenas em DOCX.", e recusar a Ficha de Frequência. Verificação: os testes de `documentos-endereco.test.ts` e `templates.test.ts` foram ajustados e passam. Evidência: `templates.test.ts` e `documentos-endereco.test.ts` foram ajustados (recusa de pdf e DOCX com os valores) e passam.
- [x] 3.2 Remover o botão de PDF de `conteudo-documento.tsx` e não exibir o download para a Ficha de Frequência. Excluir `gerar-demo.ts` e `gerar-demo.test.ts`. Verificação: `grep -rn "gerar-demo\|gerarPdfDemo" src` não encontra nada. Evidência: grep sem resultados; o botão aparece só para documentos com modelo.
- [x] 3.3 Incluir `src/lib/documentos/modelos/**` em `outputFileTracingIncludes` para `/documentos/*/baixar-preenchido` e `/documentos/*`. Verificação: depois de `npm run build`, os `.docx` aparecem em `.next/server/**/*.nft.json` da rota. Evidência: depois do build, `page.js.nft.json` e `baixar-preenchido/route.js.nft.json` listam os modelos.

## 4. Fechamento

- [x] 4.1 E2E: baixar o Plano de Atividades preenchido em `e2e/` e conferir que o arquivo é DOCX válido e contém o nome do aluno. Verificação: `npm run test:e2e` passa. Evidência: novo teste em `e2e/documentos-preenchimento.spec.ts` passa. Suíte completa no build: 127 passam e 1 falha. A falha é `documentos.spec.ts` › "baixa a Lei de Estágio": cabeçalho `content-disposition` ausente na rota `/baixar`. Ela já falhava antes desta change (conferido com `git stash`) e fica fora do escopo.
- [x] 4.2 Atualizar o README (funcionalidades e "o que é simulado"), retirando a geração demonstrativa e o PDF. Rodar typecheck, lint, test:unit e build. Verificação: os quatro comandos passam. Commit e push. Evidência: README atualizado; typecheck, lint (só 1 aviso antigo), test:unit (666 de 666) e build passam.
- [ ] 4.3 Conferência visual: abrir no LibreOffice ou no Word um DOCX gerado de cada documento e comparar com o original do Kit. Registrar o resultado aqui; o responsável confirma no Preview da Vercel após o deploy. Verificação: registro com data neste arquivo.
- [ ] 4.4 Arquivar a change (sincronizar o delta em `openspec/specs/documentos-estagio`). Verificação: a pasta foi movida para `openspec/changes/archive/`.
