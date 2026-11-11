<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Objetivo do Sistema

Trabalho de conclusão de curso técnico em Informática. Desenvolver um website para gerenciamento dos documentos de estágio para os cursos de licenciatura do IFRJ Campus Pinheiral.

## Variáveis de ambiente

Ao adicionar, remover ou alterar variáveis de ambiente, atualize `.env.example`
e `.env.vercel.example` conforme o ambiente aplicável. Identifique valores que
precisam ser substituídos, obrigatoriedade e padrões. Nunca grave credenciais
reais nos exemplos; mantenha o guia da Vercel no README coerente com o código.

## Git e Github

Sempre que uma alteração for feita, e o site esteja funcional, mesmo que incompleto, fazer commit e push.

## Aiven e Vercel

Quando uma mudança de configuração no Aiven ou no Vercel forem necessárias, alertar o usuário, pois só ele consegue realizar essas mudanças.