import { beforeEach, describe, expect, it, vi } from "vitest";

import { BancoIndisponivelError } from "@/lib/db/erros";
import { MENSAGEM_BANCO_INDISPONIVEL } from "@/lib/db/mensagens";
import { ErroDeRegra } from "@/lib/services/erros";

const mocks = vi.hoisted(() => ({
  exigirPapeis: vi.fn(),
  cadastrarUsuario: vi.fn(),
  editarUsuario: vi.fn(),
  excluirUsuario: vi.fn(),
  inativarUsuario: vi.fn(),
  reativarUsuario: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({ exigirPapeis: mocks.exigirPapeis }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/services/administracao", () => ({
  cadastrarUsuario: mocks.cadastrarUsuario,
  editarUsuario: mocks.editarUsuario,
  excluirUsuario: mocks.excluirUsuario,
  inativarUsuario: mocks.inativarUsuario,
  reativarUsuario: mocks.reativarUsuario,
}));

import { cadastrarUsuarioAction, inativarUsuarioAction } from "./acoes";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.exigirPapeis.mockResolvedValue({ id: "usr-admin" });
});

describe("ações de usuários", () => {
  it("devolve erro de negócio sem vazar detalhes quando o banco falha", async () => {
    mocks.cadastrarUsuario.mockRejectedValue(
      new BancoIndisponivelError(
        new Error("connect ECONNREFUSED mysql://usuario:segredo@db.invalid/selic"),
      ),
    );

    const resultado = await cadastrarUsuarioAction({
      nome: "Novo",
      email: "novo@ifrj.edu.br",
      papeis: ["aluno"],
    });

    expect(resultado).toEqual({ ok: false, erro: MENSAGEM_BANCO_INDISPONIVEL });
    expect(JSON.stringify(resultado)).not.toContain("segredo");
    expect(JSON.stringify(resultado)).not.toContain("db.invalid");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("mantém a mensagem de regra e só revalida em caso de sucesso", async () => {
    mocks.inativarUsuario.mockRejectedValueOnce(
      new ErroDeRegra("Cadastro já está inativo.", "usuario_ja_inativo"),
    );

    await expect(inativarUsuarioAction("usr-1")).resolves.toEqual({
      ok: false,
      erro: "Cadastro já está inativo.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();

    mocks.inativarUsuario.mockResolvedValueOnce(undefined);

    await expect(inativarUsuarioAction("usr-1")).resolves.toEqual({ ok: true });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/usuarios");
  });

  it("não expõe mensagem de erro inesperado", async () => {
    mocks.editarUsuario.mockRejectedValue(new Error("detalhe interno do driver"));

    const resultado = await (await import("./acoes")).editarUsuarioAction("usr-1", {
      nome: "Outro",
    });

    expect(resultado).toEqual({
      ok: false,
      erro: "Não foi possível concluir a operação.",
    });
    expect(JSON.stringify(resultado)).not.toContain("driver");
  });
});
