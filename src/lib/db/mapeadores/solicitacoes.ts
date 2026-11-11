import "server-only";

import type {
  DadosPessoais,
  Endereco,
  SituacaoSolicitud,
  SolicitacaoAcesso,
} from "@/lib/domain/types";

/** Linha de `solicitacoes_acesso` com o usuário e os dados pessoais associados. */
export interface LinhaSolicitacao {
  id: string;
  usuarioId: string;
  cursoId: string;
  situacao: string;
  motivo: string | null;
  decididoPorId: string | null;
  decididoEm: Date | null;
  criadoEm: Date;
  usuario: {
    nome: string;
    email: string;
    matricula: string | null;
    dadosPessoais: unknown;
    dadosPessoaisAluno: {
      cpf: string;
      rg: string;
      dataNascimento: Date;
      telefone: string;
      celular: string;
      endereco: unknown;
      cursoId: string;
      turmaId: string;
      periodoId: string;
    } | null;
  };
}

const enderecoVazio: Endereco = {
  cep: "",
  logradouro: "",
  numero: "",
  bairro: "",
  cidade: "",
  estado: "",
};

function dadosPessoaisDe(linha: LinhaSolicitacao): DadosPessoais {
  const legado = linha.usuario.dadosPessoais as DadosPessoais | null;

  if (legado) return { ...legado, email: linha.usuario.email };

  const dados = linha.usuario.dadosPessoaisAluno;

  return {
    nomeCompleto: linha.usuario.nome,
    cpf: dados?.cpf ?? "",
    rg: dados?.rg ?? "",
    dataNascimento: dados ? dados.dataNascimento.toISOString().slice(0, 10) : "",
    email: linha.usuario.email,
    telefone: dados?.telefone ?? "",
    celular: dados?.celular ?? "",
    endereco: (dados?.endereco as Endereco | undefined) ?? enderecoVazio,
    cursoId: dados?.cursoId ?? linha.cursoId,
    turmaId: dados?.turmaId ?? "",
    periodoId: dados?.periodoId ?? "",
  };
}

export function paraDominioSolicitacao(linha: LinhaSolicitacao): SolicitacaoAcesso {
  return {
    id: linha.id,
    nome: linha.usuario.nome,
    email: linha.usuario.email,
    matricula: linha.usuario.matricula ?? "",
    dadosPessoais: dadosPessoaisDe(linha),
    situacao: linha.situacao as SituacaoSolicitud,
    motivo: linha.motivo ?? undefined,
    decididoPorId: linha.decididoPorId ?? undefined,
    criadoEm: linha.criadoEm.toISOString(),
    decididoEm: linha.decididoEm?.toISOString(),
  };
}
