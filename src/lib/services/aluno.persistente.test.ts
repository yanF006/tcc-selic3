import { beforeEach, describe, expect, it, vi } from "vitest";
import { APIError } from "better-auth/api";

import type { DadosPessoais } from "@/lib/domain/types";

const mocks = vi.hoisted(() => ({
  bancoConfigurado: vi.fn(() => true),
  garantirHidratacao: vi.fn(async () => undefined),
  atualizarUsuario: vi.fn(async (_usuario: import("@/lib/domain/types").Usuario) => undefined),
  changeEmail: vi.fn(),
  moverCredencial: vi.fn(async () => undefined),
  sincronizarDadosDoPerfil: vi.fn(async () => undefined),
  carregarCliente: vi.fn(async () => ({ prisma: {} })),
  listarOpcoesAcademicas: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  bancoConfigurado: mocks.bancoConfigurado,
  carregarCliente: mocks.carregarCliente,
}));
vi.mock("@/lib/db/repositorios/catalogo", () => ({
  listarOpcoesAcademicas: mocks.listarOpcoesAcademicas,
}));
vi.mock("@/lib/db/persistencia", () => ({
  garantirHidratacao: mocks.garantirHidratacao,
  atualizarUsuario: mocks.atualizarUsuario,
}));
vi.mock("@/lib/auth/autenticacao", () => ({
  obterAutenticacao: async () => ({ api: { changeEmail: mocks.changeEmail } }),
}));
vi.mock("@/lib/auth/configuracao", () => ({
  carregarConfiguracaoAutenticacao: () => ({
    origem: "https://selic.test",
    segredo: "segredo-de-teste",
  }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: "better-auth.session_token=abc" }),
}));
vi.mock("./credenciais", () => ({
  moverCredencial: mocks.moverCredencial,
  reiniciarCredenciais: vi.fn(),
}));
vi.mock("./documentos", () => ({
  sincronizarDadosDoPerfil: mocks.sincronizarDadosDoPerfil,
}));

import { dadosDoAluno, atualizarDadosPessoais } from "./aluno";
import { obterEstado, reiniciarEstado } from "./store";
import { cursos, periodos, turmas } from "@/lib/fixtures/base";

/**
 * Perfil persistente (4.6): a edição comum grava no banco, a matrícula continua
 * imutável e o e-mail só muda pelo fluxo de confirmação do provedor.
 */

const CABECALHOS = new Headers({ cookie: "better-auth.session_token=abc" });

function alunoAtivo() {
  const aluno = obterEstado().usuarios.find((registro) => registro.id === "usr-maria");
  if (!aluno || aluno.situacao !== "ativo" || !aluno.dadosPessoais) {
    throw new Error("Fixture de aluno ativo ausente.");
  }
  return aluno;
}

function dadosValidos(aluno: ReturnType<typeof alunoAtivo>): DadosPessoais {
  return structuredClone(aluno.dadosPessoais!);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.bancoConfigurado.mockReturnValue(true);
  mocks.garantirHidratacao.mockResolvedValue(undefined);
  mocks.atualizarUsuario.mockResolvedValue(undefined);
  mocks.changeEmail.mockResolvedValue({ status: true });
  mocks.listarOpcoesAcademicas.mockResolvedValue({ cursos, turmas, periodos });
  reiniciarEstado();
});

describe("edição persistente de perfil", () => {
  it("grava os dados e ignora matrícula enviada no payload", async () => {
    const aluno = alunoAtivo();
    const matriculaOriginal = aluno.matricula;
    const dados = {
      ...dadosValidos(aluno),
      nomeCompleto: "Nome Atualizado no Perfil",
      celular: "21999998888",
      matricula: "MATRICULA-ADULTERADA",
    } as DadosPessoais & { matricula: string };

    const resultado = await atualizarDadosPessoais(aluno, dados, CABECALHOS);

    expect(resultado.ok).toBe(true);
    expect(mocks.changeEmail).not.toHaveBeenCalled();
    expect(mocks.moverCredencial).not.toHaveBeenCalled();
    expect(mocks.atualizarUsuario).toHaveBeenCalledTimes(1);
    const persistido = mocks.atualizarUsuario.mock.calls[0]?.[0] as
      | import("@/lib/domain/types").Usuario
      | undefined;
    expect(persistido).toBeDefined();
    expect(persistido?.matricula).toBe(matriculaOriginal);
    expect(persistido?.email).toBe(aluno.email);
    expect(persistido?.nome).toBe("Nome Atualizado no Perfil");
    expect(persistido?.dadosPessoais).toMatchObject({
      email: aluno.email,
      nomeCompleto: "Nome Atualizado no Perfil",
      celular: "21999998888",
    });
  });

  it("não grava novo e-mail: delega a confirmação ao provedor e mantém o atual", async () => {
    const aluno = alunoAtivo();
    const dados = { ...dadosValidos(aluno), email: "novo-endereco@teste.local" };

    const resultado = await atualizarDadosPessoais(aluno, dados, CABECALHOS);

    expect(mocks.changeEmail).toHaveBeenCalledWith({
      body: {
        newEmail: "novo-endereco@teste.local",
        callbackURL: "https://selic.test/perfil?email=confirmado",
      },
      headers: CABECALHOS,
    });
    expect(mocks.moverCredencial).not.toHaveBeenCalled();
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error("Esperava sucesso.");
    expect(resultado.dados.email).toBe(aluno.email);
    expect(resultado.mensagem).toContain("confirmação");

    const persistido = mocks.atualizarUsuario.mock.calls[0]?.[0] as
      | import("@/lib/domain/types").Usuario
      | undefined;
    expect(persistido).toBeDefined();
    expect(persistido?.email).toBe(aluno.email);
    expect(persistido?.dadosPessoais?.email).toBe(aluno.email);
  });

  it("mantém o e-mail atual quando o provedor recusa a solicitação", async () => {
    const aluno = alunoAtivo();
    const dados = { ...dadosValidos(aluno), email: "novo-endereco@teste.local" };
    mocks.changeEmail.mockRejectedValue(
      new APIError(400, { code: "CHANGE_EMAIL_DISABLED", message: "Change email is disabled" }),
    );

    const resultado = await atualizarDadosPessoais(aluno, dados, CABECALHOS);

    expect(resultado).toMatchObject({
      ok: false,
      erros: { email: "Não foi possível solicitar a confirmação do novo e-mail." },
    });
    expect(mocks.atualizarUsuario).not.toHaveBeenCalled();
    expect(aluno.email).not.toBe("novo-endereco@teste.local");
  });

  it("lê o e-mail do perfil a partir da identidade única, não do JSON", async () => {
    const aluno = alunoAtivo();
    aluno.dadosPessoais!.email = "email-antigo-no-json@teste.local";

    const dados = await dadosDoAluno(aluno);

    expect(dados?.email).toBe(aluno.email);
  });

  it("não altera o e-mail quando apenas a caixa muda", async () => {
    const aluno = alunoAtivo();
    const dados = { ...dadosValidos(aluno), email: aluno.email.toUpperCase() };

    const resultado = await atualizarDadosPessoais(aluno, dados, CABECALHOS);

    expect(resultado.ok).toBe(true);
    expect(mocks.changeEmail).not.toHaveBeenCalled();
    const persistido = mocks.atualizarUsuario.mock.calls[0]?.[0] as
      | import("@/lib/domain/types").Usuario
      | undefined;
    expect(persistido?.email).toBe(aluno.email);
  });
});
