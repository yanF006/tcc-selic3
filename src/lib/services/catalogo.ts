import type {
  Convenio,
  ClassificacaoConvenio,
  Curso,
  Pagina,
  Periodo,
  Pessoa,
  Turma,
  DadosPessoais,
} from "@/lib/domain/types";
import type { OpcoesSelecao } from "@/lib/domain/schemas";
import { periodosDoCurso } from "@/lib/domain/selecoes";

import type { Prisma } from "@/generated/prisma/client";
import { filtrarPorTexto, paginar, TAMANHO_PADRAO } from "./paginacao";
import type { OpcoesPaginacao } from "./paginacao";
import { agora, obterEstado, novoId } from "./store";
import { bancoConfigurado, carregarCliente } from "@/lib/db/prisma";
import { executarTransacao } from "@/lib/db/transacoes";
import { listarOpcoesAcademicas } from "@/lib/db/repositorios/catalogo";
import { buscarPessoa, listarPessoas } from "@/lib/db/repositorios/pessoas";
import { ErroDeRegra } from "@/lib/domain/erros";
import { z } from "zod";
import { esquemaEmail, esquemaTelefone } from "@/lib/domain/schemas";

export const esquemaResponsaveisInstituicao = z.array(z.object({
  nome: z.string().trim().min(1, "Informe o nome do contato.").max(191),
  email: esquemaEmail.transform((email) => email.trim().toLowerCase()),
  telefone: esquemaTelefone,
  cargo: z.string().trim().max(80).optional(),
})).max(20).superRefine((contatos, contexto) => {
  const emails = new Set<string>();
  contatos.forEach((contato, indice) => {
    if (emails.has(contato.email)) contexto.addIssue({
      code: "custom", path: [indice, "email"], message: "E-mail de contato repetido na instituição.",
    });
    emails.add(contato.email);
  });
});

/** Catálogos de apoio: cursos, turmas, períodos, responsáveis e convênios. */

async function opcoesAcademicasAtuais() {
  if (!bancoConfigurado()) {
    return {
      cursos: obterEstado().cursos,
      turmas: obterEstado().turmas,
      periodos: obterEstado().periodos,
    };
  }

  const { prisma } = await carregarCliente();

  return listarOpcoesAcademicas(prisma);
}

export async function listarCursos(situacao?: Curso["situacao"]): Promise<Curso[]> {
  const { cursos } = await opcoesAcademicasAtuais();

  return cursos.filter((curso) => !situacao || curso.situacao === situacao);
}

export async function listarTurmas(cursoId?: string, incluirInativas = false): Promise<Turma[]> {
  const { turmas } = await opcoesAcademicasAtuais();

  return turmas
    .filter((turma) => incluirInativas || turma.situacao === "ativo")
    .filter((turma) => !cursoId || turma.cursoId === cursoId);
}

export async function listarPeriodos(incluirInativos = false): Promise<Periodo[]> {
  const { periodos } = await opcoesAcademicasAtuais();

  return periodos
    .filter((periodo) => incluirInativos || periodo.situacao === "ativo")
    .sort((a, b) => b.ano - a.ano || b.semestre - a.semestre);
}

export async function listarOrientadores(): Promise<Pessoa[]> {
  if (bancoConfigurado()) {
    const { prisma } = await carregarCliente();
    return listarPessoas(prisma, "orientador", true);
  }
  return obterEstado().pessoas.filter(
    (pessoa) => pessoa.papel === "orientador" && pessoa.situacao === "ativo",
  );
}

export async function listarSupervisores(): Promise<Pessoa[]> {
  if (bancoConfigurado()) {
    const { prisma } = await carregarCliente();
    return listarPessoas(prisma, "supervisor", true);
  }
  return obterEstado()
    .pessoas.filter((pessoa) => pessoa.papel === "supervisor")
    .sort((a, b) => a.situacao.localeCompare(b.situacao));
}

/** Opções usadas pelos schemas Zod dos selects. */
export async function opcoesSelecao(dadosAtuais?: DadosPessoais): Promise<OpcoesSelecao> {
  const cursos = (await listarCursos()).filter(
    (curso) => curso.situacao === "ativo" || curso.id === dadosAtuais?.cursoId,
  );
  const turmas = (await listarTurmas(undefined, true)).filter(
    (turma) => turma.situacao === "ativo" || turma.id === dadosAtuais?.turmaId,
  );
  const periodos = (await listarPeriodos(true)).filter(
    (periodo) => periodo.situacao === "ativo" || periodo.id === dadosAtuais?.periodoId,
  );

  return {
    cursosIds: cursos.map((curso) => curso.id),
    turmasPorCurso: Object.fromEntries(
      cursos.map((curso) => [
        curso.id,
        turmas.filter((turma) => turma.cursoId === curso.id).map((turma) => turma.id),
      ]),
    ),
    periodosIds: periodos.map((periodo) => periodo.id),
    periodosPorCurso: Object.fromEntries(
      cursos.map((curso) => [
        curso.id,
        periodosDoCurso(
          curso.id,
          turmas,
          periodos.filter(
            (periodo) => periodo.situacao === "ativo" || curso.id === dadosAtuais?.cursoId,
          ),
          dadosAtuais?.turmaId,
        ).map((periodo) => periodo.id),
      ]),
    ),
  };
}

export async function pessoaPorId(id: string): Promise<Pessoa | null> {
  if (bancoConfigurado()) {
    const { prisma } = await carregarCliente();
    return buscarPessoa(prisma, id);
  }
  return obterEstado().pessoas.find((pessoa) => pessoa.id === id) ?? null;
}

export async function cursoPorId(id?: string): Promise<Curso | null> {
  if (!id) return null;

  const { cursos } = await opcoesAcademicasAtuais();

  return cursos.find((curso) => curso.id === id) ?? null;
}

export async function turmaPorId(id?: string): Promise<Turma | null> {
  if (!id) return null;

  const { turmas } = await opcoesAcademicasAtuais();

  return turmas.find((turma) => turma.id === id) ?? null;
}

export async function periodoPorId(id?: string): Promise<Periodo | null> {
  if (!id) return null;

  const { periodos } = await opcoesAcademicasAtuais();

  return periodos.find((periodo) => periodo.id === id) ?? null;
}

/** Convênio dentro da vigência é ativo; vencido, expirado. */
export function classificacaoConvenio(
  convenio: Convenio,
  hoje = new Date().toISOString().slice(0, 10),
): ClassificacaoConvenio {
  return convenio.situacao === "ativo" && convenio.fimVigencia >= hoje ? "ativo" : "expirado";
}

export interface ConsultaConvenios extends OpcoesPaginacao {
  situacao?: ClassificacaoConvenio;
  busca?: string;
}

type LinhaConvenio = {
  id: string;
  nome: string;
  inicioVigencia: Date;
  fimVigencia: Date;
  campus: string;
  situacao: string;
  renovacoes: number;
  instituicao: { nome: string; cnpj: string; responsaveis?: { nome: string; email: string; telefone: string; cargo: string | null; situacao: string }[] };
};

export function paraConvenio(linha: LinhaConvenio): Convenio {
  return {
    id: linha.id,
    instituicao: linha.instituicao.nome,
    nome: linha.nome,
    cnpj: linha.instituicao.cnpj,
    inicioVigencia: linha.inicioVigencia.toISOString().slice(0, 10),
    fimVigencia: linha.fimVigencia.toISOString().slice(0, 10),
    campus: linha.campus as Convenio["campus"],
    situacao: linha.situacao as Convenio["situacao"],
    renovacoes: linha.renovacoes,
    responsaveis: linha.instituicao.responsaveis?.filter((contato) => contato.situacao === "ativo")
      .map(({ nome, email, telefone, cargo }) => ({ nome, email, telefone, cargo: cargo ?? "" })),
  };
}

function dataIsoParaBanco(data: string) {
  return new Date(`${data}T00:00:00.000Z`);
}

const incluirInstituicao = { instituicao: { include: { responsaveis: { orderBy: [{ nome: "asc" }, { id: "asc" }] } } } } satisfies Prisma.ConvenioInclude;

async function salvarContatosInstituicao(
  tx: Prisma.TransactionClient,
  instituicaoId: string,
  entrada: Convenio["responsaveis"],
) {
  if (entrada === undefined) return;
  const contatos = esquemaResponsaveisInstituicao.parse(entrada);
  await tx.responsavelInstituicao.updateMany({ where: { instituicaoId }, data: { situacao: "inativo" } });
  for (const contato of contatos) {
    await tx.responsavelInstituicao.upsert({
      where: { instituicaoId_email: { instituicaoId, email: contato.email } },
      create: { id: novoId("resp"), instituicaoId, ...contato },
      update: { ...contato, situacao: "ativo" },
    });
  }
}

async function listarConveniosPersistente(
  consulta: ConsultaConvenios,
  hoje: string,
): Promise<Pagina<Convenio>> {
  const { prisma } = await carregarCliente();
  const filtros: Prisma.ConvenioWhereInput[] = [];
  const termo = consulta.busca?.trim();

  if (termo) {
    filtros.push({
      OR: [
        { nome: { contains: termo } },
        { instituicao: { nome: { contains: termo } } },
        { instituicao: { cnpj: { contains: termo } } },
      ],
    });
  }

  if (consulta.situacao === "ativo") {
    filtros.push({ situacao: "ativo", fimVigencia: { gte: dataIsoParaBanco(hoje) } });
  } else if (consulta.situacao === "expirado") {
    filtros.push({
      OR: [{ situacao: { not: "ativo" } }, { fimVigencia: { lt: dataIsoParaBanco(hoje) } }],
    });
  }

  const where: Prisma.ConvenioWhereInput = filtros.length ? { AND: filtros } : {};
  const tamanho = Math.max(1, consulta.tamanho ?? TAMANHO_PADRAO);

  return executarTransacao(async (tx) => {
    const total = await tx.convenio.count({ where });
    const paginas = Math.max(1, Math.ceil(total / tamanho));
    const pagina = Math.min(Math.max(1, consulta.pagina ?? 1), paginas);
    const linhas = await tx.convenio.findMany({
      where,
      include: incluirInstituicao,
      orderBy: [{ inicioVigencia: "asc" }, { id: "asc" }],
      skip: (pagina - 1) * tamanho,
      take: tamanho,
    });

    return {
      itens: linhas.map(paraConvenio),
      total,
      pagina,
      tamanhoPagina: tamanho,
    };
  }, { cliente: prisma }, { isolationLevel: "RepeatableRead" });
}

export async function listarConvenios(consulta: ConsultaConvenios = {}): Promise<Pagina<Convenio>> {
  const hoje = new Date().toISOString().slice(0, 10);

  if (bancoConfigurado()) return listarConveniosPersistente(consulta, hoje);

  const filtrados = obterEstado()
    .convenios.filter(
      (convenio) =>
        !consulta.situacao || classificacaoConvenio(convenio, hoje) === consulta.situacao,
    )
    .sort((a, b) => a.inicioVigencia.localeCompare(b.inicioVigencia));

  return paginar(
    filtrarPorTexto(filtrados, consulta.busca ?? "", (convenio) => [
      convenio.nome,
      convenio.instituicao,
      convenio.cnpj,
    ]),
    consulta,
  );
}

export async function convenioPorId(id: string): Promise<Convenio | null> {
  if (bancoConfigurado()) {
    const { prisma } = await carregarCliente();
    const linha = await prisma.convenio.findUnique({
      where: { id },
      include: incluirInstituicao,
    });

    return linha ? paraConvenio(linha) : null;
  }

  return obterEstado().convenios.find((convenio) => convenio.id === id) ?? null;
}

async function instituicaoAtiva(
  tx: Prisma.TransactionClient,
  dados: { instituicao: string; cnpj: string },
) {
  const existente = await tx.instituicaoConcedente.findUnique({ where: { cnpj: dados.cnpj } });

  if (existente) {
    if (existente.situacao !== "ativo") {
      throw new ErroDeRegra(
        "Instituição concedente inativa não pode receber novos convênios.",
        "instituicao_inativa",
      );
    }

    if (existente.nome !== dados.instituicao) {
      return tx.instituicaoConcedente.update({
        where: { id: existente.id },
        data: { nome: dados.instituicao },
      });
    }

    return existente;
  }

  return tx.instituicaoConcedente.create({
    data: {
      id: novoId("inst"),
      nome: dados.instituicao,
      cnpj: dados.cnpj,
    },
  });
}

async function cadastrarConvenioPersistente(
  dados: Omit<Convenio, "id" | "campus" | "situacao" | "renovacoes" | "fimVigencia">,
): Promise<Convenio> {
  const { prisma } = await carregarCliente();

  return executarTransacao(
    async (tx) => {
      const instituicao = await instituicaoAtiva(tx, dados);
      await salvarContatosInstituicao(tx, instituicao.id, dados.responsaveis);
      const linha = await tx.convenio.create({
        data: {
          id: novoId("conv"),
          instituicaoId: instituicao.id,
          nome: dados.nome,
          inicioVigencia: dataIsoParaBanco(dados.inicioVigencia),
          fimVigencia: dataIsoParaBanco(somarAnos(dados.inicioVigencia, 5)),
        },
        include: incluirInstituicao,
      });

      return paraConvenio(linha);
    },
    { cliente: prisma },
  );
}

/** Cadastro de convênio; a vigência inicial é de 5 anos. */
export async function cadastrarConvenio(
  dados: Omit<Convenio, "id" | "campus" | "situacao" | "renovacoes" | "fimVigencia">,
): Promise<Convenio> {
  if (bancoConfigurado()) return cadastrarConvenioPersistente(dados);

  const fim = somarAnos(dados.inicioVigencia, 5);

  const convenio: Convenio = {
    ...dados,
    id: novoId("conv"),
    campus: "Pinheiral",
    situacao: "ativo",
    renovacoes: 0,
    fimVigencia: fim,
  };

  obterEstado().convenios.push(convenio);

  return convenio;
}

/** Atualiza os dados cadastrais do convênio, preservando o histórico de renovações. */
export async function editarConvenio(
  id: string,
  dados: Omit<Convenio, "id" | "campus" | "situacao" | "renovacoes" | "fimVigencia">,
): Promise<Convenio> {
  if (!bancoConfigurado()) {
    const convenio = await convenioPorId(id);

    if (!convenio) throw new ErroDeRegra("Convênio não encontrado.", "nao_encontrado");

    Object.assign(convenio, dados, { fimVigencia: somarAnos(dados.inicioVigencia, 5) });
    return convenio;
  }

  const { prisma } = await carregarCliente();

  return executarTransacao(
    async (tx) => {
      const atual = await tx.convenio.findUnique({ where: { id } });

      if (!atual) throw new ErroDeRegra("Convênio não encontrado.", "nao_encontrado");

      const instituicao = await instituicaoAtiva(tx, dados);
      await salvarContatosInstituicao(tx, instituicao.id, dados.responsaveis);
      const linha = await tx.convenio.update({
        where: { id },
        data: {
          instituicaoId: instituicao.id,
          nome: dados.nome,
          inicioVigencia: dataIsoParaBanco(dados.inicioVigencia),
          fimVigencia: dataIsoParaBanco(somarAnos(dados.inicioVigencia, 5)),
        },
        include: incluirInstituicao,
      });

      return paraConvenio(linha);
    },
    { cliente: prisma },
  );
}

export function somarAnos(dataIso: string, anos: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const alvo = new Date(Date.UTC(ano + anos, mes - 1, 1));
  const ultimoDia = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0),
  ).getUTCDate();

  alvo.setUTCDate(Math.min(dia, ultimoDia));

  return alvo.toISOString().slice(0, 10);
}

/** Renovação: prorroga 5 anos a partir do vencimento e soma uma renovação. */
export async function renovarConvenio(
  convenioId: string,
  hoje = new Date().toISOString().slice(0, 10),
): Promise<Convenio> {
  if (bancoConfigurado()) {
    const { prisma } = await carregarCliente();

    return executarTransacao(
      async (tx) => {
        const atual = await tx.convenio.findUnique({
          where: { id: convenioId },
          include: incluirInstituicao,
        });

        if (!atual) throw new ErroDeRegra("Convênio não encontrado.", "nao_encontrado");

        const convenio = paraConvenio(atual);
        if (classificacaoConvenio(convenio, hoje) === "ativo") {
          throw new ErroDeRegra(
            "Convênio ainda vigente: renovar apenas após o vencimento.",
            "convenio_vigente",
          );
        }

        const inicio = somarAnos(convenio.fimVigencia, 1);
        const fim = somarAnos(inicio, 5);

        await tx.renovacaoConvenio.create({
          data: {
            id: novoId("renov"),
            convenioId,
            inicioVigencia: dataIsoParaBanco(inicio),
            fimVigencia: dataIsoParaBanco(fim),
          },
        });
        const linha = await tx.convenio.update({
          where: { id: convenioId },
          data: {
            inicioVigencia: dataIsoParaBanco(inicio),
            fimVigencia: dataIsoParaBanco(fim),
            renovacoes: { increment: 1 },
          },
          include: incluirInstituicao,
        });

        return paraConvenio(linha);
      },
      { cliente: prisma },
    );
  }

  const convenio = await convenioPorId(convenioId);

  if (!convenio) throw new Error("Convênio não encontrado.");

  if (classificacaoConvenio(convenio, hoje) === "ativo") {
    throw new Error("Convênio ainda vigente: renovar apenas após o vencimento.");
  }

  const inicio = somarAnos(convenio.fimVigencia, 1);

  convenio.inicioVigencia = inicio;
  convenio.fimVigencia = somarAnos(inicio, 5);
  convenio.renovacoes += 1;

  return convenio;
}

export async function registrarConvenio(convenioId: string, motivo: string): Promise<void> {
  const convenio = await convenioPorId(convenioId);

  if (!convenio) throw new Error("Convênio não encontrado.");

  obterEstado().notificacoes.push({
    id: novoId("ntf"),
    destinatarioId: "usr-admin",
    titulo: `Histórico do convênio ${convenio.nome}`,
    mensagem: motivo,
    tipo: "sistema",
    lida: false,
    criadaEm: agora(),
  });
}
