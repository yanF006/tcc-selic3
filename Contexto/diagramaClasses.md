# SELic — Transcrição dos diagramas de classes

 > **Importante:** diagramas são documentação de modelagem, **não** um esquema Prisma/SQL pronto nem a fonte exclusiva das regras de negócio.
 > Ainda precisa ser revisado. Não considerar esse diagrama

## 1. Convenções

- `-` = atributo privado na notação UML; `+` = operação pública.
- `1` = exatamente um; `0..1` = opcional; `0..*` = zero a muitos; `1..*` = um a muitos.
- `--|>` = generalização/herança (seta triangular apontando para superclasse).
- `*--` = composição (losango preenchido no lado do todo).
- Linha tracejada = dependência, não necessariamente uma relação persistida no banco.
- Os tipos de dados só aparecem no **diagrama de projeto**. No domínio não foram inferidos.
- O desenho não especifica chaves estrangeiras, restrições `UNIQUE`, tabelas de junção, políticas de exclusão ou detalhes de implementação.

## 2. Diagrama de classes de domínio

### 2.1 Classes e atributos (sem tipos e sem métodos)

```yaml
classes:
  Usuario: [email, senha, nome, perfil]
  Aluno: [matricula, cpf, rg, dataNascimento, endereco, telefone, email, periodo]
  CoordenadorCurso: []
  CoordenadorEstagio: []
  Administrador: []
  Curso: [nome, cargaHoraria, observacoes]
  Estagio: [etapa, cargaHoraria, dataInicio, dataFim, semestre, ano, nivelEnsino, cargaHorariaSemanal, horario, bolsaBeneficios, totalHorasCumpridas]
  Orientador: [nome, email, telefone]
  Supervisor: [nome, email, telefone]
  InstituicaoConcedente: [nome, cnpj, ramoAtividade, tipoEscola, endereco, telefone, ramal, email, site]
  ResponsavelInstituicao: [nome, rg, cpf, cargo]
  Convenio: [dataInicio, dataTermino, status]
  Documento: [tipo, dataEmissao]
  RecursoDocumental: [titulo, categoria, etapaAplicavel, tipoAcesso, link]
```

**Total: 13 classes.** `CoordenadorCurso`, `CoordenadorEstagio` e `Administrador` não exibem atributos próprios.

### 2.2 Generalização

```text
Aluno                --|> Usuario
CoordenadorCurso     --|> Usuario
CoordenadorEstagio   --|> Usuario
Administrador        --|> Usuario
```

### 2.3 Associações

Multiplicidades abaixo estão descritas na ordem **próxima da primeira classe / próxima da segunda classe**. Para clareza, a interpretação textual distingue as instâncias vinculadas:

| Ligação desenhada | Nome no desenho | Multiplicidade junto à 1ª classe | Junto à 2ª classe | Interpretação |
|---|---|---|---|---|
| `CoordenadorCurso — Curso` | gerencia | `0..1` | `1` | Cada curso tem zero ou um coordenador; cada coordenador vincula-se a um curso, conforme multiplicidades exibidas. |
| `Aluno — Curso` | pertence | `0..*` | `1` | Um aluno pertence a um curso; um curso pode ter vários alunos. |
| `Aluno — Estagio` | realiza | `1` | `0..*` | Um estágio pertence a um aluno; um aluno pode realizar vários estágios. |
| `Estagio — InstituicaoConcedente` | concedido por | `0..*` | `1` | Um estágio tem uma instituição; uma instituição pode conceder vários estágios. |
| `Estagio — Orientador` | orientado por | `0..*` | `1` | Um estágio tem um orientador; um orientador pode orientar vários estágios. |
| `Estagio — Supervisor` | supervisionado por | `0..*` | `1` | Um estágio tem um supervisor; um supervisor pode supervisionar vários estágios. |
| `Estagio — Documento` | possui | `1` | `0..*` | Um estágio contém zero ou vários documentos; cada documento vincula-se a um estágio. **Composição:** losango preto no lado de `Estagio`. |
| `InstituicaoConcedente — ResponsavelInstituicao` | tem | `1` | `1..*` | Uma instituição possui um ou mais responsáveis; cada responsável pertence a uma instituição. **Composição** no lado da instituição. |
| `InstituicaoConcedente — Convenio` | firma | `1` | `0..*` | Uma instituição firma zero ou mais convênios; cada convênio vincula-se a uma instituição. **Composição** no lado da instituição. |

**Dependência tracejada:** `RecursoDocumental ..> Estagio`, rotulada **“aplicável a”**, com `0..*` exibido nas proximidades do vínculo. A imagem não permite definir com segurança a posição exata de todas as multiplicidades dessa dependência; não converter automaticamente em FK ou tabela de junção.

### 2.4 Observações de fidelidade

- O domínio armazena `senha` em `Usuario`, enquanto o projeto usa `senhaHash`: diferenças entre versões devem permanecer explícitas.
- `endereco` aparece em `Aluno` e `InstituicaoConcedente` no domínio, mas não na lista de atributos correspondente do projeto.
- `ramal` e `site` estão somente na classe `InstituicaoConcedente` do domínio.
- `status` está em `Convenio` no domínio, mas no projeto é obtido pelo método `getStatus()`.
- `RecursoDocumental` é distinto de `Documento` em ambos os modelos.

---

## 3. Diagrama de classes de projeto (`image3.png`)

Todas as 13 classes estão identificadas com estereótipo UML `<<entity>>`.

### 3.1 Definição textual de classes

```text
class Usuario <<entity>> {
  - email: String
  - senhaHash: String
  - nome: String
  - perfil: String
  + autenticar(email: String, senha: String): boolean
  + temPermissao(funcao: String): boolean
}

class Aluno <<entity>> {
  - matricula: String
  - cpf: String
  - rg: String
  - dataNascimento: Date
  - email: String
  - telefone: String
  - periodo: int
  + obterAluno(matricula: String): Aluno
  + gravarAluno(aluno: Aluno): void
  + atualizarContato(email: String, telefone: String): void
}

class CoordenadorCurso <<entity>> {}
class CoordenadorEstagio <<entity>> {}
class Administrador <<entity>> {}

class Curso <<entity>> {
  - idCurso: int
  - nome: String
  - cargaHoraria: int
  - observacoes: String
  + obterCurso(id: int): Curso
}

class Estagio <<entity>> {
  - idEstagio: int
  - etapa: String
  - cargaHoraria: int
  - cargaHorariaSemanal: int
  - dataInicio: Date
  - dataFim: Date
  - semestre: String
  - ano: int
  - nivelEnsino: String
  - horario: String
  - bolsaBeneficios: String
  - totalHorasCumpridas: int
  + gravarEstagio(estagio: Estagio): void
  + registrarHoras(horas: int): void
  + consultarPorCursoPeriodo(curso: Curso, periodo: String): List
}

class Orientador <<entity>> {
  - idOrientador: int
  - nome: String
  - email: String
  - telefone: String
}

class Supervisor <<entity>> {
  - idSupervisor: int
  - nome: String
  - email: String
  - telefone: String
}

class InstituicaoConcedente <<entity>> {
  - idInstituicao: int
  - nome: String
  - cnpj: String
  - ramoAtividade: String
  - tipoEscola: String
  - email: String
  - telefone: String
  + gravarInstituicao(inst: InstituicaoConcedente): void
  + possuiConvenioAtivo(): boolean
}

class ResponsavelInstituicao <<entity>> {
  - idResponsavel: int
  - nome: String
  - cpf: String
  - cargo: String
}

class Convenio <<entity>> {
  - idConvenio: int
  - dataInicio: Date
  - dataTermino: Date
  + getStatus(): String
  + estaAtivo(): boolean
  + gravarConvenio(conv: Convenio): void
}

class Documento <<entity>> {
  - idDocumento: int
  - tipo: String
  - dataEmissao: Date
  + gerarPDF(): Arquivo
}

class RecursoDocumental <<entity>> {
  - idRecurso: int
  - titulo: String
  - categoria: String
  - etapaAplicavel: String
  - tipoAcesso: String
  - link: String
  + listarPorEtapa(etapa: String): List
}
```

**Nota:** `Arquivo` e `List` são tipos retornados tal como escritos no desenho; não representam obrigatoriamente tipos nativos de TypeScript ou Prisma.

### 3.2 Herança e relacionamentos do projeto

```text
Aluno                --|> Usuario
CoordenadorCurso     --|> Usuario
CoordenadorEstagio   --|> Usuario
Administrador        --|> Usuario

Aluno (0..*)           -- (1)    Curso
Aluno (1)              -- (0..*) Estagio
Estagio (0..*)         -- (1)    InstituicaoConcedente
Estagio (0..*)         -- (1)    Orientador
Estagio (0..*)         -- (1)    Supervisor
Estagio (1)            *-- (0..*) Documento
InstituicaoConcedente (1) *-- (1..*) ResponsavelInstituicao
InstituicaoConcedente (1) *-- (0..*) Convenio
```

As associações aparecem **sem nome** no diagrama de projeto, embora suas relações correspondentes tenham nomes no diagrama de domínio. O desenho de projeto não mostra associação explícita `CoordenadorCurso — Curso` nem a dependência de `RecursoDocumental` com `Estagio`.

### 3.3 Diferenças entre os dois desenhos a validar

| Tema | Domínio | Projeto |
|---|---|---|
| Senha de usuário | `senha` | `senhaHash: String` |
| Aluno | contém `endereco` | não apresenta `endereco` |
| Instituição | inclui `endereco`, `ramal`, `site` | omite esses campos |
| Responsável da instituição | `nome`, `rg`, `cpf`, `cargo` | `idResponsavel`, `nome`, `cpf`, `cargo` (sem `rg`) |
| Convênio | atributo `status` | métodos `getStatus()` e `estaAtivo()` |
| Coordenador do curso e curso | associação `gerencia` | associação não representada |
| Recurso documental | dependência `aplicável a` | dependência não representada |
| Classes de projeto | sem tipos/métodos | tipos, IDs e operações explícitas |

## 4. Instruções para agentes de desenvolvimento

1. Trate este documento como **transcrição de diagramas existentes**, não como autorização automática para criar ou alterar tabelas.
2. Antes de implementar, compare estes diagramas com requisitos, especificações OpenSpec, código e esquema Prisma existentes. Registre divergências e peça decisão quando afetarem comportamento ou persistência.
3. Não deduza que herança UML exige herança de tabelas SQL. Escolha a representação de perfis conforme as regras do projeto.
4. Preserve a distinção entre `Documento` (vinculado a estágio) e `RecursoDocumental` (catálogo de material/documentos).
5. Respeite a segurança: a coluna `senhaHash` indica armazenamento de hash de senha, não senha em texto puro. Os desenhos, isoladamente, não definem algoritmo, política de acesso ou processo de autenticação.
6. A composição UML não determina sozinha `ON DELETE CASCADE`. Consulte regras de retenção de histórico e LGPD antes de definir exclusões.
7. Não invente tipos específicos para `Arquivo` ou `List` nem parâmetros adicionais para métodos.
8. A implementação deve refletir a regra de negócio aprovada e não apenas uma figura acadêmica antiga.

## 5. Origem

- **Diagrama de Classes de Domínio:** segunda imagem da última mensagem do usuário (`image4.png`).
- **Diagrama de Classes de Projeto:** primeira imagem da última mensagem do usuário (`image3.png`).
