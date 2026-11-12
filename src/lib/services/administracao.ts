import { metadadoUsuario } from "@/lib/domain/status";
import { aplicarRemocaoDaConta, registrarRemocao } from "./remocao-dados-pessoais-persistentes";
import { MATRICULA_SIGAA, esquemaPapel } from "@/lib/domain/schemas";
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


import { bancoConfigurado, carregarCliente } from "@/lib/db/prisma";
import { executarTransacao } from "@/lib/db/transacoes";
import { criarRepositorioUsuarios } from "@/lib/db/repositorios/usuarios";
import { criarRepositorioSolicitacoes } from "@/lib/db/repositorios/solicitacoes";
import { importarMatriculasPersistentes, listarImportacoesPersistentes, listarMatriculasPersistentes, registrarMatriculaPersistente } from "./matriculas-persistentes";

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
  papel: Papel;
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
  if (bancoConfigurado()) {
    const { prisma } = await carregarCliente();
    return (await prisma.matriculaImportada.count({ where: { matricula: matricula.trim() } })) > 0;
  }
  return obterEstado().matriculas.some((registro) => registro.matricula === matricula.trim());
}

/** Nome do curso de uma matrícula, para o registro feito a partir do cadastro. */
function nomeDoCurso(cursoId: string): string {
  return obterEstado().cursos.find((curso) => curso.id === cursoId)?.nome ?? "Não informado";
}

async function repositorioUsuariosPersistente() {
  const { prisma, Prisma } = await carregarCliente();

  return criarRepositorioUsuarios(prisma, Prisma);
}

export async function listarUsuarios(consulta: ConsultaUsuarios = {}): Promise<Pagina<Usuario>> {
  if (bancoConfigurado()) {
    const repositorio = await repositorioUsuariosPersistente();

    return repositorio.listarPaginado(consulta);
  }

  const estado = obterEstado();
  const busca = filtrarPorTexto(estado.usuarios, consulta.busca ?? "", (usuario) => [
    usuario.nome,
    usuario.email,
    usuario.matricula ?? "",
  ]);

  const filtrados = busca
    .filter((usuario) => !consulta.papel || usuario.papel === consulta.papel)
    .filter((usuario) => !consulta.situacao || usuario.situacao === consulta.situacao)
    .filter((usuario) => !consulta.cursoId || cursoDoUsuario(usuario) === consulta.cursoId)
    .sort(porNome);

  return paginar(filtrados, consulta);
}

export async function usuarioPorId(id: string): Promise<Usuario | null> {
  if (bancoConfigurado()) {
    const repositorio = await repositorioUsuariosPersistente();

    return repositorio.buscarPorId(id);
  }

  return obterEstado().usuarios.find((usuario) => usuario.id === id) ?? null;
}

/** Usuário pelo e-mail, que é o identificador do login; null quando não existe. */
export async function usuarioPorEmail(email: string): Promise<Usuario | null> {
  const alvo = email.trim().toLowerCase();

  if (bancoConfigurado()) {
    const repositorio = await repositorioUsuariosPersistente();

    return repositorio.buscarPorEmail(alvo);
  }

  return (
    obterEstado().usuarios.find((usuario) => usuario.email.trim().toLowerCase() === alvo) ?? null
  );
}

export async function contarUsuariosPorSituacao(): Promise<Record<SituacaoUsuario, number>> {
  if (bancoConfigurado()) {
    const repositorio = await repositorioUsuariosPersistente();

    return repositorio.contarPorSituacao();
  }

  const usuarios = obterEstado().usuarios;

  return {
    ativo: usuarios.filter((usuario) => usuario.situacao === "ativo").length,
    inativo: usuarios.filter((usuario) => usuario.situacao === "inativo").length,
    pendente: usuarios.filter((usuario) => usuario.situacao === "pendente").length,
  };
}

interface CadastroValidado {
  email: string;
  campus: Campus;
  matricula?: string;
}

function validarCadastroAdministrativo(cadastro: CadastroUsuario): CadastroValidado {
  const email = cadastro.email.trim().toLowerCase();

  if (!cadastro.nome.trim())
    throw new ErroDeRegra("Informe o nome do usuário.", "informe_o_nome_do_usuario");
  if (!email.includes("@"))
    throw new ErroDeRegra("Informe um e-mail válido.", "informe_um_e_mail_valido");
  if (!esquemaPapel.safeParse(cadastro.papel).success || "papeis" in cadastro) {
    throw new ErroDeRegra(
      "Escolha o papel antes de concluir o cadastro.",
      "escolha_o_papel_antes_de_concluir_o_cadastro",
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

  if (cadastro.papel === "aluno") {
    if (!matricula)
      throw new ErroDeRegra("Informe a matrícula do aluno.", "informe_a_matricula_do_aluno");

    if (!MATRICULA_SIGAA.test(matricula)) {
      throw new ErroDeRegra(
        "Informe a matrícula com 11 dígitos.",
        "informe_a_matricula_com_onze_digitos",
      );
    }
  }

  return { email, campus, matricula };
}

/** Depois do commit, pede o link padrão para a conta estabelecer a primeira senha. */
async function solicitarDefinicaoSenha(email: string): Promise<void> {
  try {
    const [{ obterAutenticacao }, { carregarConfiguracaoAutenticacao }] = await Promise.all([
      import("@/lib/auth/autenticacao"),
      import("@/lib/auth/configuracao"),
    ]);
    const configuracao = carregarConfiguracaoAutenticacao();
    const autenticacao = await obterAutenticacao();

    await autenticacao.api.requestPasswordReset({
      body: { email, redirectTo: `${configuracao.origem}/redefinir-senha` },
    });
  } catch (erro) {
    const codigo =
      erro && typeof erro === "object" && "code" in erro ? String(erro.code) : "ENVIO_FALHOU";
    console.warn("[administracao] Falha ao solicitar definição de senha.", {
      codigo: /^[A-Z0-9_]{1,64}$/.test(codigo) ? codigo : "ENVIO_FALHOU",
    });
  }
}

async function cadastrarUsuarioPersistente(cadastro: CadastroUsuario): Promise<Usuario> {
  const { email, campus, matricula } = validarCadastroAdministrativo(cadastro);
  const { prisma, Prisma } = await carregarCliente();

  const usuario = await executarTransacao(
    async (tx) => {
      const repositorio = criarRepositorioUsuarios(tx, Prisma);
      const [porEmail, porMatricula] = await Promise.all([
        tx.usuario.findUnique({ where: { email }, select: { id: true } }),
        matricula
          ? tx.usuario.findUnique({ where: { matricula }, select: { id: true } })
          : Promise.resolve(null),
      ]);

      if (porEmail) {
        throw new ErroDeRegra(
          "E-mail já utilizado por outro cadastro.",
          "e_mail_ja_utilizado_por_outro_cadastro",
        );
      }
      if (porMatricula) {
        throw new ErroDeRegra("Matrícula já vinculada ou registrada.", "matricula_ja_utilizada");
      }

      if (matricula) {
        const registrada = await tx.matriculaImportada.findUnique({
          where: { matricula },
          select: { id: true },
        });

        if (!registrada) {
          const curso = cadastro.cursoId
            ? await tx.curso.findUnique({
                where: { id: cadastro.cursoId },
                select: { nome: true },
              })
            : null;

          await tx.matriculaImportada.create({
            data: {
              id: novoId("mat"),
              matricula,
              nome: cadastro.nome.trim(),
              curso: curso?.nome ?? "Não informado",
              origem: "cadastro_administrador",
            },
          });
        }
      }

      const novo: Usuario = {
        id: novoId("usr"),
        nome: cadastro.nome.trim(),
        email,
        papel: cadastro.papel,
        situacao: "ativo",
        campus,
        matricula,
        cursoId: cadastro.papel === "coordenador_curso" ? cadastro.cursoId : undefined,
        membroComissaoEstagio: false,
        criadoEm: agora(),
      };

      await repositorio.criar(novo);

      return novo;
    },
    { cliente: prisma },
  );

  await solicitarDefinicaoSenha(email);

  return usuario;
}

export async function cadastrarUsuario(cadastro: CadastroUsuario): Promise<Usuario> {
  if (bancoConfigurado()) return cadastrarUsuarioPersistente(cadastro);

  const { email, campus, matricula } = validarCadastroAdministrativo(cadastro);
  const estado = obterEstado();

  if (estado.usuarios.some((usuario) => usuario.email.toLowerCase() === email)) {
    throw new ErroDeRegra(
      "E-mail já utilizado por outro cadastro.",
      "e_mail_ja_utilizado_por_outro_cadastro",
    );
  }

  if (cadastro.papel === "aluno" && matricula) {
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
    }
  }

  const usuario: Usuario = {
    id: novoId("usr"),
    nome: cadastro.nome.trim(),
    email,
    papel: cadastro.papel,
    situacao: "ativo",
    campus,
    matricula,
    cursoId: cadastro.papel === "coordenador_curso" ? cadastro.cursoId : undefined,
    membroComissaoEstagio: false,
    criadoEm: agora(),
  };
  estado.usuarios.push(usuario);

  return usuario;
}

async function editarUsuarioPersistente(
  id: string,
  alteracoes: Partial<CadastroUsuario> & { nome?: string; situacao?: SituacaoUsuario },
): Promise<Usuario> {
  const { prisma, Prisma } = await carregarCliente();

  return executarTransacao(
    async (tx) => {
      const repositorio = criarRepositorioUsuarios(tx, Prisma);
      const atual = await repositorio.buscarPorId(id);

      if (!atual) throw new ErroDeRegra("Usuário não encontrado.", "usuario_nao_encontrado");

      const usuario: Usuario = { ...atual };

      if (alteracoes.email && alteracoes.email.toLowerCase() !== atual.email.toLowerCase()) {
        const email = alteracoes.email.trim().toLowerCase();

        if (!email.includes("@")) {
          throw new ErroDeRegra("Informe um e-mail válido.", "informe_um_e_mail_valido");
        }

        const existente = await tx.usuario.findUnique({
          where: { email },
          select: { id: true },
        });

        if (existente && existente.id !== id) {
          throw new ErroDeRegra(
            "E-mail já utilizado por outro cadastro.",
            "e_mail_ja_utilizado_por_outro_cadastro",
          );
        }

        usuario.email = email;
      }

      if (alteracoes.nome?.trim()) usuario.nome = alteracoes.nome.trim();
      if (alteracoes.papel !== undefined) usuario.papel = alteracoes.papel;
      if (alteracoes.cursoId !== undefined) usuario.cursoId = alteracoes.cursoId;
      if (alteracoes.membroComissaoEstagio !== undefined) {
        usuario.membroComissaoEstagio = alteracoes.membroComissaoEstagio;
      }
      if (alteracoes.situacao) usuario.situacao = alteracoes.situacao;

      if (usuario.papel !== "coordenador_estagio") usuario.membroComissaoEstagio = false;
      if (usuario.papel !== "coordenador_curso") usuario.cursoId = undefined;

      if (Object.hasOwn(alteracoes, "matricula")) {
        const matricula = alteracoes.matricula?.trim();

        if (usuario.papel === "aluno" && matricula) {
          if (!MATRICULA_SIGAA.test(matricula)) {
            throw new ErroDeRegra(
              "Informe a matrícula com 11 dígitos.",
              "informe_a_matricula_com_onze_digitos",
            );
          }

          const outro = await tx.usuario.findUnique({
            where: { matricula },
            select: { id: true },
          });

          if (outro && outro.id !== id) {
            throw new ErroDeRegra(
              "Matrícula já vinculada ou registrada.",
              "matricula_ja_utilizada",
            );
          }

          const registrada = await tx.matriculaImportada.findUnique({
            where: { matricula },
            select: { id: true },
          });

          if (!registrada) {
            const curso = usuario.cursoId
              ? await tx.curso.findUnique({
                  where: { id: usuario.cursoId },
                  select: { nome: true },
                })
              : null;

            await tx.matriculaImportada.create({
              data: {
                id: novoId("mat"),
                matricula,
                nome: usuario.nome,
                curso: curso?.nome ?? "Não informado",
                origem: "cadastro_administrador",
              },
            });
          }

          usuario.matricula = matricula;
        } else {
          usuario.matricula = undefined;
        }
      } else if (usuario.papel !== "aluno") {
        usuario.matricula = undefined;
      }

      await repositorio.atualizar(usuario);

      if (usuario.situacao !== "ativo") {
        await tx.authSession.deleteMany({ where: { userId: id } });
      }

      return usuario;
    },
    { cliente: prisma },
  );
}

export async function editarUsuario(
  id: string,
  alteracoes: Partial<CadastroUsuario> & { nome?: string; situacao?: SituacaoUsuario },
): Promise<Usuario> {
  if (Object.hasOwn(alteracoes, "papel") || "papeis" in alteracoes) {
    if (!esquemaPapel.safeParse(alteracoes.papel).success || "papeis" in alteracoes) {
      throw new ErroDeRegra("Escolha um único papel válido.", "papel_invalido");
    }
  }
  if (bancoConfigurado()) return editarUsuarioPersistente(id, alteracoes);

  const estado = obterEstado();
  const usuario = estado.usuarios.find((registro) => registro.id === id);

  if (!usuario) throw new ErroDeRegra("Usuário não encontrado.", "usuario_nao_encontrado");

  const anterior = structuredClone(usuario);

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
  if (alteracoes.papel !== undefined) usuario.papel = alteracoes.papel;
  if (alteracoes.cursoId !== undefined) usuario.cursoId = alteracoes.cursoId;
  if (alteracoes.membroComissaoEstagio !== undefined) {
    usuario.membroComissaoEstagio = alteracoes.membroComissaoEstagio;
  }

  if (alteracoes.situacao) usuario.situacao = alteracoes.situacao;

  if (usuario.papel !== "coordenador_estagio") usuario.membroComissaoEstagio = false;
  if (usuario.papel !== "coordenador_curso") usuario.cursoId = undefined;

  let matriculaCriada: MatriculaImportada | undefined;

  if (Object.hasOwn(alteracoes, "matricula")) {
    const matricula = alteracoes.matricula?.trim();

    if (usuario.papel === "aluno" && matricula) {
      if (!MATRICULA_SIGAA.test(matricula)) {
        throw new ErroDeRegra(
          "Informe a matrícula com 11 dígitos.",
          "informe_a_matricula_com_onze_digitos",
        );
      }

      if (
        estado.usuarios.some(
          (registro) => registro.id !== id && registro.matricula === matricula,
        )
      ) {
        throw new ErroDeRegra("Matrícula já vinculada ou registrada.", "matricula_ja_utilizada");
      }

      if (!(await matriculaRegistrada(matricula))) {
        matriculaCriada = {
          id: novoId("mat"),
          matricula,
          nome: usuario.nome,
          curso: usuario.cursoId ? nomeDoCurso(usuario.cursoId) : "Não informado",
          origem: "cadastro_administrador",
          importadaEm: agora(),
        };
        estado.matriculas.push(matriculaCriada);
      }

      usuario.matricula = matricula;
    } else {
      usuario.matricula = undefined;
    }
  } else if (usuario.papel !== "aluno") {
    usuario.matricula = undefined;
  }

  try {
  } catch (erro) {
    Object.assign(usuario, anterior);
    if (matriculaCriada) {
      const indice = estado.matriculas.findIndex((registro) => registro.id === matriculaCriada!.id);
      if (indice >= 0) estado.matriculas.splice(indice, 1);
    }
    throw erro;
  }

  return usuario;
}

/**
 * Inativa o cadastro: bloqueia o acesso e preserva os registros criados pelo
 * usuário (estágios, documentos e pareceres continuam apontando para ele).
 */
async function atualizarSituacaoPersistente(
  id: string,
  situacao: SituacaoUsuario,
): Promise<Usuario> {
  const { prisma, Prisma } = await carregarCliente();

  return executarTransacao(
    async (tx) => {
      const repositorio = criarRepositorioUsuarios(tx, Prisma);
      const usuario = await repositorio.buscarPorId(id);

      if (!usuario) throw new ErroDeRegra("Usuário não encontrado.", "usuario_nao_encontrado");
      if (situacao === "inativo" && usuario.situacao === "inativo") {
        throw new ErroDeRegra(
          `Cadastro já está inativo (${metadadoUsuario("inativo").rotulo}).`,
          "usuario_ja_inativo",
        );
      }

      const atualizado: Usuario = { ...usuario, situacao };
      await repositorio.atualizar(atualizado);

      if (situacao !== "ativo") {
        await tx.authSession.deleteMany({ where: { userId: id } });
      }

      return atualizado;
    },
    { cliente: prisma },
  );
}

export async function inativarUsuario(id: string): Promise<Usuario> {
  if (bancoConfigurado()) return atualizarSituacaoPersistente(id, "inativo");

  const usuario = obterEstado().usuarios.find((registro) => registro.id === id);

  if (!usuario) throw new ErroDeRegra("Usuário não encontrado.", "usuario_nao_encontrado");
  if (usuario.situacao === "inativo") {
    throw new ErroDeRegra(
      `Cadastro já está inativo (${metadadoUsuario("inativo").rotulo}).`,
      "usuario_ja_inativo",
    );
  }

  const situacaoAnterior = usuario.situacao;

  usuario.situacao = "inativo";

  try {
  } catch (erro) {
    usuario.situacao = situacaoAnterior;
    throw erro;
  }

  return usuario;
}

export async function reativarUsuario(id: string): Promise<Usuario> {
  if (bancoConfigurado()) return atualizarSituacaoPersistente(id, "ativo");

  const usuario = obterEstado().usuarios.find((registro) => registro.id === id);

  if (!usuario) throw new ErroDeRegra("Usuário não encontrado.", "usuario_nao_encontrado");

  const situacaoAnterior = usuario.situacao;

  usuario.situacao = "ativo";

  try {
  } catch (erro) {
    usuario.situacao = situacaoAnterior;
    throw erro;
  }

  return usuario;
}

async function possuiHistoricoPersistente(tx: import("@/generated/prisma/client").Prisma.TransactionClient, id: string): Promise<boolean> {
  const contagens = await Promise.all([
    tx.estagio.count({ where: { OR: [{ alunoId: id }, { editadoPorId: id }, { encaminhadoPorId: id }, { liberadoPorId: id }] } }),
    tx.documentoPreenchido.count({ where: { OR: [{ alunoId: id }, { registradoPorId: id }, { assinaturasConfirmadasPorId: id }] } }),
    tx.lancamentoHoras.count({ where: { alunoId: id } }),
    tx.submissaoDocumento.count({ where: { autorId: id } }),
    tx.parecer.count({ where: { autorId: id } }),
    tx.observacaoDocumento.count({ where: { autorId: id } }),
    tx.envioExterno.count({ where: { autorId: id } }),
    tx.pedidoEnvioDocumento.count({ where: { pedidoPorId: id } }),
    tx.arquivo.count({ where: { autorId: id } }),
    tx.solicitacaoExclusaoEstagio.count({ where: { OR: [{ solicitanteId: id }, { decididoPorId: id }] } }),
    tx.solicitacaoAcesso.count({ where: { OR: [{ usuarioId: id }, { decididoPorId: id }] } }),
  ]);
  return contagens.some((quantidade) => quantidade > 0);
}

/** Anonimiza identidade com histórico ou apaga por completo a conta sem referências. */
async function excluirUsuarioPersistente(id: string): Promise<void> {
  const { prisma } = await carregarCliente();
  await executarTransacao(async (tx) => {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${id} FOR UPDATE`;
    const usuario = await tx.usuario.findUnique({ where: { id } });
    if (!usuario) throw new ErroDeRegra("Usuário não encontrado.", "usuario_nao_encontrado");
    if (await possuiHistoricoPersistente(tx, id)) {
      const momento = new Date();
      await aplicarRemocaoDaConta(tx, id);
      await registrarRemocao(tx, "conta", id, momento);
      return;
    }
    await tx.solicitacaoAcesso.deleteMany({ where: { usuarioId: id } });
    await tx.dadosPessoaisAluno.deleteMany({ where: { usuarioId: id } });
    await tx.usuario.delete({ where: { id } });
  }, { cliente: prisma }, { isolationLevel: "Serializable" });
}

/** Remove os dados pessoais, preservando identidades referenciadas no histórico. */
export async function excluirUsuario(id: string): Promise<void> {
  if (bancoConfigurado()) return excluirUsuarioPersistente(id);

  const estado = obterEstado();
  const usuario = estado.usuarios.find((registro) => registro.id === id);

  if (!usuario) throw new ErroDeRegra("Usuário não encontrado.", "usuario_nao_encontrado");
  const temHistorico =
    estado.estagios.some((estagio) => estagio.alunoId === id || estagio.editadoPorId === id) ||
    estado.documentos.some((documento) => documento.alunoId === id) ||
    estado.pareceres.some((parecer) => parecer.autorId === id);
  if (temHistorico) {
    const anterior = structuredClone(usuario);
    const cursoId = cursoDoUsuario(usuario);
    Object.assign(usuario, {
      nome: "Cadastro excluído",
      email: `excluido.${id}@selic.invalid`,
      situacao: "inativo",
      matricula: undefined,
      dadosPessoais: undefined,
      cursoId,
    });

    try {
    } catch (erro) {
      Object.assign(usuario, anterior);
      throw erro;
    }
  } else {
    const indice = estado.usuarios.indexOf(usuario);

    estado.usuarios = estado.usuarios.filter((registro) => registro.id !== id);

    try {
    } catch (erro) {
      estado.usuarios.splice(indice, 0, usuario);
      throw erro;
    }
  }
}

export function podeDecidirSolicitacao(usuario: Usuario, solicitacao: SolicitacaoAcesso): boolean {
  if (usuario.situacao !== "ativo") return false;
  return (
    usuario.papel === "administrador" ||
    usuario.papel === "coordenador_estagio" ||
    (usuario.papel === "coordenador_curso" &&
      Boolean(usuario.cursoId) &&
      usuario.cursoId === solicitacao.dadosPessoais.cursoId)
  );
}

export async function listarSolicitacoes(
  consulta: ConsultaSolicitacoes = {},
  autor?: Usuario,
): Promise<Pagina<SolicitacaoAcesso>> {
  if (bancoConfigurado()) {
    const tamanhoPagina = Math.max(1, consulta.tamanho ?? 10);
    const vazio: Pagina<SolicitacaoAcesso> = { itens: [], total: 0, pagina: 1, tamanhoPagina };

    if (autor) {
      if (autor.situacao !== "ativo") return vazio;
      if (!["administrador", "coordenador_estagio", "coordenador_curso"].includes(autor.papel)) {
        return vazio;
      }
    }

    let cursoId: string | undefined;

    if (autor?.papel === "coordenador_curso") {
      if (!autor.cursoId) return vazio;
      cursoId = autor.cursoId;
    }

    const { prisma } = await carregarCliente();
    const repositorio = criarRepositorioSolicitacoes(prisma);

    return repositorio.listarPaginado({
      situacao: consulta.situacao,
      busca: consulta.busca,
      pagina: consulta.pagina,
      tamanho: consulta.tamanho,
      cursoId,
    });
  }

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

async function decidirSolicitacaoPersistente(
  id: string,
  decisao: "autorizado" | "recusado",
  administradorId: string,
  motivo?: string,
): Promise<SolicitacaoAcesso> {
  const { prisma } = await carregarCliente();

  return executarTransacao(
    async (tx) => {
      const registro = await tx.solicitacaoAcesso.findUnique({
        where: { id },
        select: { usuarioId: true, cursoId: true },
      });

      if (!registro) {
        throw new ErroDeRegra("Solicitação não encontrada.", "solicitacao_nao_encontrada");
      }

      const repositorio = criarRepositorioSolicitacoes(tx);
      const solicitacao = await repositorio.buscarPorId(id);

      if (!solicitacao) {
        throw new ErroDeRegra("Solicitação não encontrada.", "solicitacao_nao_encontrada");
      }

      const autor = await tx.usuario.findUnique({
        where: { id: administradorId },
        select: { papel: true, situacao: true, cursoId: true },
      });

      const permitido =
        autor?.situacao === "ativo" &&
        (autor.papel === "administrador" ||
          autor.papel === "coordenador_estagio" ||
          (autor.papel === "coordenador_curso" &&
            Boolean(autor.cursoId) &&
            autor.cursoId === registro.cursoId));

      if (!permitido) {
        throw new ErroDeRegra(
          "Solicitação não disponível para este usuário.",
          "acesso_negado",
        );
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
      if (decisao === "autorizado" && !solicitacao.matricula) {
        throw new ErroDeRegra("Solicitação sem matrícula.", "matricula_ausente");
      }

      const decididoEm = new Date();
      const decisaoGravada = await tx.solicitacaoAcesso.updateMany({
        where: { id, situacao: "pendente" },
        data: {
          situacao: decisao,
          motivo: motivo?.trim() || solicitacao.motivo || null,
          decididoPorId: administradorId,
          decididoEm,
        },
      });

      if (decisaoGravada.count === 0) {
        throw new ErroDeRegra("Solicitação já foi decidida.", "solicitacao_decidida");
      }

      if (decisao === "autorizado") {
        const curso = await tx.curso.findUnique({
          where: { id: registro.cursoId },
          select: { nome: true },
        });

        await tx.matriculaImportada.upsert({
          where: { matricula: solicitacao.matricula },
          create: {
            id: novoId("mat"),
            matricula: solicitacao.matricula,
            nome: solicitacao.nome,
            curso: curso?.nome ?? "Não informado",
            origem: "cadastro_administrador",
          },
          update: {},
        });

        const ativacao = await tx.usuario.updateMany({
          where: { id: registro.usuarioId },
          data: { situacao: "ativo" },
        });

        if (ativacao.count === 0) {
          throw new ErroDeRegra("Usuário da solicitação não encontrado.", "usuario_nao_encontrado");
        }
      } else {
        await tx.usuario.updateMany({
          where: { id: registro.usuarioId },
          data: { situacao: "inativo" },
        });
      }

      return (await repositorio.buscarPorId(id))!;
    },
    { cliente: prisma },
    { isolationLevel: "Serializable" },
  );
}

export async function decidirSolicitacao(
  id: string,
  decisao: "autorizado" | "recusado",
  administradorId: string,
  motivo?: string,
): Promise<SolicitacaoAcesso> {
  if (bancoConfigurado()) {
    return decidirSolicitacaoPersistente(id, decisao, administradorId, motivo);
  }

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

  const antes = {
    usuarios: structuredClone(estado.usuarios),
    matriculas: structuredClone(estado.matriculas),
    solicitacao: structuredClone(solicitacao),
  };

  try {
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
      }

      const existente = estado.usuarios.find(
        (usuario) => usuario.email.toLowerCase() === solicitacao.email.toLowerCase(),
      );

      if (existente) {
        existente.situacao = "ativo";
      } else {
        const usuario: Usuario = {
          id: novoId("usr"),
          nome: solicitacao.nome,
          email: solicitacao.email.toLowerCase(),
          papel: "aluno",
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
      }
    }

    if (decisao === "recusado") {
      const aluno = estado.usuarios.find(
        (usuario) => usuario.email.toLowerCase() === solicitacao.email.toLowerCase(),
      );

      if (aluno) {
        aluno.situacao = "inativo";
      }
    }
  } catch (erro) {
    estado.usuarios = antes.usuarios;
    estado.matriculas = antes.matriculas;
    for (const chave of Object.keys(solicitacao)) {
      if (!(chave in antes.solicitacao)) {
        delete (solicitacao as unknown as Record<string, unknown>)[chave];
      }
    }
    Object.assign(solicitacao, antes.solicitacao);
    throw erro;
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
  if (bancoConfigurado()) return listarMatriculasPersistentes(consulta);
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
  if (bancoConfigurado()) return importarMatriculasPersistentes(arquivo, linhas);
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
    resultado.validas += 1;
    resultado.itens.push({ matricula, nome, resultado: "valida" });
  }

  return resultado;
}

export async function totalMatriculasImportadas(): Promise<number> {
  if (bancoConfigurado()) {
    const { prisma } = await carregarCliente();
    return prisma.matriculaImportada.count();
  }
  return obterEstado().matriculas.length;
}

/**
 * Lançamento manual de uma matrícula válida pelo administrador. Enquanto não
 * houver integração com o SIGAA, é este registro que autoriza o cadastro do
 * aluno correspondente.
 */
export async function registrarMatricula(linha: LinhaImportacao): Promise<MatriculaImportada> {
  if (bancoConfigurado()) return registrarMatriculaPersistente(linha);
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

  return registro;
}

/** Relatórios duráveis; no simulador permanece o relatório imediato da importação. */
export async function listarImportacoesMatriculas(): Promise<ResultadoImportacao[]> {
  return bancoConfigurado() ? listarImportacoesPersistentes() : [];
}
