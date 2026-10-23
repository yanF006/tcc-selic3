## Context

A motivação está em `proposal.md`, seção **Why**. Os comportamentos obrigatórios estão em `specs/consulta-endereco-cep/spec.md`; este documento define a arquitetura para atendê-los.

O aplicativo usa Next.js App Router, React, TypeScript e Zod. `src/lib/services/endereco.ts` é importado pelos componentes cliente de cadastro e perfil e consulta um catálogo local. Esses formulários já possuem os campos estruturados de `Endereco`, máscara de CEP e busca por botão, mas compartilham o estado de transição da consulta com outras operações.

Os documentos são dirigidos por `src/lib/templates/descriptors.ts`. `FormularioDocumento` desabilita todos os campos de `auto`, e `CampoDescritor` também considera as restrições do campo. No servidor, `valoresDoPreenchimento` sobrepõe os valores automáticos aos recebidos, tanto no salvamento quanto na reabertura de rascunhos e em caminhos de geração. Portanto, liberar somente os controles não preservaria uma correção de endereço.

A persistência é híbrida: usuários e matrículas usam Prisma/MySQL quando configurados, com hidratação por `src/lib/db/persistencia.ts`; documentos, estágios e convênios continuam no estado dos serviços. `Convenio` não contém endereço nem vínculo explícito com um documento de convênio preenchido. A integração deve usar os dados efetivamente disponíveis, sem atribuir o endereço do aluno à concedente.

### Inventário de formulários e grupos

O levantamento de componentes e descritores identifica nove grupos de endereço:

| Formulário/template | Grupo | Campos atuais de referência | Adequação |
| --- | --- | --- | --- |
| `src/app/(publico)/cadastro/formulario-cadastro.tsx` | Residência do aluno | `endereco.cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `estado` | Substituir consulta simulada e integrar acionamento automático e proteção de edições. |
| `src/app/(aluno)/perfil/formulario-perfil.tsx` | Residência do aluno | Mesma estrutura de `Endereco` | Compartilhar o controle de consulta, sem consulta na montagem. |
| `tpl-formulario-liberacao` | Aluno | `enderecoAluno`, `cepAluno` | Inicializar pelo cadastro e acrescentar os campos estruturados ausentes. |
| `tpl-formulario-liberacao` | Local de estágio | `enderecoLocal` | Acrescentar `cepLocal` e campos estruturados independentes. |
| `tpl-convenio-estagio` | Instituição concedente | `endereco`, `bairro`, `cidade`, `uf`, `cep` | Acrescentar logradouro, número e complemento estruturados e conectar a consulta no fluxo autorizado da coordenação. |
| `tpl-termo-compromisso` | Concedente | `endereco`, `bairro`, `cidade`, `cep` | Acrescentar UF e os demais campos estruturados ausentes. |
| `tpl-ficha-frequencia` | Concedente | `endereco`, `bairro`, `cidade`, `uf`, `cep` | Conectar consulta e edição no fluxo autorizado da coordenação. |
| `tpl-relatorio-semestral` | Aluno | `endereco`, `bairro`, `cidade`, `cep` em `auto` | Separar o grupo dos demais campos automáticos e acrescentar os campos estruturados ausentes. |
| `tpl-relatorio-semestral` | Instituição | `instituicaoEndereco` | Acrescentar `instituicaoCep` e campos estruturados independentes. |

Os demais templates não coletam endereço. A visualização administrativa do perfil apenas exibe o endereço. Endereços fixos do IFRJ nos textos dos documentos não são entradas de formulário. O laboratório de formulários reutiliza os descritores e recebe as mesmas adaptações, sem se tornar uma fonte de persistência.

## Goals / Non-Goals

**Goals:**

- Isolar transporte externo, controle assíncrono e associação dos campos, para que os nove grupos usem o mesmo comportamento sem depender dos nomes específicos de cada template.
- Separar a origem inicial de um endereço da autorização para editá-lo e da precedência dos seus valores salvos.
- Manter as consultas como auxílio transitório: salvar usa o estado final validado do formulário, sem exigir sucesso do ViaCEP.
- Permitir testes determinísticos nas fronteiras de rede, serviços, formulários e ações do servidor.

**Non-Goals:**

- Migrar documentos e convênios para novas tabelas ou alterar a estratégia geral de persistência do projeto.
- Sincronizar uma correção de endereço do documento de volta ao cadastro do aluno ou a outros documentos.
- Criar um cadastro nacional de CEPs, cache persistente, geocodificação ou tentativas automáticas de reconexão.
- Generalizar a edição de todos os campos automáticos: a exceção será restrita aos campos dos grupos de endereço declarados.

## Decisions

### 1. Consulta externa no servidor, com contrato explícito para o cliente

Manter `src/lib/services/endereco.ts` como fachada utilizável pelo cliente e substituir o catálogo por uma chamada a `GET /api/enderecos/cep?cep=<oito-digitos>`. Um Route Handler em `src/app/api/enderecos/cep/route.ts` delegará a um adaptador exclusivo do servidor a consulta a `https://viacep.com.br/ws/<cep>/json/`.

Usar `fetch` nativo, sem pacote adicional. Validar o CEP na fachada e novamente na rota, construir a URL apenas a partir dos dígitos validados e não aceitar uma URL externa fornecida pelo cliente. O endpoint precisa atender ao cadastro público; consultar CEP não concede acesso a dados pessoais nem altera um documento.

O retorno será uma união discriminada por `status`: `encontrado` com endereço, `invalido`, `nao_encontrado` ou `indisponivel`. A rota responderá com HTTP 200 para resultado encontrado ou CEP inexistente, 400 para entrada inválida e 503 para falha externa. A fachada interpretará o corpo e também converterá falhas de transporte ou respostas inesperadas em indisponibilidade. Cancelamento deliberado por substituição da consulta não exibirá erro.

O adaptador mapeará `localidade` para `cidade` e `uf` para `estado`, devolverá CEP normalizado e somente valores textuais utilizáveis de logradouro, bairro, cidade e estado. `erro: true` ou `erro: "true"` será CEP não encontrado. JSON inválido, formato inesperado, CEP de resposta diferente do solicitado ou resposta sem nenhum campo de endereço utilizável será indisponibilidade. Respostas parciais válidas continuarão sendo sucesso. Número e complemento, inclusive o `complemento` devolvido pelo ViaCEP, não integram o preenchimento automático.

Definir timeout de cinco segundos na requisição externa, limpeza dos temporizadores e cancelamento ao encerrar a operação. A fachada também terá limite de espera, de sete segundos, para cobrir falhas entre navegador e aplicação. Não haverá retry automático nem cache nesta entrega; usar `cache: "no-store"` no fetch externo e resposta sem armazenamento. O limite de espera nunca será condição para salvar manualmente.

**Alternativas consideradas:** chamada direta do navegador simplificaria a rota, mas espalharia o contrato do provedor e dificultaria centralizar limites e testes do adaptador; Server Action serviria para consulta, mas uma rota GET oferece cancelamento e interceptação de rede mais simples. Retornar apenas endereço ou `null` foi descartado porque mistura CEP inválido, inexistente e falha externa.

### 2. Controle reutilizável por grupo e acionado por eventos do usuário

Criar um hook compartilhado de consulta de endereço, com uma instância para cada grupo. Ele receberá os valores controlados, a operação de atualização do grupo e a condição de edição autorizada; manterá consulta, mensagem, identificador da solicitação, cancelamento e revisões de campos localmente. Cadastro, perfil e documentos usarão esse controlador, reaproveitando `CampoMascarado` e os controles existentes.

A hidratação, a montagem e a substituição de valores por uma resposta de salvamento serão eventos de inicialização, nunca eventos de consulta. Não usar um efeito baseado somente no valor do CEP para iniciar o fetch.

- Cadastro e perfil: a mudança do CEP pelo usuário para oito dígitos válidos inicia automaticamente a consulta; manter o botão para consulta explícita/repetição. A hidratação do perfil não consulta.
- Documentos: cada grupo começa em visualização, com ação **Alterar endereço** disponível apenas se o documento puder ser preenchido pelo usuário. Entrar nesse modo habilita os campos, mas não consulta. A mudança efetiva do CEP normalizado para um valor válido ou o botão **Consultar CEP** durante a edição inicia a consulta.
- Editar somente número, complemento ou qualquer campo diferente do CEP não inicia consulta. Mudar apenas a apresentação da máscara também não.
- Uma consulta inválida solicitada explicitamente sinaliza o problema sem chamar a rota. CEP incompleto durante digitação é validado ao sair do campo ou tentar consultar/salvar.

O carregamento e o resultado ficam associados ao grupo, com rótulos distintos e mensagem anunciada por região de status acessível. Os campos permanecem editáveis durante a consulta. A transição de salvamento não será reutilizada como estado de consulta; uma consulta em andamento ou malsucedida não desabilitará o salvamento de dados válidos.

**Alternativas consideradas:** copiar a lógica para cada formulário criaria comportamentos divergentes; observar CEP em `useEffect` dispararia consultas na carga inicial; controlar todos os endereços com um único estado misturaria mensagens e resultados.

### 3. Metadados explícitos de grupos nos descritores

Estender `DescriptorDocumento` com uma coleção de grupos contendo identificador, rótulo, origem inicial e mapeamento dos campos canônicos `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `estado` para os IDs do template. A composição textual legada do endereço será declarada separadamente. Os metadados serão compartilhados pelo renderizador, inicialização, preparação dos valores e testes, sem inferência por rótulo, posição ou sufixo.

Adotar os seguintes conjuntos de IDs para os campos estruturados:

- Liberação/aluno: `cepAluno`, `logradouroAluno`, `numeroAluno`, `complementoAluno`, `bairroAluno`, `cidadeAluno`, `ufAluno`; composição legada `enderecoAluno`.
- Liberação/local: `cepLocal`, `logradouroLocal`, `numeroLocal`, `complementoLocal`, `bairroLocal`, `cidadeLocal`, `ufLocal`; composição legada `enderecoLocal`.
- Convênio, termo, ficha e aluno do relatório: `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`; composição legada `endereco`, com grupos e origem definidos por template.
- Relatório/instituição: `instituicaoCep`, `instituicaoLogradouro`, `instituicaoNumero`, `instituicaoComplemento`, `instituicaoBairro`, `instituicaoCidade`, `instituicaoUf`; composição legada `instituicaoEndereco`.

Todos os grupos apresentarão os campos estruturados, acrescentando os que faltam. Reutilizar a máscara e `esquemaCep`; manter as regras de obrigatoriedade do formulário, sem transformar sucesso da consulta em validação de endereço. Número será texto, permitindo valores como `s/n`, e complemento continuará opcional.

`FormularioDocumento` renderizará cada grupo uma única vez, inclusive quando os seus campos hoje estejam em `auto`. A liberação de edição será específica dos IDs declarados e subordinada a `desabilitado`, à situação de rascunho e às permissões existentes. Os demais campos automáticos continuarão sob a mesma proteção do servidor e dos controles.

**Alternativas consideradas:** associar qualquer campo chamado `cep` ao primeiro `endereco` falha no endereço da concedente e em formulários com dois grupos; remover globalmente `somenteLeitura` ampliaria indevidamente a edição de identificação e estágio.

### 4. Inicialização pelo cadastro e precedência do endereço salvo

No servidor, resolver primeiro o titular correto do documento e garantir a leitura do cadastro pelo serviço de usuários que aplica a hidratação do banco. Para grupos do aluno, mapear `dadosPessoais.endereco` aos IDs do descritor, mesmo quando esses campos tenham origem `digitado` hoje. Para grupos da concedente, usar somente uma fonte cadastrada explicitamente vinculada e que possua endereço; no modelo atual não há essa fonte em `Convenio`, portanto apresentar os valores já salvos no próprio documento ou campos vazios. Não consultar ViaCEP para completar nenhuma dessas fontes.

A preparação dos valores terá duas políticas distintas:

1. Campos automáticos protegidos continuam sendo recalculados no servidor e prevalecendo sobre o cliente.
2. Campos pertencentes aos grupos de endereço recebem valores do cadastro apenas como padrão inicial. Uma chave presente no documento/formulário prevalece sobre esse padrão, inclusive quando contém string vazia; não usar um teste de valor verdadeiro para decidir a precedência. Quando um grupo legado já possui endereço salvo, não completar sua estrutura com o endereço atual do perfil: isso poderia misturar dois endereços distintos.

Aplicar a política na criação, reabertura, salvamento, submissão, impressão e download, revisando os consumidores de `valoresDoPreenchimento`. O salvamento unirá os valores já existentes aos recebidos, respeitará somente os campos de endereço declarados como editáveis e validará o resultado com o descritor. As verificações de usuário, acesso ao documento, titular ativo e situação continuarão nas ações do servidor. Conhecer um CEP ou enviar uma chave de campo automático não permitirá editar o restante da identificação.

O documento guarda uma cópia do endereço. Uma edição nele não atualiza o perfil; uma atualização posterior do perfil não substitui o endereço que já foi salvo no documento. Documentos fora de rascunho mantêm o conteúdo histórico.

**Alternativas consideradas:** inverter a ordem de todo o merge permitiria falsificar campos protegidos; exigir que o aluno atualize o perfil para corrigir um documento impediria a correção local requerida; chamar o ViaCEP ao abrir competiria com os dados cadastrados.

### 5. Compatibilidade dos endereços textuais existentes

Os documentos atuais armazenam endereços compostos em `endereco`, `enderecoAluno`, `enderecoLocal` ou `instituicaoEndereco`. Adicionar os campos estruturados ao mapa de valores é uma evolução aditiva, sem remover essas chaves. Para novos endereços estruturados, um formatador compartilhado produzirá a composição textual usada pela impressão/download, preservando número e complemento.

Ao abrir um registro legado que só possua texto composto, mantê-lo integralmente, sem tentar separar logradouro e número por vírgulas. Na edição, exibir esse texto como endereço anterior e permitir corrigi-lo manualmente; os novos campos estruturados ficam disponíveis para reconstrução. Consultar um CEP preenche somente os novos campos elegíveis e não substitui silenciosamente o texto anterior. A composição só passa a ser derivada da estrutura quando há logradouro e número, incluindo `s/n`, informado pelo usuário; até então, salvar preserva o texto anterior e os campos estruturados disponíveis. Essa transição ocorre no salvamento, sem etapa adicional de confirmação, e não depende de consulta bem-sucedida.

Quando já existe estrutura suficiente salva, ela é a fonte da composição e o texto composto é apenas sua representação, sem uma segunda entrada concorrente. A mesma regra de suficiência vale na reabertura, para que uma estrutura parcial não substitua o texto legado. Testar os dois caminhos de compatibilidade, incluindo número/complemento presentes somente no texto antigo e reabertura após reconstrução da estrutura. Antes dessa reconstrução, orientar o usuário a transcrever número e complemento do texto anterior; a consulta não fará isso por ele.

**Alternativas consideradas:** substituir o texto existente pelo logradouro retornado perderia o número; decompor texto livre por heurística poderia corromper dados; remover imediatamente as chaves legadas quebraria registros e saídas existentes.

### 6. Concorrência protegida por identidade da consulta e revisão por campo

Cada grupo manterá um contador monotônico de solicitações e revisões de edição manual por campo. Ao iniciar a consulta, capturar o CEP normalizado, a identidade do documento/grupo e as revisões atuais. Antes de aplicar qualquer resposta, exigir que a solicitação ainda seja a mais recente, o CEP ainda corresponda e a edição continue autorizada.

Aplicar apenas campos não vazios retornados cujas revisões manuais não tenham mudado desde o início. Uma edição manual seguida de retorno ao valor anterior ainda altera a revisão e deve ser preservada. Número e complemento nunca são destinos da resposta. Usar uma atualização funcional/atômica do estado do grupo para evitar que vários preenchimentos leiam um snapshot antigo.

Trocar o CEP, iniciar outra consulta, desmontar/trocar o documento ou concluir um salvamento/submissão invalida a consulta pendente e cancela o transporte quando possível. Respostas antigas não podem mudar nem os valores nem o carregamento/mensagem de uma solicitação nova. Cancelamento é otimização; identidade e revisões garantem a correção mesmo quando a resposta já está a caminho.

**Alternativas consideradas:** apenas comparar o CEP não protege edições manuais nem o ciclo CEP A → B → A; comparar apenas valores não identifica uma edição desfeita; confiar só em `AbortController` não elimina todas as condições de corrida.

### 7. Verificação por camadas e matriz do inventário

Usar Vitest e Testing Library já instalados para testar o adaptador ViaCEP, a fachada/rota, o controlador e as integrações. Controlar `fetch`, temporizadores e promessas para cobrir validação sem rede, mapeamento, respostas parciais, ambos os formatos de `erro`, HTTP de falha, JSON inválido, timeout, cancelamento, respostas fora de ordem e alterações manuais durante a consulta.

Os testes de integração serão parametrizados pelos nove grupos do inventário, verificando CEP, destinos de preenchimento, inicialização sem rede e edição manual. Incluir casos específicos dos dois templates com dois endereços, com consultas simultâneas e resultados diferentes. Testar serviços e ações reais de preparação/salvamento para detectar sobrescrita na reabertura e comprovar que campos automáticos não relacionados e usuários sem permissão continuam protegidos.

Nos E2E com Playwright, interceptar `/api/enderecos/cep` no navegador para controlar os resultados e contar consultas; a integração real rota/adaptador será verificada separadamente, pois a interceptação do navegador não alcança o fetch do servidor. Preparar cadastro/endereço conhecido e distinguir seus valores dos retornados pela consulta, cobrindo cadastro, perfil, edição de documento, correção manual, salvamento/reabertura e continuidade diante de falhas. Os cenários de persistência do cadastro devem ter teste de integração com a camada de banco controlada para comprovar a leitura antes da preparação do documento; fixtures de interface sozinhas não comprovam essa integração.

Usar os scripts `test:unit`, `test:e2e`, `typecheck` e `lint` no escopo afetado durante a implementação. Nenhum teste dependerá da disponibilidade real do ViaCEP ou do banco de produção.

**Alternativas consideradas:** testar somente o hook não detectaria mapeamentos errados nos descritores nem a sobreposição no servidor; testar contra o ViaCEP real produziria resultados instáveis e não permitiria reproduzir as corridas.

## Risks / Trade-offs

- [Limite de disponibilidade e tempo de resposta do ViaCEP] → Timeout limitado, nenhuma repetição automática, mensagens por grupo e preenchimento manual independente do serviço.
- [Número/complemento ocultos em endereços textuais antigos] → Preservação integral do texto legado, nenhuma decomposição heurística e recomposição apenas com estrutura suficiente e campos manuais revisados pelo usuário.
- [Correções sobrescritas em caminhos além do salvamento] → Uma política compartilhada de preparação e verificação de criação, reabertura, submissão, impressão e download.
- [Ampliação acidental de permissões por liberar campos automáticos] → Exceção baseada nos grupos declarados, autorização no servidor e testes de tentativa de alteração de outros campos protegidos.
- [Consulta pública recebe tráfego sem sessão] → A rota aceita somente CEP validado, usa host externo fixo e não executa novas tentativas por conta própria; não permite consulta a URLs arbitrárias.
- [Persistência híbrida limita durabilidade dos documentos] → Preservar o contrato atual de salvar/reabrir nos serviços e explicitar que esta mudança não migra documentos para MySQL. A prioridade do cadastro usa a ponte de banco existente; a durabilidade após reinício do processo continua sendo uma característica da camada de documentos atual.
- [Requisitos sobrepostos com `frontend-website`] → Durante a implementação, compatibilizar `dados-pessoais-aluno` e `documentos-estagio`: busca automática na entrada válida com botão opcional, preservação de campos em falhas e exceção de edição dos endereços à regra de somente leitura. Registrar também que dado de endereço ausente pode ser completado no documento. Os demais dados de identificação continuam com as regras existentes.

## Migration Plan

1. Introduzir o contrato de consulta, adaptador servidor e rota; migrar a fachada e seus consumidores em conjunto para não misturar o contrato discriminado com o antigo retorno `null`.
2. Acrescentar os metadados/campos de endereço aos descritores e a política de preparação no servidor, incluindo a compatibilidade com valores textuais já salvos. Não há migração SQL: o cadastro já armazena `Endereco` em JSON e documentos usam mapas de valores.
3. Conectar o controlador compartilhado ao cadastro, perfil e grupos dos documentos; aplicar a precedência e a composição também aos caminhos de saída.
4. Executar a matriz de testes, revisar exemplos/fixtures afetados e atualizar a documentação que descreve a consulta simulada. Compatibilizar os requisitos sobrepostos da change `frontend-website` antes de consolidar ambas.
5. Publicar servidor e cliente na mesma versão. No rollback, preservar as chaves estruturadas e os valores existentes; reverter componentes e integração externa conjuntamente. Retornar ao comportamento anterior dos serviços pode voltar a sobrepor endereços do cadastro em rascunhos, portanto preservar uma cópia dos valores de documentos antes desse rollback.
