import { z } from "zod";
import { esquemaData, esquemaEmail, esquemaTelefone } from "@/lib/domain/schemas";
import type { Curso, Periodo, Pessoa, Turma, Usuario } from "@/lib/domain/types";
import { cadastrarConvenio, classificacaoConvenio, editarConvenio, esquemaResponsaveisInstituicao, somarAnos } from "./catalogo";
import { cursoDoUsuario } from "@/lib/domain/usuario";
import { ErroDeRegra } from "./erros";
import { novoId, obterEstado } from "./store";
import { bancoConfigurado, carregarCliente } from "@/lib/db/prisma";
import { executarTransacao } from "@/lib/db/transacoes";
import { listarOpcoesAcademicas } from "@/lib/db/repositorios/catalogo";
import { listarPessoas, paraDominioPessoa } from "@/lib/db/repositorios/pessoas";

const esquemaPessoaExterna = z.object({
  nome: z.string().trim().min(1, "Informe o nome do responsável.").max(191),
  email: esquemaEmail.optional().or(z.literal("")).default(""),
  telefone: esquemaTelefone.optional().or(z.literal("")).default(""),
});

async function salvarPessoaPersistente(
  papel: Pessoa["papel"], dados: Record<string, unknown>, id?: string,
): Promise<Pessoa> {
  const validado = esquemaPessoaExterna.parse(dados);
  const { prisma } = await carregarCliente();
  return executarTransacao(async (tx) => {
    if (id) {
      const resultado = await tx.pessoa.updateMany({ where: { id, papel }, data: validado });
      if (resultado.count !== 1) throw new ErroDeRegra("Responsável não encontrado para esta função.", "nao_encontrado");
      return paraDominioPessoa(await tx.pessoa.findUniqueOrThrow({ where: { id } }));
    }
    return paraDominioPessoa(await tx.pessoa.create({ data: {
      id: novoId(papel), ...validado, papel, situacao: "ativo",
    } }));
  }, { cliente: prisma });
}

async function alterarSituacaoPessoaPersistente(
  papel: Pessoa["papel"], id: string, situacao: "ativo" | "inativo", anonimizar = false,
) {
  const { prisma, Prisma } = await carregarCliente();
  return executarTransacao(async (tx) => {
    const resultado = await tx.pessoa.updateMany({
      where: { id, papel },
      data: {
        situacao,
        ...(anonimizar ? { nome: "Cadastro excluído", email: "", telefone: "", cpf: null, rg: null, endereco: Prisma.DbNull } : {}),
      },
    });
    if (resultado.count !== 1) throw new ErroDeRegra("Responsável não encontrado para esta função.", "nao_encontrado");
  }, { cliente: prisma });
}

export type TipoCadastro = "convenio" | "curso" | "turma" | "periodo" | "orientador" | "supervisor";

export function exigirGestaoCadastros(autor: Usuario) {
  if (
    autor.situacao !== "ativo" ||
    !(autor.papel === "coordenador_estagio" || autor.papel === "administrador")
  ) {
    throw new ErroDeRegra(
      "A gestão destes cadastros cabe à coordenação de estágio ou administração.",
      "acesso_negado",
    );
  }
}

function paraCurso(linha: { id: string; nome: string; codigo: string; situacao: string }): Curso {
  return {
    id: linha.id,
    nome: linha.nome,
    codigo: linha.codigo,
    situacao: linha.situacao as Curso["situacao"],
  };
}

function paraPeriodo(linha: {
  id: string;
  rotulo: string;
  ano: number;
  semestre: number;
  situacao: string;
}): Periodo {
  return {
    id: linha.id,
    rotulo: linha.rotulo,
    ano: linha.ano,
    semestre: linha.semestre === 1 ? 1 : 2,
    situacao: linha.situacao as Periodo["situacao"],
  };
}

function paraTurma(linha: {
  id: string;
  nome: string;
  cursoId: string;
  situacao: string;
  turmaPeriodos: { periodoId: string }[];
}): Turma {
  return {
    id: linha.id,
    nome: linha.nome,
    cursoId: linha.cursoId,
    periodoIds: linha.turmaPeriodos.map((vinculo) => vinculo.periodoId),
    situacao: linha.situacao as Turma["situacao"],
  };
}

async function salvarCursoPersistente(
  validado: { nome: string; codigo: string },
  id?: string,
): Promise<Curso> {
  const { prisma } = await carregarCliente();

  return executarTransacao(
    async (tx) => {
      const existente = await tx.curso.findUnique({ where: { codigo: validado.codigo } });

      if (existente && existente.id !== id) {
        throw new ErroDeRegra("Código de curso já cadastrado.", "codigo_duplicado");
      }

      if (id) {
        const atual = await tx.curso.findUnique({ where: { id } });

        if (!atual) throw new ErroDeRegra("Curso não encontrado.", "nao_encontrado");

        return paraCurso(
          await tx.curso.update({ where: { id }, data: { nome: validado.nome, codigo: validado.codigo } }),
        );
      }

      return paraCurso(
        await tx.curso.create({
          data: { id: novoId("curso"), nome: validado.nome, codigo: validado.codigo },
        }),
      );
    },
    { cliente: prisma },
  );
}

async function salvarPeriodoPersistente(
  validado: { ano: number; semestre: 1 | 2 },
  id?: string,
): Promise<Periodo> {
  const { prisma } = await carregarCliente();
  const rotulo = `${validado.ano}.${validado.semestre}`;

  return executarTransacao(
    async (tx) => {
      const existente = await tx.periodo.findFirst({
        where: { ano: validado.ano, semestre: validado.semestre, ...(id ? { id: { not: id } } : {}) },
      });

      if (existente) throw new ErroDeRegra("Período já cadastrado.", "periodo_duplicado");

      if (id) {
        const atual = await tx.periodo.findUnique({ where: { id } });

        if (!atual) throw new ErroDeRegra("Período não encontrado.", "nao_encontrado");

        return paraPeriodo(
          await tx.periodo.update({
            where: { id },
            data: { ano: validado.ano, semestre: validado.semestre, rotulo },
          }),
        );
      }

      return paraPeriodo(
        await tx.periodo.create({
          data: { id: novoId("periodo"), ano: validado.ano, semestre: validado.semestre, rotulo },
        }),
      );
    },
    { cliente: prisma },
  );
}

async function salvarTurmaPersistente(
  validado: { nome: string; cursoId: string; periodoIds: string[] },
  id?: string,
): Promise<Turma> {
  const { prisma } = await carregarCliente();

  return executarTransacao(
    async (tx) => {
      const curso = await tx.curso.findUnique({ where: { id: validado.cursoId } });

      if (!curso || curso.situacao !== "ativo") {
        throw new ErroDeRegra("Selecione um curso ativo.", "curso_invalido");
      }

      const periodoIds = [...new Set(validado.periodoIds)];
      const periodos = await tx.periodo.findMany({
        where: { id: { in: periodoIds }, situacao: "ativo" },
        select: { id: true },
      });

      if (new Set(periodos.map((periodo) => periodo.id)).size !== periodoIds.length) {
        throw new ErroDeRegra("Selecione períodos cadastrados e ativos.", "periodo_invalido");
      }

      if (id) {
        const atual = await tx.turma.findUnique({ where: { id } });

        if (!atual) throw new ErroDeRegra("Turma não encontrada.", "nao_encontrado");
        if (atual.cursoId !== validado.cursoId) {
          const alunos = await tx.dadosPessoaisAluno.count({ where: { turmaId: id } });

          if (alunos > 0) {
            throw new ErroDeRegra(
              "Turma com alunos vinculados não pode mudar de curso.",
              "turma_com_vinculos",
            );
          }
        }

        await tx.turma.update({
          where: { id },
          data: { nome: validado.nome, cursoId: validado.cursoId },
        });
        await tx.turmaPeriodo.deleteMany({ where: { turmaId: id } });
        await tx.turmaPeriodo.createMany({
          data: periodoIds.map((periodoId) => ({ turmaId: id, periodoId })),
        });

        return paraTurma(
          await tx.turma.findUniqueOrThrow({
            where: { id },
            include: { turmaPeriodos: true },
          }),
        );
      }

      const turmaId = novoId("turma");
      await tx.turma.create({
        data: { id: turmaId, nome: validado.nome, cursoId: validado.cursoId },
      });
      await tx.turmaPeriodo.createMany({
        data: periodoIds.map((periodoId) => ({ turmaId, periodoId })),
      });

      return paraTurma(
        await tx.turma.findUniqueOrThrow({ where: { id: turmaId }, include: { turmaPeriodos: true } }),
      );
    },
    { cliente: prisma },
  );
}

async function removerAcademicoPersistente(
  tipo: "curso" | "turma" | "periodo",
  id: string,
  inativar: boolean,
) {
  const { prisma } = await carregarCliente();

  return executarTransacao(
    async (tx) => {
      if (inativar) {
        const resultado =
          tipo === "curso"
            ? await tx.curso.updateMany({ where: { id }, data: { situacao: "inativo" } })
            : tipo === "turma"
              ? await tx.turma.updateMany({ where: { id }, data: { situacao: "inativo" } })
              : await tx.periodo.updateMany({ where: { id }, data: { situacao: "inativo" } });

        if (resultado.count === 0) {
          throw new ErroDeRegra("Cadastro não encontrado.", "nao_encontrado");
        }
        return;
      }

      const vinculos =
        tipo === "curso"
          ? (
              await Promise.all([
                tx.turma.count({ where: { cursoId: id } }),
                tx.usuario.count({ where: { cursoId: id } }),
                tx.dadosPessoaisAluno.count({ where: { cursoId: id } }),
                tx.estagio.count({ where: { cursoIdHistorico: id } }),
                tx.solicitacaoAcesso.count({ where: { cursoId: id } }),
                tx.matriculaImportada.count({ where: { cursoId: id } }),
              ])
            ).some((quantidade) => quantidade > 0)
          : tipo === "turma"
            ? (await tx.dadosPessoaisAluno.count({ where: { turmaId: id } })) > 0
            : (
                await Promise.all([
                  tx.dadosPessoaisAluno.count({ where: { periodoId: id } }),
                  tx.turmaPeriodo.count({ where: { periodoId: id } }),
                ])
              ).some((quantidade) => quantidade > 0);

      if (vinculos) {
        throw new ErroDeRegra(
          "Cadastro possui vínculos. Use a inativação para preservar o histórico.",
          "cadastro_com_vinculos",
        );
      }

      const resultado =
        tipo === "curso"
          ? await tx.curso.deleteMany({ where: { id } })
          : tipo === "turma"
            ? await tx.turma.deleteMany({ where: { id } })
            : await tx.periodo.deleteMany({ where: { id } });

      if (resultado.count === 0) {
        throw new ErroDeRegra("Cadastro não encontrado.", "nao_encontrado");
      }
    },
    { cliente: prisma },
  );
}

async function ativarAcademicoPersistente(tipo: "curso" | "turma" | "periodo", id: string) {
  const { prisma } = await carregarCliente();

  await executarTransacao(
    async (tx) => {
      const resultado =
        tipo === "curso"
          ? await tx.curso.updateMany({ where: { id }, data: { situacao: "ativo" } })
          : tipo === "turma"
            ? await tx.turma.updateMany({ where: { id }, data: { situacao: "ativo" } })
            : await tx.periodo.updateMany({ where: { id }, data: { situacao: "ativo" } });

      if (resultado.count === 0) {
        throw new ErroDeRegra("Cadastro não encontrado.", "nao_encontrado");
      }
    },
    { cliente: prisma },
  );
}

export async function consultarCadastros(autor: Usuario) {
  exigirGestaoCadastros(autor);

  if (bancoConfigurado()) {
    const { prisma } = await carregarCliente();
    const [academicos, linhasConvenios, contagens, pessoas] = await Promise.all([
      listarOpcoesAcademicas(prisma),
      prisma.convenio.findMany({
        include: { instituicao: { include: { responsaveis: { where: { situacao: "ativo" }, orderBy: [{ nome: "asc" }, { id: "asc" }] } } } },
        orderBy: [{ inicioVigencia: "asc" }, { id: "asc" }],
      }),
      prisma.estagio.groupBy({ by: ["convenioId"], _count: { _all: true } }),
      listarPessoas(prisma),
    ]);
    const totaisPorConvenio = new Map(
      contagens.map((contagem) => [contagem.convenioId, contagem._count._all]),
    );

    return {
      cursos: academicos.cursos,
      turmas: academicos.turmas,
      periodos: academicos.periodos,
      pessoas,
      convenios: linhasConvenios.map((linha) => {
        const convenio = {
          id: linha.id,
          instituicao: linha.instituicao.nome,
          nome: linha.nome,
          cnpj: linha.instituicao.cnpj,
          inicioVigencia: linha.inicioVigencia.toISOString().slice(0, 10),
          fimVigencia: linha.fimVigencia.toISOString().slice(0, 10),
          campus: linha.campus as "Pinheiral",
          situacao: linha.situacao as "ativo" | "inativo",
          renovacoes: linha.renovacoes,
          responsaveis: linha.instituicao.responsaveis.map(({ nome, email, telefone, cargo }) => ({ nome, email, telefone, cargo: cargo ?? "" })),
        };

        return {
          ...convenio,
          classificacao: classificacaoConvenio(convenio),
          totalEstagios: totaisPorConvenio.get(convenio.id) ?? 0,
        };
      }),
    };
  }

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

  if (bancoConfigurado()) {
    if (tipo === "orientador" || tipo === "supervisor") {
      return salvarPessoaPersistente(tipo, dados, id);
    }
    if (tipo === "convenio") {
      const validado = z
        .object({
          nome: z.string().trim().min(1, "Informe o nome do convênio."),
          instituicao: z.string().trim().min(1, "Informe a instituição."),
          cnpj: z.string().trim().min(1, "Informe o CNPJ."),
          inicioVigencia: esquemaData,
          responsaveis: esquemaResponsaveisInstituicao.optional(),
        })
        .parse(dados);

      return id ? editarConvenio(id, validado) : cadastrarConvenio(validado);
    }

    if (tipo === "curso") {
      const validado = z
        .object({
          nome: z.string().trim().min(1, "Informe o curso."),
          codigo: z.string().trim().min(1, "Informe o código do curso."),
        })
        .parse(dados);

      return salvarCursoPersistente(validado, id);
    }

    if (tipo === "periodo") {
      const validado = z
        .object({
          ano: z.coerce.number().int().min(1900).max(2200),
          semestre: z.union([z.literal(1), z.literal(2)]),
        })
        .parse({ ...dados, semestre: Number(dados.semestre) });

      return salvarPeriodoPersistente(validado, id);
    }

    if (tipo === "turma") {
      const validado = z
        .object({
          nome: z.string().trim().min(1, "Informe a turma."),
          cursoId: z.string().min(1, "Selecione o curso da turma."),
          periodoIds: z.array(z.string()).min(1, "Selecione ao menos um período da turma."),
        })
        .parse(dados);

      return salvarTurmaPersistente(validado, id);
    }
  }

  const estado = obterEstado();
  if (tipo === "convenio") {
    const validado = z
      .object({
        nome: z.string().trim().min(1, "Informe o nome do convênio."),
        instituicao: z.string().trim().min(1, "Informe a instituição."),
        cnpj: z.string().trim().min(1, "Informe o CNPJ."),
        inicioVigencia: esquemaData,
        responsaveis: esquemaResponsaveisInstituicao.optional(),
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

async function removerConvenioPersistente(id: string, inativar: boolean) {
  const { prisma } = await carregarCliente();

  return executarTransacao(
    async (tx) => {
      const convenio = await tx.convenio.findUnique({ where: { id } });

      if (!convenio) throw new ErroDeRegra("Cadastro não encontrado.", "nao_encontrado");

      if (inativar) {
        await tx.convenio.update({ where: { id }, data: { situacao: "inativo" } });
        return;
      }

      const estagios = await tx.estagio.count({ where: { convenioId: id } });

      if (estagios > 0) {
        throw new ErroDeRegra(
          "Convênio com estágios vinculados deve ser inativado, não excluído.",
          "cadastro_com_vinculos",
        );
      }

      await tx.renovacaoConvenio.deleteMany({ where: { convenioId: id } });
      await tx.convenio.delete({ where: { id } });
    },
    { cliente: prisma },
  );
}

export async function removerCadastro(
  autor: Usuario,
  tipo: TipoCadastro,
  id: string,
  inativar = false,
) {
  exigirGestaoCadastros(autor);

  if (bancoConfigurado() && (tipo === "orientador" || tipo === "supervisor")) {
    return alterarSituacaoPessoaPersistente(tipo, id, "inativo", !inativar);
  }

  if (bancoConfigurado() && (tipo === "curso" || tipo === "turma" || tipo === "periodo")) {
    return removerAcademicoPersistente(tipo, id, inativar);
  }

  if (bancoConfigurado() && tipo === "convenio") {
    return removerConvenioPersistente(id, inativar);
  }

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

  if (bancoConfigurado() && (tipo === "orientador" || tipo === "supervisor")) {
    return alterarSituacaoPessoaPersistente(tipo, id, "ativo");
  }

  if (bancoConfigurado() && (tipo === "curso" || tipo === "turma" || tipo === "periodo")) {
    return ativarAcademicoPersistente(tipo, id);
  }

  if (bancoConfigurado() && tipo === "convenio") {
    const { prisma } = await carregarCliente();

    return executarTransacao(
      async (tx) => {
        const convenio = await tx.convenio.findUnique({ where: { id } });

        if (!convenio) throw new ErroDeRegra("Cadastro não encontrado.", "nao_encontrado");

        await tx.convenio.update({ where: { id }, data: { situacao: "ativo" } });
      },
      { cliente: prisma },
    );
  }

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
