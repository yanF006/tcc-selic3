import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormularioCadastro } from "@/app/(publico)/cadastro/formulario-cadastro";
import { FormularioPerfil } from "@/app/(aluno)/perfil/formulario-perfil";
import { validarEtapaUmAction, concluirCadastroAction } from "@/app/(publico)/cadastro/acoes";
import { atualizarPerfilAction } from "@/app/(aluno)/perfil/acoes";
import { buscarEnderecoPorCep } from "@/lib/services/endereco";
import { usuarios, cursos, turmas, periodos } from "@/lib/fixtures/base";
import type { ResultadoCep } from "@/lib/domain/consulta-cep";
import type { DadosPessoais } from "@/lib/domain/types";

vi.mock("@/app/(publico)/cadastro/acoes", () => ({
  validarEtapaUmAction: vi.fn(),
  concluirCadastroAction: vi.fn(),
}));
vi.mock("@/app/(aluno)/perfil/acoes", () => ({ atualizarPerfilAction: vi.fn() }));
vi.mock("@/lib/services/endereco", () => ({ buscarEnderecoPorCep: vi.fn() }));
afterEach(() => vi.clearAllMocks());
const aluno = usuarios.find((u) => u.id === "usr-maria")!;
const opcoes = { cursos, turmas, periodos };
const mudar = (rotulo: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(rotulo, { exact: true }), { target: { value: valor } });

async function preparar(tipo: "cadastro" | "perfil") {
  if (tipo === "perfil")
    return render(
      <FormularioPerfil {...opcoes} usuario={aluno} dadosIniciais={aluno.dadosPessoais!} />,
    );
  vi.mocked(validarEtapaUmAction).mockResolvedValue({
    ok: true,
    previa: {
      id: "previa",
      matricula: "20241006904",
      email: "novo@aluno.ifrj.edu.br",
      nome: "Aluno",
      matriculaNaoRegistrada: false,
      criadoEm: "2026-01-01",
    },
    mensagem: "Etapa conferida",
  });
  const tela = render(<FormularioCadastro {...opcoes} />);
  mudar("Matrícula", "20241006904");
  mudar("E-mail", "novo@aluno.ifrj.edu.br");
  mudar("Senha", "selic123");
  mudar("Confirmar senha", "selic123");
  fireEvent.submit(tela.container.querySelector("form")!);
  await screen.findByLabelText("CEP");
  return tela;
}

describe.each(["cadastro", "perfil"] as const)("endereço no %s", (tipo) => {
  it("envia o endereço manual enquanto a consulta ainda está pendente", async () => {
    let resolver!: (r: ResultadoCep) => void;
    vi.mocked(buscarEnderecoPorCep).mockImplementation(
      () =>
        new Promise((r) => {
          resolver = r;
        }),
    );
    vi.mocked(concluirCadastroAction).mockResolvedValue({
      ok: true,
      usuarioId: "novo",
      situacao: "ativo",
    });
    vi.mocked(atualizarPerfilAction).mockResolvedValue({
      ok: true,
      dados: aluno.dadosPessoais!,
      mensagem: "Perfil atualizado.",
    });
    const tela = await preparar(tipo);
    mudar("CEP", "20040030");
    mudar("Endereço", "Rua manual antes de salvar");
    fireEvent.submit(tela.container.querySelector("form")!);
    const acao = tipo === "cadastro" ? concluirCadastroAction : atualizarPerfilAction;
    await waitFor(() => expect(acao).toHaveBeenCalled());
    await act(async () =>
      resolver({
        status: "encontrado",
        endereco: { cep: "20040030", logradouro: "Não substituir" },
      }),
    );
    if (tipo === "perfil")
      expect(screen.getByLabelText("Endereço")).toHaveValue("Rua manual antes de salvar");
  });
  it("inicializa sem consulta e consulta automaticamente ao informar CEP", async () => {
    vi.mocked(buscarEnderecoPorCep).mockResolvedValue({
      status: "encontrado",
      endereco: {
        cep: "20040030",
        logradouro: "Rua ViaCEP",
        cidade: "Cidade consultada",
        estado: "SP",
      },
    });
    await preparar(tipo);
    expect(buscarEnderecoPorCep).not.toHaveBeenCalled();
    mudar("Número", "s/n");
    mudar("Complemento", "Fundos");
    mudar("Bairro", "Bairro preservado");
    mudar("CEP", "20040030");
    expect(screen.getByLabelText("CEP")).toHaveValue("20040-030");
    await waitFor(() => expect(screen.getByLabelText("Endereço")).toHaveValue("Rua ViaCEP"));
    expect(screen.getByLabelText("UF")).toHaveValue("SP");
    expect(screen.getByLabelText("Bairro")).toHaveValue("Bairro preservado");
    expect(screen.getByLabelText("Número")).toHaveValue("s/n");
    expect(screen.getByLabelText("Complemento")).toHaveValue("Fundos");
    mudar("Endereço", "Correção manual");
    expect(screen.getByLabelText("Endereço")).toHaveValue("Correção manual");
  });
  it.each(["nao_encontrado", "indisponivel"] as const)(
    "informa %s e permite envio dos valores manuais",
    async (status) => {
      vi.mocked(buscarEnderecoPorCep).mockResolvedValue({ status });
      vi.mocked(concluirCadastroAction).mockResolvedValue({
        ok: true,
        usuarioId: "novo",
        situacao: "ativo",
      });
      vi.mocked(atualizarPerfilAction).mockResolvedValue({
        ok: true,
        dados: aluno.dadosPessoais!,
        mensagem: "Perfil atualizado.",
      });
      const tela = await preparar(tipo);
      mudar("Endereço", "Antes da falha");
      mudar("CEP", "20040-030");
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          status === "nao_encontrado" ? "CEP não encontrado" : "Não foi possível consultar",
        ),
      );
      expect(screen.getByLabelText("Endereço")).toHaveValue("Antes da falha");
      mudar("Endereço", "Rua manual");
      mudar("Número", "42");
      mudar("Bairro", "Bairro");
      mudar("Cidade", "Cidade");
      mudar("UF", "RJ");
      fireEvent.submit(tela.container.querySelector("form")!);
      if (tipo === "cadastro") {
        await waitFor(() => expect(concluirCadastroAction).toHaveBeenCalled());
        expect(vi.mocked(concluirCadastroAction).mock.calls[0][1].endereco).toMatchObject({
          cep: "20040-030",
          logradouro: "Rua manual",
          numero: "42",
        });
      } else {
        await waitFor(() => expect(atualizarPerfilAction).toHaveBeenCalled());
        const dados = vi.mocked(atualizarPerfilAction).mock.calls[0][0];
        expect(dados.endereco).toMatchObject({
          cep: "20040-030",
          logradouro: "Rua manual",
          numero: "42",
        });
        tela.unmount();
        render(
          <FormularioPerfil {...opcoes} usuario={aluno} dadosIniciais={dados as DadosPessoais} />,
        );
        expect(screen.getByLabelText("Endereço")).toHaveValue("Rua manual");
        expect(buscarEnderecoPorCep).toHaveBeenCalledTimes(1);
      }
    },
  );
  it("sinaliza inválido sem rede e protege correção durante consulta pendente", async () => {
    let resolver!: (r: ResultadoCep) => void;
    vi.mocked(buscarEnderecoPorCep).mockImplementation(
      () =>
        new Promise((r) => {
          resolver = r;
        }),
    );
    const tela = await preparar(tipo);
    mudar("CEP", "123");
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(screen.getByRole("status")).toHaveTextContent("O CEP deve ter 8 dígitos");
    expect(buscarEnderecoPorCep).not.toHaveBeenCalled();
    mudar("CEP", "20040030");
    expect(screen.getByRole("status")).toHaveTextContent("Consultando");
    mudar("Endereço", "Manual durante consulta");
    expect(
      screen.getByRole("button", {
        name: tipo === "cadastro" ? "Concluir cadastro" : "Salvar alterações",
      }),
    ).toBeEnabled();
    await act(async () =>
      resolver({
        status: "encontrado",
        endereco: { cep: "20040030", logradouro: "Não sobrescrever" },
      }),
    );
    expect(screen.getByLabelText("Endereço")).toHaveValue("Manual durante consulta");
    tela.unmount();
  });
});
