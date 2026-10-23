# Verificação da implementação

Data: 2026-10-23. Change: `integrar-viacep-busca-endereco` (`spec-driven`).

## Resultados

| Verificação | Resultado |
| --- | --- |
| `npm run test:unit` | 32 arquivos aprovados; 496 testes aprovados. |
| `DATABASE_URL= npm run test:e2e` | Chromium: 100 testes aprovados; 1 ignorado pela flag do seletor de papel desligada. |
| `npm run typecheck` | Tipos de rotas gerados e TypeScript aprovado. |
| `npm run lint` | ESLint aprovado. |
| `openspec validate "integrar-viacep-busca-endereco" --type change --strict` | Aprovado. |
| `openspec validate "frontend-website" --type change --strict` | Aprovado após compatibilização dos requisitos de endereço. |
| `git diff --check` | Aprovado. |

Os E2E foram executados com servidor local recém-iniciado e `DATABASE_URL`
vazia. A rede externa é controlada nos testes do adaptador/rota e interceptada
no navegador pelos E2E. O teste da hidratação usa a implementação de persistência
com cliente de banco simulado, sem conexão com o banco de produção.

## Evidências por camada

- `src/lib/services/endereco.test.ts`: normalização, validação sem rede,
  mapeamento ViaCEP, respostas parciais, CEP inexistente, contrato HTTP,
  falhas de transporte/conteúdo, timeout e cancelamento.
- `src/hooks/use-consulta-endereco.test.tsx`: disparo por evento, consulta
  condicionada à edição, revisões manuais, respostas fora de ordem, ciclo
  CEP A → B → A, invalidação e instâncias independentes.
- `src/lib/templates/grupos-endereco.test.ts`: sete grupos de documentos,
  mapeamentos sem sobreposição, máscaras, número textual e complemento opcional.
- `src/lib/services/documentos-banco-endereco.test.ts`: hidratação do cadastro
  antes da preparação do documento e resolução do titular para autor coordenador,
  sem consulta externa na carga inicial.
- `src/lib/services/documentos-endereco.test.ts`: prioridade dos valores
  salvos, compatibilidade legada, autorização, submissão, impressão e download.
- `src/components/formularios/enderecos-pessoais.test.tsx`: cadastro e perfil,
  envio manual durante consulta pendente/após falha e reabertura do perfil.
- `src/components/documentos/enderecos-integracao.test.tsx`: os sete grupos
  de documentos, isolamento entre endereços, texto legado, salvamento durante
  consulta e renderização do laboratório.
- `e2e/consulta-cep.spec.ts`: cadastro com matrícula preparada, perfil e
  documento com correção manual salva/reaberta, ausência de consulta na carga
  inicial, CEP inválido, inexistente, resposta parcial/inutilizável,
  indisponibilidade e proteção contra respostas atrasadas.

## Matriz dos nove grupos

| Formulário | Grupo | Cobertura de integração |
| --- | --- | --- |
| Cadastro | Aluno | `enderecos-pessoais.test.tsx` |
| Perfil | Aluno | `enderecos-pessoais.test.tsx` |
| Liberação | Aluno | `enderecos-integracao.test.tsx` |
| Liberação | Local de estágio | `enderecos-integracao.test.tsx` |
| Convênio | Concedente | `enderecos-integracao.test.tsx` |
| Termo de compromisso | Concedente | `enderecos-integracao.test.tsx` |
| Ficha de frequência | Concedente | `enderecos-integracao.test.tsx` |
| Relatório semestral | Aluno | `enderecos-integracao.test.tsx` |
| Relatório semestral | Instituição | `enderecos-integracao.test.tsx` |

A integração mantém a persistência híbrida descrita no design: cadastro em
Prisma/MySQL quando configurado e documentos na memória do processo. Os testes
de salvar/reabrir documentos verificam esse contrato, sem prometer durabilidade
após reinício do servidor.
