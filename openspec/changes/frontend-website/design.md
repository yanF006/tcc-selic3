## Context

Estado atual e restrições que moldam a abordagem. A motivação está em `proposal.md` e os requisitos em `specs/`.

- Nenhuma linha de código existe no repositório. Não há inicialização de Git, e o repositório ainda não é versionado.
- O projeto será implantado na Vercel, com MySQL no Aiven, Prisma, Better Auth, Nodemailer e docxtemplater previstos no `Contexto/visaoGeral.md` (§15, §17), mas a ordem definida em `Contexto/desenvolvimento.md` é telas primeiro, banco e backend depois.
- Os 9 arquivos de `specs/` somam 86 requisitos e 217 cenários. Esta mudança entrega todos eles no frontend.
- Os 12 documentos do Kit de Estágio estão em `Contexto/kit-estagio`: 2 PDFs de download, 8 `.docx` e 2 arquivos `.doc` legados (Convênio e Termo de Compromisso), que precisam ser convertidos fora do sistema antes do cadastro (§7.4).
- O único insumo visual disponível é a regra "verde como cor principal" (§16): não há logo, favicon, tipografia nem valor de cor definidos.
- A camada de persistência será substituída depois, mas as telas não podem depender de nada específico do simulador.

## Goals / Non-Goals

**Goals:**

- Entregar todas as telas das 9 capabilities de `specs/` navegáveis e demonstráveis para a cliente, sem backend.
- Fixar o modelo de rotas e permissões agora, de modo que a troca por Better Auth não renomeie URLs nem reescreva a navegação.
- Congelar o contrato de dados (tipos + assinaturas de serviço) que o Prisma vai implementar depois, sem que as telas mudem.
- Tornar os formulários de documento dirigidos por dados, para que os templates do Kit sejam configuração e não código.
- Entregar os temas claro e escuro e a paleta na mesma entrega, já que mexer em tokens depois é retrabalho caro.

**Non-Goals:**

- Persistência, autenticação real, envio real de e-mail e geração real de docx/pdf (ver `proposal.md`).
- Interface de administração da autorização de matrícula: a decisão é uma fila simples, não um workflow configurável.
- Editor visual de template (arrastar e soltar campos). O admin gerencia o descritor de campos por formulário, não um construtor WYSIWYG.
- Conversão de `.doc` legado para `.docx`: segue fora do sistema (§7.4).
- Página pública institucional e internacionalização: o sistema é de uso exclusivo do IFRJ, em um único idioma.
- Layout de impressão de relatórios agregados; a impressão vai ser apenas o preview de documento.

## Decisions

### D1. Rotas por role group, com guarda única em layout compartilhado

As telas ficam em route groups do App Router por domínio de acesso (`(publico)`, `(aluno)`, `(coordenacao)`, `(admin)`), e cada group tem um único layout que resolve a sessão e executa a guarda de papel. As URLs não carregam o papel.

- **Alternativa:** prefixos de papel na URL (`/admin/...`, `/coordenacao/...`). Rejeitada porque amarra a URL ao papel: um coordenador de curso que também precisar da visão de aluno ficaria preso numa URL só, e trocar o modelo de papéis viria com migração de links.
- **Alternativa:** um layout por papel replicando a guarda. Rejeitada por duplicação.
- **Efeito colateral:** como o admin tem todos os privilégios (§4), `administrator` satisfaz qualquer guarda; a regra é `rolesDoUsuario ⊇ rolesExigidas`.

### D2. Registro único de navegação alimentado por permissões

Um `nav.ts` declara os itens com `requiredRoles`, e o layout filtra a lista por papel. Os requisitos de navegação por papel (`autenticacao-acesso`) e de interface (`interface-visual`) passam a ter uma única fonte, sem menu duplicado por layout.

- **Alternativa:** menus escritos à mão em cada layout. Rejeitada porque divergem entre si e ninguém detecta a divergência.

### D3. Sessão simulada em cookie, papéis como conjunto, com seletor de papel

Sem autenticação, é preciso navegar as quatro áreas para validar com a cliente. A sessão simulada fica em cookie (não em contexto React) para que layouts de servidor e componentes de cliente leiam o mesmo estado, e `roles` é um conjunto, e não um valor único. Um seletor de papel no cabeçalho, atrás de flag de ambiente, troca a sessão para demonstrar cada área.

- **Alternativa:** sessão só em contexto do cliente. Rejeitada porque a guarda em layout de servidor não enxergaria o estado.
- **Alternativa:** um build por papel. Rejeitada porque impede validar navegação entre áreas na mesma sessão.
- **Consequência:** `roles` como conjunto já aceita multi-papel; se a cliente confirmar que um usuário pode acumular cargos, nenhum requisito precisa mudar.

### D4. Camada de serviço tipada sobre fixtures, sem biblioteca de dados

Cada agregado tem um módulo em `src/lib/services` com funções assíncronas e os tipos de domínio. A implementação atual lê fixtures e mantém mutações em memória durante a sessão do navegador. Telas importam apenas o serviço, nunca as fixtures. Sem React Query e sem MSW: ainda não há rede para cachear nem servidor para simular.

- **Alternativa:** Prisma agora. Rejeitada porque contraria a ordem do projeto e a configuração do Aiven ainda é informação de conexão, não esquema.
- **Alternativa:** MSW para simular HTTP desde já. Rejeitada porque resolve um problema que só existe quando houver servidor.
- **Efeito colateral:** os tipos viram o contrato a ser reproduzido pelo `schema.prisma`; a mudança de backend troca implementação, não assinatura.

### D5. Formulários de documento dirigidos por descritor de template

Cada template é um descritor: identidade do documento, se é preenchível ou só download, responsável e tipo de parecer, assinaturas exigidas, e a lista de campos. Cada campo declara `key`, `label`, `type`, `required`, máscara, regra de validação, e a **origem do valor** (`aluno`, `estagio`, `literal`, `digitado`). A tela de preenchimento renderiza o formulário a partir do descritor e resolve a origem do valor no preenchimento automático.

- **Alternativa:** um formulário escrito à mão por documento. Rejeitada em definitivo: a §7.4 prevê que os templates mudem com o tempo, e cada versão nova exigiria código novo em 12 lugares.
- **Evidência no Kit:** os descritores são escritos a partir dos 8 `.docx` já disponíveis. Os tipos de campo observados são texto, número, data, select, caixa de marcação, área de texto, tabela (frequência mensal e carga horária) e grade de linhas (a Ficha de Acompanhamento tem 80 linhas numeradas com data, entrada, saída, duração e rubrica), mais vídeo demonstrativo de avaliação na Proposta de Atuação Pedagógica.
- **Consequência:** os `.doc` legados entram como descritor apenas depois da conversão externa; nada no código depende do formato original.
- **Consequência:** o requisito "Quem pode preencher cada documento" e o de parecer viram metadados do descritor, o que elimina tabelas de permissão paralelas.

### D6. Preview como componente com contrato estável, renderização simulada nesta entrega

`DocumentPreview` recebe o descritor e os valores e desenha a página do documento em fundo claro, com os tokens de impressão forçados. Nesta entrega ele é renderizado a partir do descritor; a troca por renderização client-side do docx feito com docxtemplater acontece na mudança de backend e não altera a assinatura do componente nem das rotas.

- **Alternativa:** integrar docxtemplater agora. Rejeitada porque anteciparia um requisito de geração que o `proposal.md` tirou do escopo, e porque dois dos doze documentos ainda precisam de conversão externa para existirem como `.docx`.
- **Consequência:** o download de docx/pdf responde pela mesma interface de serviço e, nesta entrega, devolve um arquivo de demonstração. A interface é a definitiva; só a implementação é provisória.

### D7. Máscaras e validação em um único lugar por tipo de campo

Máscaras são funções puras tipadas em `lib/masks` (CPF, RG, celular, telefone, CEP, data) aplicadas como adaptador controlado sobre o React Hook Form, e as regras de validação são `z.refine` reutilizadas na tela de cadastro, no perfil e nos formulários derivados do descritor. Como a §17 exige as mesmas validações no frontend e no backend, os esquemas Zod são escritos uma vez e podrán ser reutilizados no servidor.

- **Alternativa:** biblioteca de máscara pronta. Adiciona dependência para um conjunto pequeno e fixo de máscaras.
- **Alternativa:** máscaras só por `onChange` com regex soltos por campo. Rejeitada porque duplica a regra e erra em colagem de valores.

### D8. Temas por variáveis CSS com `next-themes` e estratégia por classe

A paleta sai de variáveis CSS semânticas já usadas pelo shadcn/ui, com uma rampa de verde em `--primary`. `next-themes` aplica a classe `dark` no `<html>` e entrega as três opções do requisito de preferência (claro, escuro, sistema), com persistência e sem piscada na abertura. A área de preview de documento recebe um escopo de tokens de impressão para ficar sempre em fundo claro com texto escuro.

- **Alternativa:** só `prefers-color-scheme`. Rejeitada porque não oferece a escolha manual exigida pelo requisito de preferência.
- **Alternativa:** `localStorage` manual. Rejeitada porque perde o acompanhamento do sistema e exige trabalho extra para evitar a piscada.
- **Risco residual:** o valor exato do verde e a tipografia não vieram do IFRJ; ficam em tokens centralizados para troca em um arquivo quando chegarem.

### D9. Rótulos e cores de situação centralizados

Um módulo `lib/domain/status` mapeia cada situação de documento e de estágio para rótulo em português, variante de cor e ícone. O rótulo textual acompanha sempre a cor, atendendo ao requisito de contraste de `interface-visual`.

### D10. Formatação pt-BR sem framework de internacionalização

Datas em dd/mm/aaaa, números e moeda por `Intl` com `pt-BR` e fuso `America/Sao_Paulo`. Sem biblioteca de i18n: o sistema tem um idioma e um campus.

### D11. Testes nos pontos de decisão, não em cada tela

Testes unitários com Vitest para máscaras, esquemas Zod, mapeamento de descritor para campos e rótulos de situação, e três fluxos ponta a ponta com Playwright: cadastro em duas etapas, CRUD de estágio com seleção de documentos, e ciclo de submissão a parecer. O restante das telas é validado por revisão manual com a cliente.

- **Alternativa:** E2E de todos os requisitos. Rejeitada por custo desproporcional a uma entrega de frontend com dados simulados.
- **Alternativa:** só revisão manual. Rejeitada porque parte dos requisitos é regra pura (CPF, máscaras, transições de situação), que é barata de testar e cara de revalidar a cada ajuste visual.

### D12. Decisões de domínio assumidas, a validar com a cliente

Heranças do `Contexto/visaoGeral.md` onde ele é omissivo, escolhendo o comportamento mais conservador:

| Tema | Decisão assumida |
|---|---|
| Instituição do estágio | Selecionada entre convênios ativos; convênio expirado não recebe estágios novos (§11 implica vínculo obrigatório). |
| Horas do estágio | Só podem ser lançadas dentro do período do estágio; múltiplos lançamentos por data são permitidos. |
| Estágio concluído | Não aceita data de fim futura. |
| Exclusão de estágio pelo aluno | Gera solicitação e aguarda autorização de cargo superior (§12), sem apagar nada antes da decisão. |
| Documento em preenchimento | Fica como rascunho; parecer exige submissão explícita. |
| Múltiplos convênios do mesmo aluno | Cada estágio referencia um convênio; nada impede o mesmo aluno estagiar na mesma instituição em períodos distintos. |
| Ficha de Frequência e Avaliação | Aluno não preenche, porque o template só admite RH ou chefe imediato da concedente; o Coordenador de Estágio registra o documento já assinado e lança os valores. |
| Correção de horas | Lançamento é imutável e a correção entra como lançamento de correção, porque a Ficha de Acompanhamento proíbe rasura. |
| Carga horária do estágio | O total de horas vem dos lançamentos, e o campo de duração em horas do Termo de Compromisso é preenchido com esse total e permanece ajustável pelo aluno. |
| Formulário de Liberação e Plano de Atividades | Decidido com a cliente: viram dois arquivos `.docx` independentes, porque §7.4 exige que sejam templates separados. |
| Genericidade dos templates | Decidido com a cliente: todos os templates são genéricos, inclusive a Proposta de Atuação Pedagógica, cuja menção ao curso Licenciatura em Computação é removida do cabeçalho. |
| Abrangência do convênio | Decidido com a cliente: o convênio vale apenas para o Campus Pinheiral, então o cadastro não oferece escolha de campus, apesar da cláusula do template mencionar todos os campi do IFRJ. |

## Risks / Trade-offs

- **A guarda de papel é só de interface até existir backend** → todas as regras de acesso ficam em um único módulo (`lib/auth/permissions`) e todas as telas passam por ele; nenhuma tela importa fixtures nem recebe dados por prop vinda do servidor, o que reduz a superfície a revisar quando a verificação real chegar.
- **As fixtures podem divergir do modelo real** → os tipos de serviço são o contrato; o `schema.prisma` futuro é gerado a partir deles, e as fixtures entram na revisão da cliente para validar volume e variety antes do backend.
- **Formulário genérico é menos refinado que um formulário por documento** → os tipos de campo cobrem os padrões dos documentos do Kit (texto, número, data, select, caixa de marcação, área de texto); os descritores ficam em uma pasta só e são lidos com a cliente documento a documento.
- **O seletor de papel e a sessão simulada são uma brecha se vazarem para produção** → ficam atrás de flag de ambiente e o `README` registra que devem ser removidos antes da entrega final; o teste E2E depende deles, então a remoção é um passo explícito da lista de tarefas.
- **O preview simulado pode não refletir a paginação final do docx** → o componente é o contrato estável; a substituição interna não muda rotas, serviços nem testes.
- **Entrega grande demais (86 requisitos, 9 capabilities) para uma única passagem de revisão** → as tarefas são fatiadas por capability, com marco demonstrável ao fim do fluxo do aluno e revisão parcial antes das áreas de coordenação e administração.
- **Tokens de cor provisórios podem vazar para produção** → a rampa de verde fica isolada em um arquivo de tokens, com a troca por valor oficial como tarefa única.
- **Dois documentos do Kit estão em `.doc` legado** → a conversão para `.docx` fica fora do sistema, conforme §7.4, e entra como tarefa antes do cadastro dos templates; até lá, esses dois descritores são cadastrados sem arquivo anexado, com o campo de download sinalizado como pendente.
- **Os templates do Kit contêm conteúdo que não deve chegar ao documento final** (o lorem ipsum e as instruções de preenchimento da Proposta de Atuação Pedagógica, o rótulo "Relatório Semestral de Estágio 2019" no nome do arquivo e o curso "Licenciatura em Computação" no cabeçalho) → o descritor marca cada trecho do template como `campo`, `fixo` ou `instrucao`, e a remoção de instruções é responsabilidade do gerador futuro, não do formulário.

## Migration Plan

Não há sistema em produção, então "migração" aqui é a sequência de entrega:

1. `git init`, `.gitignore` e primeiro commit de `Contexto/` e `openspec/` antes de qualquer scaffold, para que a evolução da especificação fique versionada junto do código.
2. `create-next-app` (App Router, TypeScript, Tailwind) e `init` do shadcn/ui, commitando o baseline.
3. Preparar o Kit fora do sistema antes de cadastrar os templates: converter os dois arquivos `.doc` para `.docx`, separar o Formulário de Liberação e o Plano de Atividades em dois arquivos, remover do template da Proposta de Atuação Pedagógica a menção ao curso, e então registrar os 12 descritores de campo a partir dos arquivos resultantes.
4. Ordem de fatias: tokens e temas → shell de navegação e guarda de papel → fluxo do aluno (cadastro, perfil, estágios, documentos, pareceres) → coordenação → administração → estatísticas. Cada fatia é revisável com a cliente e mergeável isoladamente.
5. Publicar cada fatia como Preview da Vercel para a validação das telas. Não há variáveis de ambiente com segredo nesta entrega, porque não há servidor nem banco.
6. Rollback é republicar o Preview anterior: como os dados são fixtures em memória, não há migração de dados nem risco de perder informação. Se algum dia houver URL pública, cada papel acessa pelo seu próprio login.
7. Antes de abrir a mudança de backend, congelar os tipos de `lib/services` e o descritor de campo como contrato, para que Prisma e Better Auth implementem o que a tela já consome.

## Open Questions

Itens que não mudam a abordagem nem as specs e podem ser respondidos depois:

- **Valor oficial do verde, tipografia e arquivos de logo e favicon do IFRJ** → tokens centralizados; troca em um arquivo. Enquanto isso, os requisitos de identidade visual e de contraste seguem atendidos com a rampa provisória e com o logo provisório.
- **Se um mesmo usuário pode acumular papéis** (por exemplo, coordenador de estágio e de curso) → o modelo já é um conjunto de papéis, então a resposta afirmativa é aditiva e não altera requisito.
- **Se o sistema deve ter página pública institucional** → nenhuma spec cobre isso; adicionar é uma capability nova, sem impacto no que foi entregue.
- **Nível de acessibilidade a declarar (ex.: WCAG AA)** → os requisitos já pedem teclado, foco visível e contraste; declarar o nível é um registro, não uma mudança de código.
- **Se o Relatório Semestral continua vigente** → o corpo do arquivo está datado de 2026, apesar do nome indicar 2019, então o texto do documento é que manda; é um dado do descritor, ajustável sem tocar em código.
- **Se o parecer indeferido reabre o preenchimento para reenvio** → padrão adotado nesta entrega é permitir reabrir e reenviar; se a cliente quiser bloquear, o ajuste é uma transição a remover em `lib/domain/status`, e nenhuma spec precisa mudar porque nenhuma delas descreve esse caminho.