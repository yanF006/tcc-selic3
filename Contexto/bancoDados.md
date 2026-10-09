# ENTIDADES
- USUARIO
- COORDENADOR DE ESTAGIO
- COORDENADOR DE CURSO
- ADMINISTRADOR
- ALUNO
- CURSO
- ESTAGIO
- DOCUMENTO
- ORIENTADOR
- SUPERVISOR
- INSTITUICAO CONCEDENTE

# GENERALIZACAO / ESPECIALIZACAO
USUARIO é superentidade.
Subentidades: COORDENADOR DE ESTAGIO, COORDENADOR DE CURSO, ADMINISTRADOR e ALUNO.
O diagrama utiliza um triangulo de generalizacao apontando para USUARIO.
Não há indicação explícita de especialização total/parcial ou disjunta/sobreposta.

# RELACIONAMENTOS E CARDINALIDADES
GERENCIAR: COORDENADOR DE CURSO (0,1) — CURSO (1,1).
PERTENCIMENTO: ALUNO (0,N) — CURSO (1,1).
REALIZACAO: ALUNO (1,1) — ESTAGIO (0,N).
ORIENTACAO: ESTAGIO (0,N) — ORIENTADOR (1,1).
DOCUMENTACAO: ESTAGIO (1,1) — DOCUMENTO (0,N).
SUPERVISAO: ESTAGIO (0,N) — SUPERVISOR (1,1).
CONCEDER: ESTAGIO (0,N) — INSTITUICAO CONCEDENTE (1,1).

# SOBSERVACOES
As cardinalidades foram transcritas conforme estão posicionadas visualmente na imagem, sem correções ou inversões.
O diagrama não mostra atributos, chaves primárias ou estrangeiras.
A generalização não possui restrições adicionais explicitadas.