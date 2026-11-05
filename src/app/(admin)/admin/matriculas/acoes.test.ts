import { beforeEach, describe, expect, it, vi } from "vitest";

import { BancoIndisponivelError } from "@/lib/db/erros";
import { MENSAGEM_BANCO_INDISPONIVEL } from "@/lib/db/mensagens";

const mocks = vi.hoisted(() => ({
  exigirPapeis: vi.fn(),
  registrarMatricula: vi.fn(),
  importarMatriculas: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({ exigirPapeis: mocks.exigirPapeis }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/services/administracao", () => ({
  registrarMatricula: mocks.registrarMatricula,
  importarMatriculas: mocks.importarMatriculas,
}));

import { importarMatriculasAction, registrarMatriculaAction } from "./acoes";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.exigirPapeis.mockResolvedValue({ id: "usr-admin" });
});

describe("ações de matrículas", () => {
  it("devolve erro seguro quando a gravação falha", async () => {
    mocks.registrarMatricula.mockRejectedValue(
      new BancoIndisponivelError(new Error("pool timeout")),
    );

    const resultado = await registrarMatriculaAction({
      matricula: "20260000001",
      nome: "Aluno",
      curso: "Informática",
    });

    expect(resultado).toEqual({ ok: false, erro: MENSAGEM_BANCO_INDISPONIVEL });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("revalida somente depois de uma importação bem-sucedida", async () => {
    const relatorio = {
      id: "imp-1",
      arquivo: "matriculas.csv",
      importadoEm: "2026-01-01T00:00:00.000Z",
      validas: 1,
      rejeitadas: 0,
      ignoradas: 0,
      itens: [{ matricula: "20260000001", nome: "Aluno", resultado: "valida" }],
    };

    mocks.importarMatriculas.mockResolvedValue(relatorio);

    const resultado = await importarMatriculasAction("matriculas.csv", [
      { matricula: "20260000001", nome: "Aluno", curso: "Informática" },
    ]);

    expect(resultado).toEqual({ ok: true, resultado: relatorio });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/matriculas");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/usuarios");
  });
});
