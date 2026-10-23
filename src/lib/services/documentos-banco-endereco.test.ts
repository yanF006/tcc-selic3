import { expect, it, vi } from "vitest";
import { usuarios, matriculasImportadas } from "@/lib/fixtures/base";
import { obterEstado, reiniciarEstado } from "./store";
import { criarRascunho } from "./documentos";
import { carregarCliente } from "@/lib/db/prisma";

vi.mock("@/lib/db/prisma", () => ({ bancoConfigurado: () => true, carregarCliente: vi.fn() }));

it("hidrata o banco antes de preparar o endereço do titular, mesmo para autor coordenador", async () => {
  reiniciarEstado();
  obterEstado().documentos = [];
  const registros = structuredClone(usuarios).map((u) => ({
    ...u,
    matricula: u.matricula ?? null,
    cursoId: u.cursoId ?? null,
    membroComissaoEstagio: u.membroComissaoEstagio ?? false,
    dadosPessoais: u.dadosPessoais ?? null,
    criadoEm: new Date(u.criadoEm),
  }));
  registros.find((u) => u.id === "usr-maria")!.dadosPessoais!.endereco.logradouro =
    "Endereço do banco";
  const consultarUsuarios = vi.fn().mockResolvedValue(registros);
  vi.mocked(carregarCliente).mockResolvedValue({
    prisma: {
      usuario: { count: async () => 1, findMany: consultarUsuarios },
      matriculaImportada: {
        count: async () => 1,
        findMany: async () =>
          matriculasImportadas.map((m) => ({ ...m, importadaEm: new Date(m.importadaEm) })),
      },
    },
    Prisma: {},
  } as unknown as Awaited<ReturnType<typeof carregarCliente>>);
  const rede = vi.fn();
  vi.stubGlobal("fetch", rede);
  try {
    const coordenador = obterEstado().usuarios.find((u) => u.id === "usr-ana")!;
    const doc = await criarRascunho(
      { ...coordenador, papeis: ["administrador"] },
      "tpl-formulario-liberacao",
      "est-maria-tecnoweb",
    );
    expect(consultarUsuarios).toHaveBeenCalledOnce();
    expect(doc.alunoId).toBe("usr-maria");
    expect(doc.valores.logradouroAluno).toBe("Endereço do banco");
    expect(rede).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
