import {
  MATRICULA_SIGAA,
  esquemaCpf,
  esquemaData,
  esquemaDadosPessoais,
  esquemaEmail,
  esquemaEndereco,
  esquemaCelular,
  esquemaTelefone,
  esquemaRg,
  esquemaSenha,
  type OpcoesSelecao,
} from "@/lib/domain/schemas";
import type { DadosPessoais, SituacaoUsuario, Usuario } from "@/lib/domain/types";
import type { Prisma } from "@/generated/prisma/client";
import { periodosDoCurso } from "@/lib/domain/selecoes";
import { ErroDeRegra } from "@/lib/domain/erros";

import { agora, obterEstado, novoId } from "./store";
import { definirSenha } from "./credenciais";
import { bancoConfigurado, carregarCliente } from "@/lib/db/prisma";
import { executarTransacao } from "@/lib/db/transacoes";
import { traduzirErroPersistencia } from "@/lib/db/erros";
import { listarOpcoesAcademicas, type OpcoesAcademicas } from "@/lib/db/repositorios/catalogo";

/**
 * Cadastro público do aluno em duas etapas visuais (5.1 a 5.5).
 *
 * A primeira etapa apenas confere formato e disponibilidade; nada é reservado
 * nem gravado. Todo o preenchimento permanece no estado temporário do
 * formulário do navegador. Na conclusão, o servidor recebe o formulário inteiro,
 * revalida todos os campos e grava a conta, a credencial e a solicitação (quando
 * exigida) como uma única operação de negócio.
 *
 * Regras preservadas:
 *
 * - a confirmação de senha divergente bloqueia o avanço com erro no campo;
 * - e-mail já cadastrado é recusado sem revelar se a conta existe;
 * - matrícula não registrada gera cadastro pendente, com mensagem de aguardo
 *   de autorização; a matrícula só passa a valer quando a coordenação confirma
 *   ou quando o administrador a cadastra em Matrículas;
 * - trocar o curso limpa turma e período.
 */

export interface EtapaUmCadastro {
  matricula: string;
  email: string;
  senha: string;
  confirmacao: string;
}

export interface EtapaDoisCadastro {
  nomeCompleto: string;
  cpf: string;
  rg: string;
  dataNascimento: string;
  telefone: string;
  celular: string;
  endereco: DadosPessoais["endereco"];
  cursoId: string;
  turmaId: string;
  periodoId: string;
}

/** Formulário completo recebido na conclusão; não existe prévia no servidor. */
export type DadosCadastroCompleto = EtapaUmCadastro & EtapaDoisCadastro;

export type CampoErro =
  | "matricula"
  | "email"
  | "senha"
  | "confirmacao"
  | "dados";

export type ResultadoCadastro =
  | {
      ok: true;
      matriculaNaoRegistrada: boolean;
      nome: string;
      mensagem: string;
    }
  | {
      ok: false;
      campo: CampoErro;
      erro: string;
    };

export type ResultadoConclusao =
  | { ok: true; usuarioId: string; situacao: SituacaoUsuario; solicitacaoId?: string }
  | { ok: false; campo: CampoErro; erro: string };

/** E-mail normalizado para comparação e gravação. */
function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mensagemDuplicada(): string {
  return "Não foi possível concluir o cadastro com esses dados. Revise e-mail e matrícula.";
}

/** Resposta da consulta antecipada: não revela qual dado está indisponível. */
function mensagemDisponibilidade(): string {
  return "Não foi possível continuar com esses dados. Revise e-mail e senha.";
}

function campoDoCodigo(codigo: string): CampoErro {
  if (codigo.includes("matricula")) return "matricula";
  if (codigo.includes("e_mail") || codigo.includes("email")) return "email";

  return "dados";
}

function traduzirParaCadastro(erro: unknown): ResultadoConclusao | null {
  const traduzido = traduzirErroPersistencia(erro);

  if (traduzido instanceof ErroDeRegra) {
    return {
      ok: false,
      campo: campoDoCodigo(traduzido.codigo),
      erro:
        traduzido.codigo === "matricula_ja_utilizada" ||
        traduzido.codigo === "e_mail_ja_utilizado_por_outro_cadastro"
          ? mensagemDuplicada()
          : traduzido.message,
    };
  }

  if (traduzido instanceof Error && traduzido.name === "BancoIndisponivelError") throw traduzido;

  return null;
}

function opcoesSelecaoDe(opcoes: OpcoesAcademicas): OpcoesSelecao {
  const cursosAtivos = opcoes.cursos.filter((curso) => curso.situacao === "ativo");
  const turmasAtivas = opcoes.turmas.filter((turma) => turma.situacao === "ativo");
  const periodosAtivos = opcoes.periodos.filter((periodo) => periodo.situacao === "ativo");

  return {
    cursosIds: cursosAtivos.map((curso) => curso.id),
    turmasPorCurso: Object.fromEntries(
      cursosAtivos.map((curso) => [
        curso.id,
        turmasAtivas.filter((turma) => turma.cursoId === curso.id).map((turma) => turma.id),
      ]),
    ),
    periodosIds: periodosAtivos.map((periodo) => periodo.id),
    periodosPorCurso: Object.fromEntries(
      cursosAtivos.map((curso) => [
        curso.id,
        periodosDoCurso(curso.id, turmasAtivas, periodosAtivos).map((periodo) => periodo.id),
      ]),
    ),
  };
}

function opcoesAcademicasSimuladas(): OpcoesAcademicas {
  const estado = obterEstado();

  return { cursos: estado.cursos, turmas: estado.turmas, periodos: estado.periodos };
}

/** Nome da matrícula registrada, quando existir; null quando ainda não consta. */
function nomeDaMatricula(matriculas: { matricula: string; nome: string }[], matricula: string) {
  return matriculas.find((registro) => registro.matricula === matricula)?.nome ?? null;
}

/** Validação completa do formulário, compartilhada pelos dois modos. */
function validarFormularioCompleto(
  dados: DadosCadastroCompleto,
  opcoes: OpcoesAcademicas,
): { ok: false; campo: CampoErro; erro: string } | { ok: true; dados: DadosPessoais } {
  const matricula = dados.matricula.trim();
  const email = normalizarEmail(dados.email);

  if (!MATRICULA_SIGAA.test(matricula)) {
    return { ok: false, campo: "matricula", erro: "Informe a matrícula do SIGAA." };
  }

  if (!esquemaEmail.safeParse(email).success || !esquemaSenha.safeParse(dados.senha).success) {
    return {
      ok: false,
      campo: "senha",
      erro: "Não foi possível continuar com esses dados. Revise e-mail e senha.",
    };
  }

  if (dados.senha !== dados.confirmacao) {
    return { ok: false, campo: "confirmacao", erro: "A confirmação não bate com a senha." };
  }

  const cpfValido = esquemaCpf.safeParse(dados.cpf);

  if (!cpfValido.success) return { ok: false, campo: "dados", erro: "Informe um CPF válido." };

  const nascimento = esquemaData.safeParse(dados.dataNascimento);

  if (!nascimento.success) {
    return { ok: false, campo: "dados", erro: "Informe uma data de nascimento válida." };
  }

  const endereco = esquemaEndereco.safeParse(dados.endereco);

  if (!endereco.success) {
    return { ok: false, campo: "dados", erro: "Confira o endereço informado." };
  }

  if (
    dados.nomeCompleto.trim().length < 3 ||
    !esquemaCelular.safeParse(dados.celular).success ||
    (dados.telefone.trim() !== "" && !esquemaTelefone.safeParse(dados.telefone).success) ||
    (dados.rg.trim() !== "" && !esquemaRg.safeParse(dados.rg).success)
  ) {
    return {
      ok: false,
      campo: "dados",
      erro: "Confira o nome, o celular e os contatos informados.",
    };
  }

  const completo = esquemaDadosPessoais(opcoesSelecaoDe(opcoes)).safeParse({
    nomeCompleto: dados.nomeCompleto.trim(),
    cpf: dados.cpf,
    rg: dados.rg.trim(),
    dataNascimento: dados.dataNascimento,
    email,
    telefone: dados.telefone.trim(),
    celular: dados.celular.trim(),
    endereco: dados.endereco,
    cursoId: dados.cursoId,
    turmaId: dados.turmaId,
    periodoId: dados.periodoId,
  });

  if (!completo.success) {
    const turmaInvalida = completo.error.issues.some((issue) => issue.path[0] === "turmaId");

    return {
      ok: false,
      campo: "dados",
      erro: turmaInvalida
        ? "Selecione curso, turma e período antes de concluir."
        : (completo.error.issues[0]?.message ?? "Confira os dados informados."),
    };
  }

  return { ok: true, dados: { ...completo.data, email } };
}

/**
 * Primeira etapa: confere formato e disponibilidade atuais. Não cria conta,
 * credencial, solicitação nem reserva e-mail/matrícula.
 */
export async function validarEtapaUm(dados: EtapaUmCadastro): Promise<ResultadoCadastro> {
  const matricula = dados.matricula.trim();
  const email = normalizarEmail(dados.email);

  if (!MATRICULA_SIGAA.test(matricula)) {
    return { ok: false, campo: "matricula", erro: "Informe a matrícula do SIGAA." };
  }

  if (!esquemaEmail.safeParse(email).success || !esquemaSenha.safeParse(dados.senha).success) {
    return {
      ok: false,
      campo: "senha",
      erro: "Não foi possível continuar com esses dados. Revise e-mail e senha.",
    };
  }

  if (dados.senha !== dados.confirmacao) {
    return { ok: false, campo: "confirmacao", erro: "A confirmação não bate com a senha." };
  }

  if (bancoConfigurado()) {
    const { prisma } = await carregarCliente();
    const [usuarioEmail, usuarioMatricula, importada] = await Promise.all([
      prisma.usuario.findUnique({ where: { email }, select: { id: true } }),
      prisma.usuario.findUnique({ where: { matricula }, select: { id: true } }),
      prisma.matriculaImportada.findUnique({
        where: { matricula },
        select: { nome: true },
      }),
    ]);

    if (usuarioEmail || usuarioMatricula) {
      return {
        ok: false,
        campo: usuarioEmail ? "email" : "matricula",
        erro: mensagemDisponibilidade(),
      };
    }

    return {
      ok: true,
      matriculaNaoRegistrada: importada === null,
      nome: importada?.nome ?? "",
      mensagem: importada
        ? "Matrícula registrada no sistema. Continue com seus dados pessoais."
        : "A matrícula não está registrada no sistema. O cadastro ficará pendente até a conferência da coordenação.",
    };
  }

  const estado = obterEstado();
  const emailEmUso = estado.usuarios.some(
    (usuario) => normalizarEmail(usuario.email) === email,
  );
  const matriculaEmUso = estado.usuarios.some((usuario) => usuario.matricula === matricula);

  if (emailEmUso || matriculaEmUso) {
    return {
      ok: false,
      campo: emailEmUso ? "email" : "matricula",
      erro: mensagemDisponibilidade(),
    };
  }

  const nome = nomeDaMatricula(estado.matriculas, matricula);

  return {
    ok: true,
    matriculaNaoRegistrada: nome === null,
    nome: nome ?? "",
    mensagem:
      nome === null
        ? "A matrícula não está registrada no sistema. O cadastro ficará pendente até a conferência da coordenação."
        : "Matrícula registrada no sistema. Continue com seus dados pessoais.",
  };
}

/** Conclusão única: revalida o formulário inteiro e grava de forma atômica. */
export async function concluirCadastro(
  dados: DadosCadastroCompleto,
): Promise<ResultadoConclusao> {
  if (bancoConfigurado()) return concluirCadastroPersistente(dados);

  return concluirCadastroSimulado(dados);
}

async function concluirCadastroPersistente(
  dados: DadosCadastroCompleto,
): Promise<ResultadoConclusao> {
  const email = normalizarEmail(dados.email);

  try {
    return await executarTransacao(async (tx) => {
      const opcoes = await listarOpcoesAcademicas(tx);
      const validado = validarFormularioCompleto(dados, opcoes);

      if (!validado.ok) return validado;

      const [usuarioEmail, usuarioMatricula] = await Promise.all([
        tx.usuario.findUnique({ where: { email }, select: { id: true } }),
        tx.usuario.findUnique({ where: { matricula: dados.matricula.trim() }, select: { id: true } }),
      ]);

      if (usuarioEmail || usuarioMatricula) {
        return {
          ok: false as const,
          campo: usuarioEmail ? ("email" as const) : ("matricula" as const),
          erro: mensagemDuplicada(),
        };
      }

      const importada = await tx.matriculaImportada.findUnique({
        where: { matricula: dados.matricula.trim() },
        select: { nome: true },
      });
      const situacao: SituacaoUsuario = importada ? "ativo" : "pendente";
      const nome = dados.nomeCompleto.trim();
      const { criarAutenticacaoCadastro } = await import("@/lib/auth/autenticacao");
      const { carregarConfiguracaoAutenticacao } = await import("@/lib/auth/configuracao");
      const autenticacao = criarAutenticacaoCadastro(tx, carregarConfiguracaoAutenticacao());

      const resposta = await autenticacao.api.signUpEmail({
        body: { name: nome, email, password: dados.senha },
      });
      const criado = await tx.usuario.findUnique({
        where: { id: resposta.user.id },
        include: { authAccounts: { select: { providerId: true } } },
      });

      // Resposta sintética para e-mail existente não pode ser tratada como
      // identidade nova nem receber vínculos de domínio.
      if (
        !criado ||
        criado.email !== email ||
        !criado.authAccounts.some((conta) => conta.providerId === "credential")
      ) {
        throw new ErroDeRegra(mensagemDuplicada(), "cadastro_duplicado");
      }

      const dadosPessoais: DadosPessoais = { ...validado.dados, email };

      await tx.usuario.update({
        where: { id: criado.id },
        data: {
          nome,
          papel: "aluno",
          situacao,
          campus: "Pinheiral",
          matricula: dados.matricula.trim(),
          membroComissaoEstagio: false,
          dadosPessoais: dadosPessoais as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.dadosPessoaisAluno.create({
        data: {
          id: novoId("dp"),
          usuarioId: criado.id,
          cpf: dadosPessoais.cpf,
          rg: dadosPessoais.rg,
          dataNascimento: new Date(`${dadosPessoais.dataNascimento}T00:00:00.000Z`),
          telefone: dadosPessoais.telefone,
          celular: dadosPessoais.celular,
          endereco: dadosPessoais.endereco as unknown as Prisma.InputJsonValue,
          cursoId: dadosPessoais.cursoId,
          turmaId: dadosPessoais.turmaId,
          periodoId: dadosPessoais.periodoId,
        },
      });

      let solicitacaoId: string | undefined;

      if (situacao === "pendente") {
        solicitacaoId = novoId("sol");
        await tx.solicitacaoAcesso.create({
          data: {
            id: solicitacaoId,
            usuarioId: criado.id,
            cursoId: dadosPessoais.cursoId,
            situacao: "pendente",
            motivo: "Matrícula não está registrada no sistema.",
          },
        });
      }

      return { ok: true as const, usuarioId: criado.id, situacao, solicitacaoId };
    });
  } catch (erro) {
    const traduzido = traduzirParaCadastro(erro);

    if (traduzido) return traduzido;

    // O provedor de autenticação engole a violação de unicidade do banco e
    // devolve um APIError genérico. Como a checagem prévia já foi feita, uma
    // conta existente confirma a corrida entre duas conclusões simultâneas.
    if (erro instanceof Error && erro.name === "APIError") {
      try {
        const { prisma } = await carregarCliente();
        const existente = await prisma.usuario.findFirst({
          where: { OR: [{ email }, { matricula: dados.matricula.trim() }] },
          select: { email: true },
        });

        if (existente) {
          return {
            ok: false,
            campo: existente.email === email ? ("email" as const) : ("matricula" as const),
            erro: mensagemDuplicada(),
          };
        }
      } catch {
        // Se nem a leitura de confirmação funcionar, preserva o erro original.
      }
    }

    throw erro;
  }
}

async function concluirCadastroSimulado(
  dados: DadosCadastroCompleto,
): Promise<ResultadoConclusao> {
  const estado = obterEstado();
  const email = normalizarEmail(dados.email);
  const matricula = dados.matricula.trim();

  if (
    estado.usuarios.some((usuario) => normalizarEmail(usuario.email) === email) ||
    estado.usuarios.some((usuario) => usuario.matricula === matricula)
  ) {
    return { ok: false, campo: "email", erro: mensagemDuplicada() };
  }

  const validado = validarFormularioCompleto(dados, opcoesAcademicasSimuladas());

  if (!validado.ok) return validado;

  const nomeRegistrado = nomeDaMatricula(estado.matriculas, matricula);
  const situacao: SituacaoUsuario = nomeRegistrado === null ? "pendente" : "ativo";
  const dadosPessoais: DadosPessoais = { ...validado.dados, email };
  const usuario: Usuario = {
    id: novoId("usr"),
    nome: nomeRegistrado || dados.nomeCompleto.trim(),
    email,
    papel: "aluno",
    situacao,
    campus: "Pinheiral",
    matricula,
    dadosPessoais,
    membroComissaoEstagio: false,
    criadoEm: agora(),
  };

  estado.usuarios.push(usuario);
  await definirSenha(email, dados.senha, "cadastro_publico");

  let solicitacaoId: string | undefined;

  if (situacao === "pendente") {
    solicitacaoId = novoId("sol");
    estado.solicitacoes.push({
      id: solicitacaoId,
      nome: usuario.nome,
      email: usuario.email,
      matricula,
      dadosPessoais,
      situacao: "pendente" as const,
      motivo: "Matrícula não está registrada no sistema.",
      criadoEm: agora(),
    });
  }

  return { ok: true, usuarioId: usuario.id, situacao, solicitacaoId };
}

