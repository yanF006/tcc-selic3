import { metadadoUsuario } from "@/lib/domain/status";
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
import { notificar } from "./sessao";

import { ErroDeRegra } from "./erros";

/**
 * Administração do sistema (bloco 8): usuários, solicitações de acesso e
 * importação manual de matrículas do SIGAA. Toda mutação acontece em memória e
 * vale enquanto a aba do navegador estiver aberta (D4).
 */

export interface ConsultaUsuarios {
  papel?: Papel;
  situacao?: SituacaoUsuario;
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
  /** Autorização do administrador para matrícula ainda não registrada no SIGAA. */
  matriculaNaoRegistrada?: boolean;
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

export async function listarUsuarios(consulta: ConsultaUsuarios = {}): Promise<Pagina<Usuario>> {
  const estado = obterEstado();
  const busca = filtrarPorTexto(estado.usuarios, consulta.busca ?? "", (usuario) => [
    usuario.nome,
    usuario.email,
    usuario.matricula ?? "",
  ]);

  const filtrados = busca
    .filter((usuario) => !consulta.papel || usuario.papeis.includes(consulta.papel))
    .filter((usuario) => !consulta.situacao || usuario.situacao === consulta.situacao)
    .sort(porNome);

  return paginar(filtrados, consulta);
}

export async function usuarioPorId(id: string): Promise<Usuario | null> {
  return obterEstado().usuarios.find((usuario) => usuario.id === id) ?? null;
}

export async function contarUsuariosPorSituacao(): Promise<Record<SituacaoUsuario, number>> {
  const usuarios = obterEstado().usuarios;

  return {
    ativo: usuarios.filter((usuario) => usuario.situacao === "ativo").length,
    inativo: usuarios.filter((usuario) => usuario.situacao === "inativo").length,
    pendente: usuarios.filter((usuario) => usuario.situacao === "pendente").length,
  };
}

export async function cadastrarUsuario(cadastro: CadastroUsuario): Promise<Usuario> {
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
    if (!cadastro.matriculaNaoRegistrada) {
      throw new ErroDeRegra(
        "A matrícula não consta no SIGAA. Marque a autorização do administrador para prosseguir.",
        "matricula_fora_do_sigaa",
      );
    }
  }

  const usuario: Usuario = {
    id: novoId("usr"),
    nome: cadastro.nome.trim(),
    email,
    papeis: [...cadastro.papeis],
    situacao: cadastro.papeis.includes("aluno") ? "pendente" : "ativo",
    campus,
    matricula,
    cursoId: cadastro.cursoId,
    matriculaAutorizadaForaDoSigaa: matricula ? cadastro.matriculaNaoRegistrada : undefined,
    membroComissaoEstagio: false,
    criadoEm: agora(),
  };

  estado.usuarios.push(usuario);

  return usuario;
}

export async function editarUsuario(
  id: string,
  alteracoes: Partial<CadastroUsuario> & { nome?: string; situacao?: SituacaoUsuario },
): Promise<Usuario> {
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

  return usuario;
}

/**
 * Inativa o cadastro: bloqueia o acesso e preserva os registros criados pelo
 * usuário (estágios, documentos e pareceres continuam apontando para ele).
 */
export async function inativarUsuario(id: string): Promise<Usuario> {
  const usuario = obterEstado().usuarios.find((registro) => registro.id === id);

  if (!usuario) throw new ErroDeRegra("Usuário não encontrado.", "usuario_nao_encontrado");
  if (usuario.situacao === "inativo") {
    throw new ErroDeRegra(
      `Cadastro já está inativo (${metadadoUsuario("inativo").rotulo}).`,
      "usuario_ja_inativo",
    );
  }

  usuario.situacao = "inativo";

  return usuario;
}

export async function reativarUsuario(id: string): Promise<Usuario> {
  const usuario = obterEstado().usuarios.find((registro) => registro.id === id);

  if (!usuario) throw new ErroDeRegra("Usuário não encontrado.", "usuario_nao_encontrado");

  usuario.situacao = "ativo";

  return usuario;
}

/** Remove o cadastro e os registros dependentes que só existam por causa dele. */
export async function excluirUsuario(id: string): Promise<void> {
  const estado = obterEstado();
  const usuario = estado.usuarios.find((registro) => registro.id === id);

  if (!usuario) throw new ErroDeRegra("Usuário não encontrado.", "usuario_nao_encontrado");
  if (estado.estagios.some((estagio) => estagio.alunoId === id)) {
    throw new ErroDeRegra(
      "Não é possível excluir: o aluno possui estágios registrados. Inative o cadastro.",
      "usuario_com_registros",
    );
  }

  estado.usuarios = estado.usuarios.filter((registro) => registro.id !== id);
  estado.documentos = estado.documentos.filter((documento) => documento.alunoId !== id);
  estado.pareceres = estado.pareceres.filter((parecer) => parecer.autorId !== id);
  estado.notificacoes = estado.notificacoes.filter(
    (notificacao) => notificacao.destinatarioId !== id,
  );
}

export async function listarSolicitacoes(
  consulta: ConsultaSolicitacoes = {},
): Promise<Pagina<SolicitacaoAcesso>> {
  const estado = obterEstado();
  const busca = filtrarPorTexto(estado.solicitacoes, consulta.busca ?? "", (solicitacao) => [
    solicitacao.nome,
    solicitacao.email,
    solicitacao.matricula,
  ]);

  const filtradas = busca
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
  const estado = obterEstado();
  const solicitacao = estado.solicitacoes.find((registro) => registro.id === id);

  if (!solicitacao)
    throw new ErroDeRegra("Solicitação não encontrada.", "solicitacao_nao_encontrada");
  if (solicitacao.situacao !== "pendente") {
    throw new ErroDeRegra(`Solicitação já ${solicitacao.situacao}.`, "solicitacao_decidida");
  }

  solicitacao.situacao = decisao;
  solicitacao.decididoPorId = administradorId;
  solicitacao.decididoEm = agora();
  solicitacao.motivo = motivo?.trim() || solicitacao.motivo;

  if (decisao === "autorizado") {
    const existente = estado.usuarios.find(
      (usuario) => usuario.email.toLowerCase() === solicitacao.email.toLowerCase(),
    );

    if (existente) {
      existente.situacao = "ativo";
    } else {
      estado.usuarios.push({
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
      });
    }
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

    if (existentes.has(matricula)) {
      resultado.ignoradas += 1;
      resultado.itens.push({ matricula, nome, resultado: "ignorada" });
      continue;
    }

    existentes.add(matricula);
    estado.matriculas.push({
      id: novoId("mat"),
      matricula,
      nome,
      curso,
      origem: "importacao",
      importadaEm: agora(),
    });
    resultado.validas += 1;
    resultado.itens.push({ matricula, nome, resultado: "valida" });
  }

  return resultado;
}

export async function totalMatriculasImportadas(): Promise<number> {
  return obterEstado().matriculas.length;
}

export async function matricularAlunoImportado(matricula: string, alunoId: string): Promise<void> {
  const estado = obterEstado();
  const usuario = estado.usuarios.find((registro) => registro.id === alunoId);

  if (!usuario) throw new ErroDeRegra("Usuário não encontrado.", "usuario_nao_encontrado");
  if (usuario.matricula !== matricula) {
    throw new ErroDeRegra(
      `A matrícula ${matricula} não pertence a ${usuario.nome}.`,
      "matricula_divergente",
    );
  }

  usuario.situacao = "ativo";

  await notificar(alunoId, "Acesso liberado", "Sua matrícula foi validada e o acesso está ativo.");
}
