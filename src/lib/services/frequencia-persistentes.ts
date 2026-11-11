import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { Usuario } from "@/lib/domain/types";
import { esquemaEndereco } from "@/lib/domain/schemas";
import { paraDominioUsuario } from "@/lib/db/mapeadores/usuarios";
import { estagioLiberado } from "@/lib/domain/fluxo-estagio";
import { paraDominioDocumento } from "@/lib/db/repositorios/documentos";
import { buscarEstagio } from "@/lib/db/repositorios/estagios";
import { carregarCliente } from "@/lib/db/prisma";
import { executarTransacao } from "@/lib/db/transacoes";
import { valoresDoPreenchimento, validarValores, podePreencher, templatePorId } from "./documentos";
import { criarRascunhoPersistente } from "./documentos-persistentes";
import { ErroDeRegra } from "./erros";
import type { ResultadoRegistroFicha, PreparacaoRegistro } from "./frequencia";

const TEMPLATE_FICHA_FREQUENCIA = "tpl-ficha-frequencia";

async function alunoAtual(id: string): Promise<Usuario | null> {
  const { prisma } = await carregarCliente();
  const linha = await prisma.usuario.findUnique({ where: { id }, include: { dadosPessoaisAluno: true } });
  if (!linha) return null;
  const dados = linha.dadosPessoaisAluno;
  return {
    ...paraDominioUsuario({ ...linha, dadosPessoais: null }),
    dadosPessoais: dados ? {
      nomeCompleto: linha.nome, email: linha.email, cpf: dados.cpf, rg: dados.rg,
      dataNascimento: dados.dataNascimento.toISOString().slice(0, 10), telefone: dados.telefone,
      celular: dados.celular, endereco: esquemaEndereco.parse(dados.endereco),
      cursoId: dados.cursoId, turmaId: dados.turmaId, periodoId: dados.periodoId,
    } : undefined,
  };
}

export async function iniciarRegistroFichaPersistente(autor: Usuario, estagioId: string): Promise<PreparacaoRegistro> {
  const template = await templatePorId(TEMPLATE_FICHA_FREQUENCIA);
  if (!template) throw new ErroDeRegra("Ficha de Frequência indisponível.", "nao_encontrado");
  const atual = await alunoAtual(autor.id);
  if (!atual) throw new ErroDeRegra("Cadastro do responsável não encontrado.", "nao_encontrado");
  if (!podePreencher(atual, template)) throw new ErroDeRegra("O registro desta ficha cabe a outro perfil.", "acesso_negado");
  const { exigirAcessoEstagio } = await import("./estagios");
  const estagio = await exigirAcessoEstagio(atual, estagioId);
  if (!estagioLiberado(estagio)) throw new ErroDeRegra("O estágio aguarda liberação ou está cancelado/excluído.", "liberacao_pendente");
  const aluno = await alunoAtual(estagio.alunoId);
  if (!aluno) throw new ErroDeRegra("Cadastro do aluno não encontrado.", "nao_encontrado");
  const { fichaDoEstagio } = await import("./frequencia");
  const ficha = await fichaDoEstagio(estagioId);
  const valores = ficha ? { ...ficha.valores } : await valoresDoPreenchimento(TEMPLATE_FICHA_FREQUENCIA, aluno, estagioId, {});
  return { estagio, aluno, ficha, valores };
}

const regras = {
  preparar: (templateId: string, aluno: Parameters<typeof valoresDoPreenchimento>[1], estagioId: string | undefined, valores: Record<string, unknown>, versao: number | undefined, contexto: Parameters<typeof valoresDoPreenchimento>[5]) =>
    valoresDoPreenchimento(templateId, aluno, estagioId, valores, versao, contexto),
  validar: (templateId: string, valores: Record<string, unknown>, versao?: number, snapshot?: Parameters<typeof validarValores>[3]) =>
    validarValores(templateId, valores, versao, snapshot),
};

export async function registrarFichaFrequenciaPersistente(autor: Usuario, estagioId: string, valores: Record<string, unknown>): Promise<ResultadoRegistroFicha> {
  let contexto: PreparacaoRegistro;
  try {
    contexto = await iniciarRegistroFichaPersistente(autor, estagioId);
  } catch (erro) {
    if (erro instanceof ErroDeRegra) return { ok: false, erro: erro.message };
    throw erro;
  }
  const preparados = await valoresDoPreenchimento(TEMPLATE_FICHA_FREQUENCIA, contexto.aluno, estagioId, valores, contexto.ficha?.versaoTemplate);
  const problemas = validarValores(TEMPLATE_FICHA_FREQUENCIA, preparados, contexto.ficha?.versaoTemplate);
  if (problemas.length > 0) {
    return { ok: false, erro: problemas[0].mensagem, problemas };
  }
  const { prisma } = await carregarCliente();
  const ficha = await executarTransacao(async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${contexto.estagio.alunoId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM estagios WHERE id = ${estagioId} FOR UPDATE`;
    const atual = await buscarEstagio(tx, estagioId);
    if (!atual || !estagioLiberado(atual)) throw new ErroDeRegra("O estágio aguarda liberação ou está cancelado/excluído.", "liberacao_pendente");
    const base = await criarRascunhoPersistente(autor, TEMPLATE_FICHA_FREQUENCIA, estagioId, preparados, regras, tx);
    const momento = new Date();
    const atualizada = await tx.documentoPreenchido.update({ where: { id: base.id }, data: {
      valores: JSON.parse(JSON.stringify(preparados)) as Prisma.InputJsonValue,
      situacao: "registrada", registradoPorId: autor.id, registradoEm: momento, atualizadoEm: momento,
    } });
    return paraDominioDocumento(atualizada);
  }, { cliente: prisma }, { isolationLevel: "Serializable" });
  return { ok: true, valores: preparados, ficha };
}
