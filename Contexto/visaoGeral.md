# Sistema de Gerenciamento de Documentos de Estágio (SELic)

## 1. Objetivo do Sistema

Trabalho de conclusão de curso técnico em Informática. Desenvolver um website para gerenciamento dos documentos de estágio para os cursos de licenciatura do IFRJ Campus Pinheiral.

## 2. Contexto

O IFRJ Campus Pinheiral é uma universidade pública brasileira, que oferece cursos de Licenciatura em Ciências Biológicas e de Licenciatura em Computação, cujos alunos devem estagiar obrigatoriamente.

O sistema foi solicitado pela coordenadora do curso de Licenciatura em Ciências Biológicas, que a partir de agora será referida como cliente, e por isso sempre deve atender às suas necessidades.

O coordenador de estágios será o futuro administrador do site, além da equipe de Informática do Campus.

## 3. Regulamentação

O sistema sempre deve estar de acordo com a seguinte regulamentação:

- [Resolução CNE nº 1/2002](http://portal.mec.gov.br/index.php?option=com_docman&view=download&alias=159261-rcp001-02&category_slug=outubro-2020-pdf&Itemid=30192)
- [Lei nº 11.788/2008, a Lei de Estágio](http://www.planalto.gov.br/ccivil_03/_ato2007-2010/2008/lei/l11788.htm)
- [Resolução CONSUP/IFRJ nº 3/2015, Regulamento de Ensino de Graduação do IFRJ](https://portal.ifrj.edu.br/ckfinder/userfiles/files/PROGRAD/IFRJ%20Regulamento%20aprovado%20em%202014-2015%20-%20Assinado.pdf)
- [Resolução CONSUP/IFRJ nº 27/2018, Regulamento do Estágio Obrigatório dos Cursos de Licenciatura do IFRJ](https://portal.ifrj.edu.br/sites/default/files/IFRJ/PROGRAD/regulamento_de_estagio_dos_cursos_de_licenciatura_novo.pdf)
- Lei Geral de Proteção de Dados (LGPD - Brasil)

## 4. Usuários e Cargos

O sistema é acessado por coordenadores de estágio, coordenadores de curso, alunos e administradores.

Atualmente, os administradores são os próprios desenvolvedores, mas no futuro haverá outras pessoas responsáveis por manter o site.

- **Administradores** têm todos os privilégios do sistema.
  - CRUD de alunos
  - CRUD de coordenadores de estágio
  - CRUD de coordenadores de curso
  - CRUD de administradores
  - Gerenciamento de templates de documentos
  - Importação/recebimento de matrículas do SIGAA
- **Coordenadores de estágio** cadastram e gerenciam:
  - Convênios
  - Cursos
  - Orientadores
  - Supervisores
  - Templates de documentos
  - Têm acesso a todos os documentos preenchidos, além de estatísticas extraídas desses documentos.
- **Coordenadores de curso**:
  - Têm acesso aos documentos preenchidos por alunos de seu curso, além de estatísticas extraídas desses documentos.
  - Podem fazer CRUD de estágios dos alunos de seu curso.
  - Emitem parecer sobre os documentos que exigem a sua avaliação.
- **Alunos**:
  - Cadastram seus dados, utilizando-os para preencher seus documentos.
  - Fazem CRUD de seus estágios e selecionam quais documentos desejam preencher para cada estágio.
  - Têm acesso aos documentos disponibilizados para download.

## 5. Funcionalidades

A cliente está de acordo com as seguintes funcionalidades:

- **Cadastro de convênios para estágios**: há um livro físico em que estão listados os convênios. O site deve conter as informações desse livro. Também haverá possibilidade de cadastrar novos convênios. Os convênios serão classificados em ativos ou expirados.
- **Cadastro de alunos**: as informações dos alunos ficam salvas no site.
- **Cadastro de estágios**: o aluno cadastra um estágio com as informações necessárias (instituição, supervisor, orientador, datas) e, em seguida, seleciona quais documentos quer preencher para aquele estágio.
- **Preenchimento de documentos para estágios**: ao invés de preencher campos no Word ou no papel, o aluno ou o coordenador preenche suas informações no site, que gera um documento para impressão. Com os dados do aluno cadastrado, algumas informações são preenchidas automaticamente. Os documentos são gerados em formato docx (via gerador de documentos/docxtemplater) e pdf, com preview no navegador.
- **Registro de horas de estágio**: o site permite o preenchimento das horas conforme o aluno digita (frequência diária, horas trabalhadas, etc.).
- **Sistema de cargos**.
- **Sistema de parecer**: documentos que exigem avaliação de um usuário do sistema (ex.: coordenador de curso, comissão de estágio) são submetidos a parecer. Quando a avaliação é de um usuário do sistema, o sistema notifica o perfil responsável e permite a entrada do parecer. Quando o responsável não é usuário do sistema (ex.: supervisor, orientador externo), o sistema envia um e-mail. Caso o e-mail não esteja disponível, o sistema notifica o aluno.
- **Disponibilização de documentos importantes**: documentos importantes para os alunos ou coordenadores serão disponibilizados para download.
- **Envio de documentos para assinatura**: o sistema envia, por e-mail, o documento a ser assinado como anexo para supervisores e orientadores. Eles apenas recebem o documento, assinam (fisicamente) e devolvem para o e-mail do aluno. Não há assinatura eletrônica no sistema.
- **Gerenciamento de templates**: os documentos do kit estão todos vigentes (são os mais recentes). O sistema deve permitir adicionar novos templates conforme os documentos forem mudando.

## 6. Tela de Login

Entrar com email e senha.

- Opção de se cadastrar.
- Trocar senha através do email.
- O email identifica o usuário, ou seja, apenas um usuário por email.

## 7. Fluxo de Utilização do Aluno

### 7.1 Tela de Cadastro do Aluno

Só o aluno pode cadastrar a si mesmo; já os outros cargos são cadastrados pelo administrador. Primeiramente, o usuário informa:

- Matrícula
- Email
- Senha
- Confirmação da senha

Para que o usuário continue, sua matrícula precisa ser válida. Matrículas válidas são aquelas que já se encontram registradas no sistema (provenientes do SIGAA ou do cadastro de administradores). Caso a matrícula seja inválida, algum coordenador de estágios, coordenador do curso do aluno ou administrador precisa autorizar o cadastro.

Depois, o aluno preenche os seguintes campos (todos são obrigatórios, exceto quando indicado o contrário):

- Nome
- Data de Nascimento
- CPF (validar conforme regulamentação brasileira)
- RG (não obrigatório)
- Celular
- Telefone (não obrigatório)
- CEP
- Endereço
  - Logradouro
  - Número
  - Bairro
  - Complemento (não obrigatório)
  - Estado
  - Cidade
- Curso
- Turma e Período

#### Validação

- Usar máscaras de entrada.
- Curso, Turma, Período devem ser selecionados entre as opções previamente cadastradas.
- Validar telefone e celular.
- Validar email.
- Validar CEP e usá-lo para buscar o endereço completo.

### 7.2 Navbar do Aluno

- Logo (SELic)
- Documentos
  - Redireciona para uma tela na qual o usuário escolhe um template de documento para ser preenchido, ou documento fixo para download.
- Estágio
  - Redireciona para uma tela que mostra o histórico de estágios do usuário.
- Perfil
  - Redireciona para uma tela que permite ao usuário mudar suas informações pessoais.

### 7.3 Cadastro e Lista de Estágios do Aluno

O aluno tem um CRUD completo de seus estágios. Ao cadastrar um estágio, informa:

- Nome da instituição (concedente)
- Supervisor
- Orientador
- Data de início e Data de fim
- Situação (em andamento / concluído)

Após cadastrar o estágio, o aluno seleciona quais documentos deseja preencher para aquele estágio. Para cada estágio listado, mostrar:

- Nome da instituição
- Supervisor
- Orientador
- Data início e Data fim
- Detalhes (redireciona para uma tela que mostra todas as informações desse estágio específico)
- Documentos preenchidos (redireciona para uma tela que permite escolher qualquer documento previamente preenchido relacionado a esse estágio)

O coordenador de curso pode fazer CRUD dos estágios dos alunos de seu curso (além das regras gerais de exclusão da seção 11).

### 7.4 Tela de Seleção de Documentos (todos os cargos têm acesso)

Mostra todos os templates e documentos para download. Cada template redireciona para uma tela de preenchimento. Todos os documentos são para download e preenchimento, exceto quando indicado o contrário:

1. Lei de Estágio (apenas download)
2. Regulamento de Estágio dos Cursos de Licenciatura (apenas download)
3. Convênio de Estágio Campus Pinheiral (download e preenchimento por coordenador de estágios)
4. Formulário de Liberação Licenciatura
5. Plano de Atividades de Estágio
6. Termo de Compromisso Licenciatura
7. Ficha de Acompanhamento de Estágio
8. Ficha de Frequência e Avaliação do Estagiário
9. Relatório Semestral de Estágio 2019
10. Requerimento para Aproveitamento de Horas Licenciatura
11. Termo Aditivo
12. Proposta de Atuação Pedagógica

Os documentos são os mesmos para todos os cursos de licenciatura do Campus.

#### Formato

Usar formato docx e pdf. Mostrar preview dos documentos no navegador. A geração é feita a partir dos templates do "Kit de Estágio", que estão todos vigentes.

#### Gerenciamento de Templates

O administrador (e/ou coordenador de estágios) pode adicionar novos templates conforme os documentos oficiais forem mudando, incluindo os campos de preenchimento correspondentes. Os templates devem ser arquivos .docx; arquivos .doc legados do kit são convertidos uma única vez (fora do sistema) antes do cadastro, não havendo conversão de formato em tempo de execução.

### 7.5 Tela de Perfil

Permite editar todas as informações cadastradas inicialmente, exceto a matrícula. Validar conforme o cadastro é validado.

## 8. Sistema de Parecer e Notificações

Quando um documento exige parecer/avaliação:

- **Parecer de usuário do sistema** (ex.: coordenador de curso, coordenador de estágios/comissão de estágio, administrador): o sistema notifica o perfil responsável (sinalização na interface) e permite a entrada do parecer (aprovar, reprovar/indeferir, considerações).
- **Parecer de não usuário do sistema** (ex.: supervisor, orientador externo, concedente): o sistema envia e-mail com o documento em anexo.
- **E-mail indisponível**: o sistema notifica o aluno, que deve buscar a resposta pelo meio convencional.

Documentos com parecer (definidos na matriz, seção 10):

- Formulário de Liberação → parecer do coordenador de curso (usuário do sistema).
- Requerimento para Aproveitamento de Horas → parecer da Comissão de Estágio (coordenador de estágios, usuário do sistema).
- Relatório Semestral → "Aprovado por" o professor orientador (externo, via e-mail), além do acompanhamento do coordenador.

## 9. Envio de Documentos para Assinatura

- O sistema envia o documento a ser assinado **apenas como anexo de e-mail**.
- Supervisores, orientadores e representantes de concedentes **recebem, assinam fisicamente e devolvem** o documento para o e-mail do aluno.
- Não há fluxo de assinatura eletrônica.
- O envio é acionado pelo aluno (ou pelo coordenador, quando aplicável) e registrado no sistema.

## 10. Matriz: Documento × Preenchimento × Parecer × Assinatura

| # | Documento | Preenchido por | Parecer/Avaliação | Quem assina |
|---|-----------|----------------|-------------------|-------------|
| 1 | Lei de Estágio | — (somente download) | — | — |
| 2 | Regulamento de Estágio | — (somente download) | — | — |
| 3 | Convênio de Estágio Campus Pinheiral | Coordenador de estágios | — | Representante IFRJ (Diretor Geral) e representante da conveniada (externo) |
| 4 | Formulário de Liberação | Aluno | Coordenador de curso (usuário, notificação no perfil) | Coordenador de curso |
| 5 | Plano de Atividades de Estágio | Aluno | — | Supervisor do local de estágio (externo, e-mail) |
| 6 | Termo de Compromisso | Aluno | — | Concedente (externo, e-mail), Estagiário, IFRJ e 2 testemunhas |
| 7 | Ficha de Acompanhamento | Aluno (registro de horas conforme digita) | — | Aluno e Supervisor do local (externo) |
| 8 | Ficha de Frequência e Avaliação | Concedente/Supervisor (carga horária e avaliação) | — | Responsável da concedente (externo, e-mail) e responsável da COIEE (IFRJ) |
| 9 | Relatório Semestral | Aluno | "Aprovado por" professor orientador (externo, e-mail) | Aluno e Professor orientador |
| 10 | Requerimento para Aproveitamento de Horas | Aluno | Comissão de Estágio (coordenador de estágios, usuário) | Coordenador de curso, Diretor de Ensino, Coordenador da COIEE |
| 11 | Termo Aditivo | Aluno | — | Concedente (externo, e-mail), Estagiário, Convenente |
| 12 | Proposta de Atuação Pedagógica | Aluno | — | Aluno e Professor orientador (externo) |

Observações da matriz:

- Quando o assinante/parecerista é usuário do sistema, a entrada da assinatura/parecer é feita no site com emissão de notificação no perfil. Quando é externo, o documento é enviado por e-mail com anexo; se o e-mail estiver indisponível, o aluno é notificado.
- O Formulário de Liberação (04) e o Plano de Atividades (05) são entidades/templates separados (mantidos independentes).
- Como os documentos são os mesmos para todos os cursos de licenciatura, a Proposta de Atuação Pedagógica deve ser genérica (não exclusiva da Licenciatura em Computação).

## 11. Regras de Exclusão (Integridade Referencial)

Princípio geral: **se uma informação depende de outra, a informação da qual se depende não pode ser excluída**. Aplicam-se soft delete (inativação) sempre que existir histórico, preservando os dados para documentos e estatísticas.

- **Aluno**: pode ser excluído, permitindo que dados pessoais possam ser removidos.
- **Estágio**: exclusão permite o histórico; exige autorização de cargo superior (seção 12). Ao excluir, os documentos preenchidos vinculados são inativados (mantidos para consulta do coordenador).
- **Convênio**: não pode ser excluído se houver estágio vinculado → inativação (passa a "expirado").
- **Curso**: não pode ser excluído se houver alunos, turmas, estágios ou documentos vinculados → inativação.
- **Turma/Período**: não pode ser excluído se houver alunos vinculados.
- **Orientador ou Supervisor**: podem ser excluídos, permitindo que dados pessoais possam ser removidos.
- **Coordenador de curso / coordenador de estágios / administrador**: podem ser excluídos, permitindo que dados pessoais possa ser removidos.
- **Template de documento**: não pode ser excluído se houver documentos gerados a partir dele → inativação.

## 12. Segurança e Privacidade

- Usuários não podem acessar dados aos quais não possuem permissão.
- A recuperação de senha deve usar um mecanismo seguro de redefinição (email ou autorização do administrador).
- Algumas ações precisam ser autorizadas por um cargo superior:
  - Excluir estágio.
  - Cadastrar aluno cuja matrícula não está registrada no sistema.
- Sempre usar máscaras de entrada e outras validações quando possível.
- Conformidade com a LGPD (ver seção 13).

### 12.1 LGPD - Implicações ao acessar dados do SIGAA

O sistema deve requisitar do IFRJ a forma oficial de acesso aos dados do SIGAA (API/exportação) e, enquanto não houver integração formal (situação atual), os administradores inserem as matrículas manualmente.

## 13. Informações do SIGAA

Buscar informações de alunos, coordenadores de curso e coordenadores de estágios no SIGAA (matrículas para validação de cadastro de aluno). As matrículas vêm do SIGAA e do cadastro de administradores.

Ver implicações de LGPD na seção 12.1.

## 14. Extração de Estatísticas

Pesquisar estágios (mostrar as mesmas informações que o aluno vê) por:

- Aluno
- Orientador
- Supervisor
- Instituição

Filtrar estágios já concluídos. Mostrar quantos estágios estão sendo realizados por cada filtro.

**Quanto mais estatísticas, melhor.** Estatísticas sugeridas (a validar com a cliente):

- Nº de estágios por aluno, orientador, supervisor e instituição.
- Nº de estágios em andamento vs. concluídos.
- Convênios ativos vs. expirados.
- Horas totais de estágio por aluno, por curso, por turma/período e por instituição.
- Distribuição de estágios por curso e por ano/semestre.
- Quantidade de documentos gerados por tipo de documento.
- Horas por modalidade (estágio / projeto-monitoria-prática profissional) quando informada.
- Taxa de aproveitamento de horas (requerimentos deferidos vs. indeferidos).
- Relação de estágios sem parecer final (pendências).

## 15. Banco de Dados

MySQL, hospedado na plataforma Aiven. Sempre que alterar o banco de dados, gerar backup em arquivo .SQL.

## 16. UI e UX

Padrão de cores em que o verde é principal. Responsividade, pois o website será acessado em PCs e dispositivos móveis.

## 17. Tecnologia

- Geração de documentos docx a partir dos templates do Kit de Estágio utilizando **docxtemplater** (já validado em protótipos).
- Preview dos documentos no navegador, via renderização client-side do arquivo docx.
- Geração de PDF
- Envio de e-mails (com anexo docx e pdf) para supervisores, orientadores e demais assinantes externos.
- Validações e máscaras de entrada no frontend e no backend.
- Stack: **Next.js (React)** com back end integrado (route handlers), **Prisma** como ORM e **Nodemailer** para e-mails.
- Hospedagem do site na **Vercel**. Banco de dados MySQL hospedado no **Aiven** (ver seção 15).
