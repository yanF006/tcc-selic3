import { MATRICULA_SIGAA, esquemaCpf, esquemaEmail, esquemaSenha } from "@/lib/domain/schemas";
import type { DadosPessoais, Endereco, SituacaoUsuario, Usuario } from "@/lib/domain/types";

import { agora, obterEstado, novoId } from "./store";

/**
 * Cadastro público do aluno em duas etapas (5.2 a 5.7).
 *
 * A primeira etapa confere e-mail e matrícula; a segunda grava os dados
 * pessoais e o vínculo com curso, turma e período. Tudo fica em memória (D4) e
 * a matrícula é imutável depois do cadastro (D3).
 *
 * Regras que a implementação precisa respeitar:
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
  endereco: Endereco;
  cursoId: string;
  turmaId: string;
  periodoId: string;
}

export interface PreviaCadastro {
  id: string;
  matricula: string;
  email: string;
  nome: string;
  /** true quando a matrícula ainda não está registrada no sistema. */
  matriculaNaoRegistrada: boolean;
  criadoEm: string;
}

export type ResultadoCadastro =
  | {
      ok: true;
      previa: PreviaCadastro;
      mensagem: string;
    }
  | {
      ok: false;
      campo: "matricula" | "email" | "senha" | "confirmacao" | "dados";
      erro: string;
    };

export type ResultadoConclusao =
  | { ok: true; usuarioId: string; situacao: SituacaoUsuario; solicitacaoId?: string }
  | { ok: false; campo: "previa" | "dados"; erro: string };

/** Prévia mantida em memória entre as duas etapas do cadastro. */
const previas = new Map<string, PreviaCadastro & { senha: string }>();

/** E-mail normalizado para comparação. */
function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** true quando o e-mail já pertence a um cadastro ou a uma conta simulada. */
function emailEmUso(email: string): boolean {
  const estado = obterEstado();
  const alvo = normalizarEmail(email);

  return estado.usuarios.some((usuario) => normalizarEmail(usuario.email) === alvo);
}

/**
 * Primeira etapa: confere senha, unicidade de e-mail e matrícula importada.
 * Erros de e-mail e de senha usam a mesma mensagem genérica, para não revelar
 * se a conta existe.
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

  if (emailEmUso(email)) {
    return {
      ok: false,
      campo: "email",
      erro: "Não foi possível continuar com esses dados. Revise e-mail e senha.",
    };
  }

  const importada = obterEstado().matriculas.find((registro) => registro.matricula === matricula);
  const previa: PreviaCadastro & { senha: string } = {
    id: novoId("cad"),
    matricula,
    email,
    nome: importada?.nome ?? "",
    matriculaNaoRegistrada: importada === undefined,
    senha: dados.senha,
    criadoEm: agora(),
  };

  previas.set(previa.id, previa);

  return {
    ok: true,
    previa: {
      id: previa.id,
      matricula: previa.matricula,
      email: previa.email,
      nome: previa.nome,
      matriculaNaoRegistrada: previa.matriculaNaoRegistrada,
      criadoEm: previa.criadoEm,
    },
    mensagem: previa.matriculaNaoRegistrada
      ? "A matrícula não está registrada no sistema. O cadastro ficará pendente até a conferência da coordenação."
      : "Matrícula registrada no sistema. Continue com seus dados pessoais.",
  };
}

/**
 * Segunda etapa: grava o cadastro. Matrícula não registrada vira solicitação de
 * acesso pendente e usuário `pendente`, que não entra nas áreas autenticadas.
 */
export async function concluirCadastro(
  previaId: string,
  dados: EtapaDoisCadastro,
): Promise<ResultadoConclusao> {
  const previa = previas.get(previaId);

  if (!previa) {
    return {
      ok: false,
      campo: "previa",
      erro: "O cadastro expirou. Recomece pela primeira etapa.",
    };
  }

  const estado = obterEstado();

  if (emailEmUso(previa.email)) {
    return {
      ok: false,
      campo: "dados",
      erro: "Não foi possível concluir o cadastro com esses dados. Revise e-mail e senha.",
    };
  }

  const curso = estado.cursos.find((item) => item.id === dados.cursoId);
  const turma = estado.turmas.find(
    (item) => item.id === dados.turmaId && item.cursoId === dados.cursoId,
  );
  const periodo = estado.periodos.find((item) => item.id === dados.periodoId);

  if (!curso || !turma || !periodo) {
    return {
      ok: false,
      campo: "dados",
      erro: "Selecione curso, turma e período antes de concluir.",
    };
  }

  const cpfValido = esquemaCpf.safeParse(dados.cpf);

  if (!cpfValido.success) {
    return { ok: false, campo: "dados", erro: "Informe um CPF válido." };
  }

  const dadosPessoais: DadosPessoais = {
    nomeCompleto: dados.nomeCompleto.trim(),
    cpf: dados.cpf.trim(),
    rg: dados.rg.trim(),
    dataNascimento: dados.dataNascimento,
    email: previa.email,
    telefone: dados.telefone.trim(),
    celular: dados.celular.trim(),
    endereco: dados.endereco,
    cursoId: curso.id,
    turmaId: turma.id,
    periodoId: periodo.id,
  };

  const situacao: SituacaoUsuario = previa.matriculaNaoRegistrada ? "pendente" : "ativo";
  const usuario: Usuario = {
    id: novoId("usr"),
    nome: previa.nome || dados.nomeCompleto.trim(),
    email: previa.email,
    papeis: ["aluno"],
    situacao,
    campus: "Pinheiral",
    matricula: previa.matricula,
    dadosPessoais,
    membroComissaoEstagio: false,
    criadoEm: agora(),
  };

  estado.usuarios.push(usuario);

  let solicitacaoId: string | undefined;

  if (previa.matriculaNaoRegistrada) {
    solicitacaoId = novoId("sol");

    estado.solicitacoes.push({
      id: solicitacaoId,
      nome: usuario.nome,
      email: usuario.email,
      matricula: previa.matricula,
      dadosPessoais,
      situacao: "pendente",
      motivo: "Matrícula não está registrada no sistema.",
      criadoEm: agora(),
    });
  }

  previas.delete(previaId);

  return { ok: true, usuarioId: usuario.id, situacao, solicitacaoId };
}

/** Remove préviews abandonadas; usado pelos testes. */
export function limparPrevias(): void {
  previas.clear();
}
