import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import type { Pessoa } from "@/lib/domain/types";
import { esquemaEndereco } from "@/lib/domain/schemas";

type ClientePessoas = Pick<PrismaClient, "pessoa">;

export function paraDominioPessoa(linha: {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  papel: string;
  situacao: string;
  cpf: string | null;
  rg: string | null;
  endereco: unknown;
}): Pessoa {
  if (linha.papel !== "orientador" && linha.papel !== "supervisor") {
    throw new Error("Função externa inválida no cadastro de pessoa.");
  }
  return {
    id: linha.id,
    nome: linha.nome,
    email: linha.email,
    telefone: linha.telefone,
    papel: linha.papel,
    situacao: linha.situacao as Pessoa["situacao"],
    dadosPessoais: linha.cpf && linha.rg && linha.endereco
      ? { cpf: linha.cpf, rg: linha.rg, endereco: esquemaEndereco.parse(linha.endereco) }
      : undefined,
  };
}

export async function listarPessoas(
  cliente: ClientePessoas,
  papel?: Pessoa["papel"],
  apenasAtivas = false,
): Promise<Pessoa[]> {
  const linhas = await cliente.pessoa.findMany({
    where: { ...(papel ? { papel } : {}), ...(apenasAtivas ? { situacao: "ativo" } : {}) },
    orderBy: [{ nome: "asc" }, { id: "asc" }],
  });
  return linhas.map(paraDominioPessoa);
}

export async function buscarPessoa(cliente: ClientePessoas, id: string): Promise<Pessoa | null> {
  const linha = await cliente.pessoa.findUnique({ where: { id } });
  return linha ? paraDominioPessoa(linha) : null;
}
