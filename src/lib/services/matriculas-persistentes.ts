import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { MATRICULA_SIGAA } from "@/lib/domain/schemas";
import type { MatriculaImportada, Pagina, ResultadoImportacao } from "@/lib/domain/types";
import { paraDominioMatricula } from "@/lib/db/mapeadores/matriculas";
import { carregarCliente } from "@/lib/db/prisma";
import { executarTransacao } from "@/lib/db/transacoes";
import { ErroDeRegra } from "./erros";
import { novoId } from "./store";

type Linha = Pick<MatriculaImportada, "matricula" | "nome" | "curso">;
export interface ConsultaMatriculas {
  busca?: string;
  origem?: MatriculaImportada["origem"];
  pagina?: number;
  tamanho?: number;
}

function motivoInvalido(linha: Linha): string | undefined {
  if (!linha.matricula || !linha.nome || !linha.curso) return "Matrícula, nome e curso são obrigatórios.";
  if (!MATRICULA_SIGAA.test(linha.matricula)) return "Informe a matrícula com 11 dígitos.";
  if (linha.nome.length > 191 || linha.curso.length > 191) return "Nome e curso devem ter no máximo 191 caracteres.";
}

export async function listarMatriculasPersistentes(consulta: ConsultaMatriculas): Promise<Pagina<MatriculaImportada>> {
  const { prisma } = await carregarCliente();
  const termo = consulta.busca?.trim();
  const where: Prisma.MatriculaImportadaWhereInput = {
    ...(consulta.origem ? { origem: consulta.origem } : {}),
    ...(termo ? { OR: [{ nome: { contains: termo } }, { matricula: { contains: termo } }, { curso: { contains: termo } }] } : {}),
  };
  return executarTransacao(async (tx) => {
    const total = await tx.matriculaImportada.count({ where });
    const tamanho = Math.max(1, consulta.tamanho ?? 10);
    const pagina = Math.min(Math.max(1, consulta.pagina ?? 1), Math.max(1, Math.ceil(total / tamanho)));
    const linhas = await tx.matriculaImportada.findMany({ where, orderBy: [{ nome: "asc" }, { id: "asc" }], skip: (pagina - 1) * tamanho, take: tamanho });
    return { itens: linhas.map(paraDominioMatricula), total, pagina, tamanhoPagina: tamanho };
  }, { cliente: prisma }, { isolationLevel: "RepeatableRead" });
}

export async function registrarMatriculaPersistente(entrada: Linha): Promise<MatriculaImportada> {
  const linha = { matricula: entrada.matricula.trim(), nome: entrada.nome.trim(), curso: entrada.curso.trim() };
  const motivo = motivoInvalido(linha);
  if (motivo) throw new ErroDeRegra(motivo, "matricula_invalida");
  const { prisma } = await carregarCliente();
  return executarTransacao(async (tx) => {
    const id = novoId("mat");
    const resultado = await tx.matriculaImportada.createMany({ data: [{ id, ...linha, origem: "cadastro_administrador" }], skipDuplicates: true });
    if (resultado.count !== 1) throw new ErroDeRegra(`A matrícula ${linha.matricula} já está registrada.`, "matricula_ja_registrada");
    return paraDominioMatricula(await tx.matriculaImportada.findUniqueOrThrow({ where: { id } }));
  }, { cliente: prisma });
}

export async function importarMatriculasPersistentes(arquivo: string, entradas: Linha[]): Promise<ResultadoImportacao> {
  if (!arquivo.trim() || arquivo.length > 255 || !entradas.length) {
    throw new ErroDeRegra("Informe um arquivo com linhas para importar e nome de até 255 caracteres.", "importacao_invalida");
  }
  const { prisma } = await carregarCliente();
  return executarTransacao(async (tx) => {
    const lote = await tx.importacaoMatriculas.create({ data: { id: novoId("imp"), arquivo: arquivo.trim() } });
    const resultado: ResultadoImportacao = { id: lote.id, arquivo: lote.arquivo, importadoEm: lote.importadoEm.toISOString(), validas: 0, rejeitadas: 0, ignoradas: 0, itens: [] };
    // Ordem consistente de inserção reduz disputas entre lotes sobre as mesmas matrículas.
    const linhas = entradas.map((entrada, indice) => ({ indice, matricula: entrada.matricula.trim(), nome: entrada.nome.trim(), curso: entrada.curso.trim() }));
    const itens = new Map<number, ResultadoImportacao["itens"][number]>();
    for (const linha of [...linhas].sort((a, b) => a.matricula.localeCompare(b.matricula))) {
      let motivo = motivoInvalido(linha);
      let classificacao: ResultadoImportacao["itens"][number]["resultado"] = "rejeitada";
      if (!motivo) {
        const inserida = await tx.matriculaImportada.createMany({
          data: [{ id: novoId("mat"), matricula: linha.matricula, nome: linha.nome, curso: linha.curso, origem: "importacao", importadaEm: lote.importadoEm }],
          skipDuplicates: true,
        });
        classificacao = inserida.count === 1 ? "valida" : "ignorada";
        if (classificacao === "ignorada") motivo = "Matrícula já registrada; a linha foi ignorada.";
      }
      if (classificacao === "valida") resultado.validas++;
      else if (classificacao === "ignorada") resultado.ignoradas++;
      else resultado.rejeitadas++;
      // Entradas rejeitadas podem exceder as colunas: o motivo preserva o original.
      const excedente = linha.matricula.length > 20 || linha.nome.length > 191 || linha.curso.length > 191;
      if (excedente) motivo = `${motivo} Entrada original: ${JSON.stringify({ matricula: linha.matricula, nome: linha.nome, curso: linha.curso })}`;
      const item = {
        matricula: linha.matricula.slice(0, 20) || "(vazia)", nome: linha.nome.slice(0, 191) || "(vazio)", resultado: classificacao, motivo,
      };
      await tx.itemImportacaoMatricula.create({ data: {
        id: novoId("item"), importacaoId: lote.id, ...item, curso: linha.curso.slice(0, 191),
      } });
      itens.set(linha.indice, item);
    }
    resultado.itens = linhas.map((linha) => itens.get(linha.indice)!);
    await tx.importacaoMatriculas.update({ where: { id: lote.id }, data: { validas: resultado.validas, rejeitadas: resultado.rejeitadas, ignoradas: resultado.ignoradas } });
    return resultado;
  }, { cliente: prisma });
}

export async function listarImportacoesPersistentes(): Promise<ResultadoImportacao[]> {
  const { prisma } = await carregarCliente();
  const lotes = await prisma.importacaoMatriculas.findMany({
    orderBy: [{ importadoEm: "desc" }, { id: "desc" }],
    include: { itens: { orderBy: [{ criadoEm: "asc" }, { id: "asc" }] } },
  });
  return lotes.map((lote) => ({
    id: lote.id, arquivo: lote.arquivo, importadoEm: lote.importadoEm.toISOString(),
    validas: lote.validas, rejeitadas: lote.rejeitadas, ignoradas: lote.ignoradas,
    itens: lote.itens.map((item) => ({ matricula: item.matricula, nome: item.nome, resultado: item.resultado as ResultadoImportacao["itens"][number]["resultado"], motivo: item.motivo ?? undefined })),
  }));
}
