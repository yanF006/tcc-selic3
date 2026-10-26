import { z } from "zod";
import { esquemaData, esquemaEmail, esquemaTelefone } from "@/lib/domain/schemas";
import type { Curso, Periodo, Pessoa, Turma, Usuario } from "@/lib/domain/types";
import { cadastrarConvenio, classificacaoConvenio, somarAnos } from "./catalogo";
import { cursoDoUsuario } from "@/lib/domain/usuario";
import { ErroDeRegra } from "./erros";
import { novoId, obterEstado } from "./store";

export type TipoCadastro = "convenio" | "curso" | "turma" | "periodo" | "orientador" | "supervisor";

export function exigirGestaoCadastros(autor: Usuario) {
  if (
    autor.situacao !== "ativo" ||
    !autor.papeis.some((papel) => papel === "coordenador_estagio" || papel === "administrador")
  ) {
    throw new ErroDeRegra(
      "A gestão destes cadastros cabe à coordenação de estágio ou administração.",
      "acesso_negado",
    );
  }
}

export async function consultarCadastros(autor: Usuario) {
  exigirGestaoCadastros(autor);
  const estado = obterEstado();
  return {
    cursos: estado.cursos,
    turmas: estado.turmas,
    periodos: estado.periodos,
    pessoas: estado.pessoas,
    convenios: estado.convenios.map((convenio) => ({
      ...convenio,
      classificacao: classificacaoConvenio(convenio),
      totalEstagios: estado.estagios.filter((estagio) => estagio.convenioId === convenio.id).length,
    })),
  };
}

export async function salvarCadastro(
  autor: Usuario,
  tipo: TipoCadastro,
  dados: Record<string, unknown>,
  id?: string,
) {
  exigirGestaoCadastros(autor);
  const estado = obterEstado();
  if (tipo === "convenio") {
    const validado = z
      .object({
        nome: z.string().trim().min(1, "Informe o nome do convênio."),
        instituicao: z.string().trim().min(1, "Informe a instituição."),
        cnpj: z.string().trim().min(1, "Informe o CNPJ."),
        inicioVigencia: esquemaData,
      })
      .parse(dados);
    if (!id) return cadastrarConvenio(validado);
    const convenio = estado.convenios.find((registro) => registro.id === id);
    if (!convenio) throw new ErroDeRegra("Convênio não encontrado.", "nao_encontrado");
    Object.assign(convenio, validado, { fimVigencia: somarAnos(validado.inicioVigencia, 5) });
    return convenio;
  }
  if (tipo === "curso") {
    const validado = z
      .object({
        nome: z.string().trim().min(1, "Informe o curso."),
        codigo: z.string().trim().min(1, "Informe o código do curso."),
      })
      .parse(dados);
    if (estado.cursos.some((curso) => curso.id !== id && curso.codigo === validado.codigo))
      throw new ErroDeRegra("Código de curso já cadastrado.", "codigo_duplicado");
    const curso: Curso | undefined = id
      ? estado.cursos.find((registro) => registro.id === id)
      : { id: novoId("curso"), ...validado, situacao: "ativo" };
    if (!curso) throw new ErroDeRegra("Curso não encontrado.", "nao_encontrado");
    Object.assign(curso, validado);
    if (!id) estado.cursos.push(curso);
    return curso;
  }
  if (tipo === "periodo") {
    const validado = z
      .object({
        ano: z.coerce.number().int().min(1900).max(2200),
        semestre: z.union([z.literal(1), z.literal(2)]),
      })
      .parse({ ...dados, semestre: Number(dados.semestre) });
    const rotulo = `${validado.ano}.${validado.semestre}`;
    if (estado.periodos.some((periodo) => periodo.id !== id && periodo.rotulo === rotulo))
      throw new ErroDeRegra("Período já cadastrado.", "periodo_duplicado");
    const periodo: Periodo | undefined = id
      ? estado.periodos.find((registro) => registro.id === id)
      : { id: novoId("periodo"), ...validado, rotulo, situacao: "ativo" };
    if (!periodo) throw new ErroDeRegra("Período não encontrado.", "nao_encontrado");
    Object.assign(periodo, validado, { rotulo });
    if (!id) estado.periodos.push(periodo);
    return periodo;
  }
  if (tipo === "turma") {
    const validado = z
      .object({
        nome: z.string().trim().min(1, "Informe a turma."),
        cursoId: z.string().min(1, "Selecione o curso da turma."),
        periodoIds: z.array(z.string()).min(1, "Selecione ao menos um período da turma."),
      })
      .parse(dados);
    if (!estado.cursos.some((curso) => curso.id === validado.cursoId && curso.situacao === "ativo"))
      throw new ErroDeRegra("Selecione um curso ativo.", "curso_invalido");
    if (
      validado.periodoIds.some(
        (periodoId) =>
          !estado.periodos.some(
            (periodo) => periodo.id === periodoId && periodo.situacao === "ativo",
          ),
      )
    )
      throw new ErroDeRegra("Selecione períodos cadastrados e ativos.", "periodo_invalido");
    const turma: Turma | undefined = id
      ? estado.turmas.find((registro) => registro.id === id)
      : { id: novoId("turma"), ...validado, situacao: "ativo" };
    if (!turma) throw new ErroDeRegra("Turma não encontrada.", "nao_encontrado");
    if (
      id &&
      turma.cursoId !== validado.cursoId &&
      estado.usuarios.some((usuario) => usuario.dadosPessoais?.turmaId === id)
    )
      throw new ErroDeRegra(
        "Turma com alunos vinculados não pode mudar de curso.",
        "turma_com_vinculos",
      );
    Object.assign(turma, validado);
    if (!id) estado.turmas.push(turma);
    return turma;
  }
  if (tipo === "orientador" || tipo === "supervisor") {
    const validado = z
      .object({
        nome: z.string().trim().min(1, "Informe o nome do responsável."),
        email: esquemaEmail.optional().or(z.literal("")).default(""),
        telefone: esquemaTelefone.optional().or(z.literal("")).default(""),
      })
      .parse(dados);
    const pessoa: Pessoa | undefined = id
      ? estado.pessoas.find((registro) => registro.id === id && registro.papel === tipo)
      : { id: novoId(tipo), ...validado, papel: tipo, situacao: "ativo" };
    if (!pessoa) throw new ErroDeRegra("Responsável não encontrado.", "nao_encontrado");
    Object.assign(pessoa, validado);
    if (!id) estado.pessoas.push(pessoa);
    return pessoa;
  }
  throw new ErroDeRegra("Tipo de cadastro inválido.", "tipo_invalido");
}

export async function removerCadastro(
  autor: Usuario,
  tipo: TipoCadastro,
  id: string,
  inativar = false,
) {
  exigirGestaoCadastros(autor);
  const estado = obterEstado();
  if (tipo === "orientador" || tipo === "supervisor") {
    const pessoa = estado.pessoas.find((registro) => registro.id === id && registro.papel === tipo);
    if (!pessoa) throw new ErroDeRegra("Responsável não encontrado.", "nao_encontrado");
    pessoa.situacao = "inativo";
    if (!inativar) {
      pessoa.nome = "Cadastro excluído";
      pessoa.email = "";
      pessoa.telefone = "";
      delete pessoa.dadosPessoais;
    }
    return;
  }
  const colecao =
    tipo === "curso"
      ? estado.cursos
      : tipo === "turma"
        ? estado.turmas
        : tipo === "periodo"
          ? estado.periodos
          : tipo === "convenio"
            ? estado.convenios
            : null;
  const registro = colecao?.find((registro) => registro.id === id);
  if (!registro) throw new ErroDeRegra("Cadastro não encontrado.", "nao_encontrado");
  if (inativar) {
    registro.situacao = "inativo";
    return;
  }
  const vinculado =
    tipo === "curso"
      ? estado.turmas.some((turma) => turma.cursoId === id) ||
        estado.usuarios.some((usuario) => cursoDoUsuario(usuario) === id) ||
        estado.estagios.some((estagio) => estagio.cursoIdHistorico === id)
      : tipo === "turma"
        ? estado.usuarios.some((usuario) => usuario.dadosPessoais?.turmaId === id) ||
          estado.documentos.some(
            (documento) => documento.valores.turma === (registro as Turma).nome,
          )
        : tipo === "periodo"
          ? estado.usuarios.some((usuario) => usuario.dadosPessoais?.periodoId === id) ||
            estado.turmas.some((turma) => turma.periodoIds?.includes(id))
          : estado.estagios.some((estagio) => estagio.convenioId === id);
  if (vinculado)
    throw new ErroDeRegra(
      tipo === "convenio"
        ? "Convênio possui estágios vinculados. Classifique-o como expirado."
        : "Cadastro possui vínculos. Use a inativação para preservar o histórico.",
      "cadastro_com_vinculos",
    );
  if (tipo === "curso") estado.cursos = estado.cursos.filter((curso) => curso.id !== id);
  else if (tipo === "turma") estado.turmas = estado.turmas.filter((turma) => turma.id !== id);
  else if (tipo === "periodo")
    estado.periodos = estado.periodos.filter((periodo) => periodo.id !== id);
  else estado.convenios = estado.convenios.filter((convenio) => convenio.id !== id);
}

export async function ativarCadastro(autor: Usuario, tipo: TipoCadastro, id: string) {
  exigirGestaoCadastros(autor);
  const estado = obterEstado();
  const colecao =
    tipo === "curso"
      ? estado.cursos
      : tipo === "turma"
        ? estado.turmas
        : tipo === "periodo"
          ? estado.periodos
          : tipo === "convenio"
            ? estado.convenios
            : estado.pessoas.filter((pessoa) => pessoa.papel === tipo);
  const registro = colecao.find((registro) => registro.id === id);
  if (!registro) throw new ErroDeRegra("Cadastro não encontrado.", "nao_encontrado");
  registro.situacao = "ativo";
}
