import { metadadoUsuario } from "@/lib/domain/status";
import { MATRICULA_SIGAA } from "@/lib/domain/schemas";
import { cursoDoUsuario } from "@/lib/domain/usuario";
import type {
  Campus,
  MatriculaImportada,
  Pagina,
  Papel,
  ResultadoImportacao,
  SituacaoUsuario,
  SolicitacaoAcesso,
  Usuario,
} from "@/lib/domain/types";

import { agora, obterEstado, novoId } from "./store";
import { filtrarPorTexto, paginar } from "./paginacao";

import {
  excluirUsuarioDoBanco,
  garantirHidratacao,
  gravarMatricula,
  gravarUsuario,
} from "@/lib/db/persistencia";

import { ErroDeRegra } from "./erros";

/**
 * Administração do sistema (bloco 8): usuários, solicitações de acesso e
 * matrículas registradas. Toda mutação acontece em memória e vale enquanto a aba
 * do navegador estiver aberta (D4).
 *
 * Regra de matrícula: uma matrícula vale quando está **registrada no sistema**,
 * seja por importação, seja por lançamento manual do administrador, seja quando a
 * coordenação autoriza um cadastro pendente, seja quando o cadastro do aluno pelo
 * administrador registra a matrícula que ainda não existia. Não existe autorização
 * avulsa no cadastro de aluno.
 */

export interface ConsultaUsuarios {
  papel?: Papel;
  situacao?: SituacaoUsuario;
  /** Filtra pelo curso vinculado ao aluno ou ao coordenador de curso. */
  cursoId?: string;
  busca?: string;
  pagina?: number;
  tamanho?: number;
}

export interface ConsultaSolicitacoes {
  situacao?: SolicitacaoAcesso["situacao"];
  busca?: string;
  pagina?: number;
  tamanho?: number;
}

export interface CadastroUsuario {
  nome: string;
  email: string;
  papeis: Papel[];
  campus?: Campus;
  matricula?: string;
  cursoId?: string;
  /** Marca o cadastro como membro da Comissão de Estágio. */
  membroComissaoEstagio?: boolean;
}

export interface LinhaImportacao {
  matricula: string;
  nome: string;
  curso: string;
}

/** Ordena por nome normalizado, para listas previsíveis entre busca e paginação. */
function porNome<T extends { nome: string }>(a: T, b: T): number {
  return a.nome.localeCompare(b.nome, "pt-BR");
}

/** true quando a matrícula já vale no sistema, venha de onde vier. */
export async function matriculaRegistrada(matricula: string): Promise<boolean> {
  await garantirHidratacao();

  return obterEstado().matriculas.some((registro) => registro.matricula === matricula.trim());
}

/** Nome do curso de uma matrícula, para o registro feito a partir do cadastro. */
function nomeDoCurso(cursoId: string): string {
  return obterEstado().cursos.find((curso) => curso.id === cursoId)?.nome ?? "Não informado";
}

export async function listarUsuarios(consulta: ConsultaUsuarios = {}): Promise<Pagina<Usuario>> {
  await garantirHidratacao();

  const estado = obterEstado();
  const busca = filtrarPorTexto(estado.usuarios, consulta.busca ?? "", (usuario) => [
    usuario.nome,
    usuario.email,
    usuario.matricula ?? "",
  ]);

  const filtrados = busca
    .filter((usuario) => !consulta.papel || usuario.papeis.includes(consulta.papel))
    .filter((usuario) => !consulta.situacao || usuario.situacao === consulta.situacao)
    .filter((usuario) => !consulta.cursoId || cursoDoUsuario(usuario) === consulta.cursoId)
    .sort(porNome);

  return paginar(filtrados, consulta);
}

export async function usuarioPorId(id: string): Promise<Usuario | null> {
  await garantirHidratacao();

  return obterEstado().usuarios.find((usuario) => usuario.id === id) ?? null;
}

/** Usuário pelo e-mail, que é o identificador do login; null quando não existe. */
export async function usuarioPorEmail(email: string): Promise<Usuario | null> {
  await garantirHidratacao();

  const alvo = email.trim().toLowerCase();

  return (
    obterEstado().usuarios.find((usuario) => usuario.email.trim().toLowerCase() === alvo) ?? null
  );
}

export async function contarUsuariosPorSituacao(): Promise<Record<SituacaoUsuario, number>> {
  await garantirHidratacao();

  const usuarios = obterEstado().usuarios;

  return {
    ativo: usuarios.filter((usuario) => usuario.situacao === "ativo").length,
    inativo: usuarios.filter((usuario) => usuario.situacao === "inativo").length,
    pendente: usuarios.filter((usuario) => usuario.situacao === "pendente").length,
  };
}

export async function cadastrarUsuario(cadastro: CadastroUsuario): Promise<Usuario> {
  await garantirHidratacao();

  const estado = obterEstado();
  const email = cadastro.email.trim().toLowerCase();

  if (!cadastro.nome.trim())
    throw new ErroDeRegra("Informe o nome do usuário.", "informe_o_nome_do_usuario");
  if (!email.includes("@"))
    throw new ErroDeRegra("Informe um e-mail válido.", "informe_um_e_mail_valido");
  if (cadastro.papeis.length === 0) {
    throw new ErroDeRegra(
      "Escolha o papel antes de concluir o cadastro.",
      "escolha_o_papel_antes_de_concluir_o_cadastro",
    );
  }

  if (estado.usuarios.some((usuario) => usuario.email.toLowerCase() === email)) {
    throw new ErroDeRegra(
      "E-mail já utilizado por outro cadastro.",
      "e_mail_ja_utilizado_por_outro_cadastro",
    );
  }

  const campus = cadastro.campus ?? "Pinheiral";

  if (campus !== "Pinheiral") {
    throw new ErroDeRegra(
      "O sistema atende somente o Campus Pinheiral.",
      "o_sistema_atende_somente_o_campus_pinheiral",
    );
  }

  const matricula = cadastro.matricula?.trim();

  if (cadastro.papeis.includes("aluno")) {
    if (!matricula)
      throw new ErroDeRegra("Informe a matrícula do aluno.", "informe_a_matricula_do_aluno");

    if (!MATRICULA_SIGAA.test(matricula)) {
      throw new ErroDeRegra(
        "Informe a matrícula com 11 dígitos.",
        "informe_a_matricula_com_onze_digitos",
      );
    }

    // O cadastro do aluno registra a matrícula que ainda não consta, com a origem
    // do cadastro de administrador, e libera o acesso na mesma operação. Quem já
    // está registrado mantém o registro existente, sem duplicar.
    if (!(await matriculaRegistrada(matricula))) {
      const registro = {
        id: novoId("mat"),
        matricula,
        nome: cadastro.nome.trim(),
        curso: cadastro.cursoId ? nomeDoCurso(cadastro.cursoId) : "Não informado",
        origem: "cadastro_administrador" as const,
        importadaEm: agora(),
      };

      estado.matriculas.push(registro);
      await gravarMatricula(registro);
    }
  }

  const usuario: Usuario = {
    id: novoId("usr"),
    nome: cadastro.nome.trim(),
    email,
    papeis: [...cadastro.papeis],
    situacao: "ativo",
    campus,
    matricula,
    cursoId: cadastro.cursoId,
    membroComissaoEstagio: false,
    criadoEm: agora(),
  };

  estado.usuarios.push(usuario);
  await gravarUsuario(usuario);

  return usuario;
}

export async function editarUsuario(
  id: string,
  alteracoes: Partial<CadastroUsuario> & { nome?: string; situacao?: SituacaoUsuario },
): Promise<Usuario> {
  await garantirHidratacao();

  const estado = obterEstado();
  const usuario = estado.usuarios.find((registro) => registro.id === id);

  if (!usuario) throw new ErroDeRegra("Usuário não encontrado.", "usuario_nao_encontrado");

  if (alteracoes.email && alteracoes.email.toLowerCase() !== usuario.email.toLowerCase()) {
    const email = alteracoes.email.trim().toLowerCase();

    if (estado.usuarios.some((registro) => registro.email.toLowerCase() === email)) {
      throw new ErroDeRegra(
        "E-mail já utilizado por outro cadastro.",
        "e_mail_ja_utilizado_por_outro_cadastro",
      );
    }
    usuario.email = email;
  }

  if (alteracoes.nome?.trim()) usuario.nome = alteracoes.nome.trim();
  if (alteracoes.papeis?.length) usuario.papeis = [...alteracoes.papeis];
  if (alteracoes.cursoId !== undefined) usuario.cursoId = alteracoes.cursoId;
  if (alteracoes.membroComissaoEstagio !== undefined) {
    usuario.membroComissaoEstagio = alteracoes.membroComissaoEstagio;
  }

  if (alteracoes.situacao) usuario.situacao = alteracoes.situacao;

  await gravarUsuario(usuario);

  return usuario;
}

/**
 * Inativa o cadastro: bloqueia o acesso e preserva os registros criados pelo
 * usuário (estágios, documentos e pareceres continuam apontando para ele).
 */
export async function inativarUsuario(id: string): Promise<Usuario> {
  await garantirHidratacao();

  const usuario = obterEstado().usuarios.find((registro) => registro.id === id);

  if (!usuario) throw new ErroDeRegra("Usuário não encontrado.", "usuario_nao_encontrado");
  if (usuario.situacao === "inativo") {
    throw new ErroDeRegra(
      `Cadastro já está inativo (${metadadoUsuario("inativo").rotulo}).`,
      "usuario_ja_inativo",
    );
  }

  usuario.situacao = "inativo";
  await gravarUsuario(usuario);

  return usuario;
}

export async function reativarUsuario(id: string): Promise<Usuario> {
  await garantirHidratacao();

  const usuario = obterEstado().usuarios.find((registro) => registro.id === id);

  if (!usuario) throw new ErroDeRegra("Usuário não encontrado.", "usuario_nao_encontrado");

  usuario.situacao = "ativo";
  await gravarUsuario(usuario);

  return usuario;
}

/** Remove os dados pessoais, preservando identidades referenciadas no histórico. */
export async function excluirUsuario(id: string): Promise<void> {
  await garantirHidratacao();

  const estado = obterEstado();
  const usuario = estado.usuarios.find((registro) => registro.id === id);

  if (!usuario) throw new ErroDeRegra("Usuário não encontrado.", "usuario_nao_encontrado");
  const temHistorico =
    estado.estagios.some((estagio) => estagio.alunoId === id || estagio.editadoPorId === id) ||
    estado.documentos.some((documento) => documento.alunoId === id) ||
    estado.pareceres.some((parecer) => parecer.autorId === id);
  if (temHistorico) {
    const cursoId = cursoDoUsuario(usuario);
    Object.assign(usuario, {
      nome: "Cadastro excluído",
      email: `excluido.${id}@selic.invalid`,
      situacao: "inativo",
      matricula: undefined,
      dadosPessoais: undefined,
      cursoId,
    });
    await gravarUsuario(usuario);
  } else {
    estado.usuarios = estado.usuarios.filter((registro) => registro.id !== id);
    await excluirUsuarioDoBanco(id);
  }
  estado.notificacoes = estado.notificacoes.filter(
    (notificacao) => notificacao.destinatarioId !== id,
  );
}

export function podeDecidirSolicitacao(usuario: Usuario, solicitacao: SolicitacaoAcesso): boolean {
  if (usuario.situacao !== "ativo") return false;
  return (
    usuario.papeis.includes("administrador") ||
    usuario.papeis.includes("coordenador_estagio") ||
    (usuario.papeis.includes("coordenador_curso") &&
      Boolean(usuario.cursoId) &&
      usuario.cursoId === solicitacao.dadosPessoais.cursoId)
  );
}

export async function listarSolicitacoes(
  consulta: ConsultaSolicitacoes = {},
  autor?: Usuario,
): Promise<Pagina<SolicitacaoAcesso>> {
  const estado = obterEstado();
  const busca = filtrarPorTexto(estado.solicitacoes, consulta.busca ?? "", (solicitacao) => [
    solicitacao.nome,
    solicitacao.email,
    solicitacao.matricula,
  ]);

  const filtradas = busca
    .filter((solicitacao) => !autor || podeDecidirSolicitacao(autor, solicitacao))
    .filter((solicitacao) => !consulta.situacao || solicitacao.situacao === consulta.situacao)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  return paginar(filtradas, consulta);
}

export async function decidirSolicitacao(
  id: string,
  decisao: "autorizado" | "recusado",
  administradorId: string,
  motivo?: string,
): Promise<SolicitacaoAcesso> {
  await garantirHidratacao();

  const estado = obterEstado();
  const solicitacao = estado.solicitacoes.find((registro) => registro.id === id);

  if (!solicitacao)
    throw new ErroDeRegra("Solicitação não encontrada.", "solicitacao_nao_encontrada");
  const autor = estado.usuarios.find((usuario) => usuario.id === administradorId);
  if (!autor || !podeDecidirSolicitacao(autor, solicitacao)) {
    throw new ErroDeRegra("Solicitação não disponível para este usuário.", "acesso_negado");
  }
  if (decisao !== "autorizado" && decisao !== "recusado") {
    throw new ErroDeRegra("Escolha autorizar ou recusar.", "decisao_invalida");
  }
  if (solicitacao.situacao !== "pendente") {
    throw new ErroDeRegra(`Solicitação já ${solicitacao.situacao}.`, "solicitacao_decidida");
  }
  if (decisao === "recusado" && !motivo?.trim()) {
    throw new ErroDeRegra("Informe o motivo da recusa.", "motivo_obrigatorio");
  }

  solicitacao.situacao = decisao;
  solicitacao.decididoPorId = administradorId;
  solicitacao.decididoEm = agora();
  solicitacao.motivo = motivo?.trim() || solicitacao.motivo;

  if (decisao === "autorizado") {
    // A matrícula conferida passa a valer no sistema: o cadastro do aluno deixa
    // de depender de autorização avulsa e a matrícula fica registrada para os
    // próximos cadastros.
    if (!estado.matriculas.some((registro) => registro.matricula === solicitacao.matricula)) {
      const registro = {
        id: novoId("mat"),
        matricula: solicitacao.matricula,
        nome: solicitacao.nome,
        curso: nomeDoCurso(solicitacao.dadosPessoais.cursoId),
        origem: "cadastro_administrador" as const,
        importadaEm: agora(),
      };

      estado.matriculas.push(registro);
      await gravarMatricula(registro);
    }

    const existente = estado.usuarios.find(
      (usuario) => usuario.email.toLowerCase() === solicitacao.email.toLowerCase(),
    );

    if (existente) {
      existente.situacao = "ativo";
      await gravarUsuario(existente);
    } else {
      const usuario: Usuario = {
        id: novoId("usr"),
        nome: solicitacao.nome,
        email: solicitacao.email.toLowerCase(),
        papeis: ["aluno"],
        situacao: "ativo",
        campus: "Pinheiral",
        matricula: solicitacao.matricula,
        dadosPessoais: {
          ...solicitacao.dadosPessoais,
          nome: solicitacao.nome,
          email: solicitacao.email.toLowerCase(),
          campus: "Pinheiral",
        } as Usuario["dadosPessoais"],
        membroComissaoEstagio: false,
        criadoEm: agora(),
      };

      estado.usuarios.push(usuario);
      await gravarUsuario(usuario);
    }
  }

  const aluno = estado.usuarios.find(
    (usuario) => usuario.email.toLowerCase() === solicitacao.email.toLowerCase(),
  );
  if (aluno) {
    if (decisao === "recusado") {
      aluno.situacao = "inativo";
      await gravarUsuario(aluno);
    }
    estado.notificacoes.push({
      id: novoId("ntf"),
      destinatarioId: aluno.id,
      titulo: decisao === "autorizado" ? "Cadastro autorizado" : "Cadastro recusado",
      mensagem: solicitacao.motivo ?? "",
      tipo: "acesso",
      lida: false,
      criadaEm: agora(),
    });
  }
  return solicitacao;
}

export async function listarMatriculas(
  consulta: {
    busca?: string;
    origem?: MatriculaImportada["origem"];
    pagina?: number;
    tamanho?: number;
  } = {},
): Promise<Pagina<MatriculaImportada>> {
  await garantirHidratacao();

  const estado = obterEstado();
  const busca = filtrarPorTexto(estado.matriculas, consulta.busca ?? "", (matricula) => [
    matricula.nome,
    matricula.matricula,
    matricula.curso,
  ]);

  const filtradas = busca
    .filter((matricula) => !consulta.origem || matricula.origem === consulta.origem)
    .sort(porNome);

  return paginar(filtradas, consulta);
}

/**
 * Importação manual de matrículas (bloco 8.4). Sem integração oficial com o
 * SIGAA, cada linha é validada e classificada como válida, ignorada ou
 * rejeitada.
 */
export async function importarMatriculas(
  arquivo: string,
  linhas: LinhaImportacao[],
): Promise<ResultadoImportacao> {
  await garantirHidratacao();

  const estado = obterEstado();
  const existentes = new Set(estado.matriculas.map((matricula) => matricula.matricula));
  const resultado: ResultadoImportacao = {
    id: novoId("imp"),
    arquivo,
    importadoEm: agora(),
    validas: 0,
    rejeitadas: 0,
    ignoradas: 0,
    itens: [],
  };

  for (const linha of linhas) {
    const matricula = linha.matricula.trim();
    const nome = linha.nome.trim();
    const curso = linha.curso.trim();

    if (!matricula || !nome || !curso) {
      resultado.rejeitadas += 1;
      resultado.itens.push({
        matricula: matricula || "(vazia)",
        nome: nome || "(vazio)",
        resultado: "rejeitada",
        motivo: "Matrícula, nome e curso são obrigatórios.",
      });
      continue;
    }

    if (!MATRICULA_SIGAA.test(matricula)) {
      resultado.rejeitadas += 1;
      resultado.itens.push({
        matricula,
        nome,
        resultado: "rejeitada",
        motivo: "Informe a matrícula com 11 dígitos.",
      });
      continue;
    }

    if (existentes.has(matricula)) {
      resultado.ignoradas += 1;
      resultado.itens.push({
        matricula,
        nome,
        resultado: "ignorada",
        motivo: "Matrícula já registrada; a linha foi ignorada.",
      });
      continue;
    }

    existentes.add(matricula);
    const registro: MatriculaImportada = {
      id: novoId("mat"),
      matricula,
      nome,
      curso,
      origem: "importacao",
      importadaEm: agora(),
    };

    estado.matriculas.push(registro);
    await gravarMatricula(registro);
    resultado.validas += 1;
    resultado.itens.push({ matricula, nome, resultado: "valida" });
  }

  return resultado;
}

export async function totalMatriculasImportadas(): Promise<number> {
  await garantirHidratacao();

  return obterEstado().matriculas.length;
}

/**
 * Lançamento manual de uma matrícula válida pelo administrador. Enquanto não
 * houver integração com o SIGAA, é este registro que autoriza o cadastro do
 * aluno correspondente.
 */
export async function registrarMatricula(linha: LinhaImportacao): Promise<MatriculaImportada> {
  await garantirHidratacao();

  const estado = obterEstado();
  const matricula = linha.matricula.trim();
  const nome = linha.nome.trim();
  const curso = linha.curso.trim();

  if (!MATRICULA_SIGAA.test(matricula)) {
    throw new ErroDeRegra(
      "Informe a matrícula com 11 dígitos.",
      "informe_a_matricula_com_onze_digitos",
    );
  }

  if (!nome) throw new ErroDeRegra("Informe o nome do aluno.", "informe_o_nome_do_aluno");
  if (!curso) throw new ErroDeRegra("Informe o curso do aluno.", "informe_o_curso_do_aluno");

  if (await matriculaRegistrada(matricula)) {
    throw new ErroDeRegra(
      `A matrícula ${matricula} já está registrada.`,
      "matricula_ja_registrada",
    );
  }

  const registro: MatriculaImportada = {
    id: novoId("mat"),
    matricula,
    nome,
    curso,
    origem: "cadastro_administrador",
    importadaEm: agora(),
  };

  estado.matriculas.push(registro);
  await gravarMatricula(registro);

  return registro;
}
