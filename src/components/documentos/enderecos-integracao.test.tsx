import * as React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormularioDocumento } from "./formulario-documento";
import { ConteudoDocumento } from "@/app/(catalogo)/documentos/[templateId]/conteudo-documento";
import { LaboratorioFormulario } from "./laboratorio-formulario";
import { descritorPorTemplate } from "@/lib/templates/descriptors";
import { GRUPOS_ENDERECO } from "@/lib/templates/grupos-endereco";
import { buscarEnderecoPorCep } from "@/lib/services/endereco";
import { salvarDocumentoAction } from "@/app/(catalogo)/documentos/acoes";
import type { ResultadoCep } from "@/lib/domain/consulta-cep";

vi.mock("@/lib/services/endereco", () => ({ buscarEnderecoPorCep: vi.fn() }));
vi.mock("@/app/(catalogo)/documentos/acoes", () => ({
  salvarDocumentoAction: vi.fn(),
  baixarDocumentoAction: vi.fn(),
  submeterDocumentoAction: vi.fn(),
}));
afterEach(() => vi.clearAllMocks());
const sucesso = (cep = "20040030"): ResultadoCep => ({
  status: "encontrado",
  endereco: {
    cep,
    logradouro: "Rua encontrada",
    bairro: "Bairro novo",
    cidade: "Cidade nova",
    estado: "SP",
  },
});

function valoresIniciais(template: string) {
  return Object.fromEntries(
    GRUPOS_ENDERECO[template].flatMap((g) =>
      Object.entries(g.campos).map(([chave, id]) => [
        id,
        {
          cep: "23940000",
          logradouro: "Original",
          numero: "55",
          complemento: "Sala 1",
          bairro: "Manual",
          cidade: "Pinheiral",
          estado: "RJ",
        }[chave],
      ]),
    ),
  );
}
function Controlado({
  template,
  desabilitado = false,
  legado = false,
}: {
  template: string;
  desabilitado?: boolean;
  legado?: boolean;
}) {
  const [valores, setValores] = React.useState<Record<string, unknown>>(
    legado ? { endereco: "Rua antiga, 42, Sala A", cep: "23940000" } : valoresIniciais(template),
  );
  return (
    <FormularioDocumento
      descriptor={descritorPorTemplate(template)!}
      valores={valores}
      desabilitado={desabilitado}
      aoMudar={(id, valor) => setValores((v) => ({ ...v, [id]: valor }))}
      aoMudarGrupo={(novos) => setValores((v) => ({ ...v, ...novos }))}
    />
  );
}

describe("integração dos sete grupos de documentos", () => {
  it.each(
    Object.entries(GRUPOS_ENDERECO).flatMap(([template, grupos]) =>
      grupos.map((g) => [template, g.rotulo] as const),
    ),
  )("%s / %s", async (template, rotulo) => {
    vi.mocked(buscarEnderecoPorCep).mockResolvedValue(sucesso());
    const pessoa = userEvent.setup();
    render(<Controlado template={template} />);
    const grupo = within(screen.getByRole("group", { name: rotulo }));
    expect(buscarEnderecoPorCep).not.toHaveBeenCalled();
    expect(grupo.getByLabelText("CEP")).toHaveValue("23940-000");
    expect(grupo.getByLabelText("CEP")).toBeDisabled();
    await pessoa.click(grupo.getByRole("button", { name: "Alterar endereço" }));
    fireEvent.change(grupo.getByLabelText("Número"), { target: { value: "s/n" } });
    expect(buscarEnderecoPorCep).not.toHaveBeenCalled();
    fireEvent.change(grupo.getByLabelText("CEP"), { target: { value: "20040030" } });
    await waitFor(() => expect(grupo.getByLabelText("Logradouro")).toHaveValue("Rua encontrada"));
    expect(grupo.getByLabelText("UF")).toHaveValue("SP");
    expect(grupo.getByLabelText("Número")).toHaveValue("s/n");
    expect(grupo.getByLabelText("Complemento")).toHaveValue("Sala 1");
    fireEvent.change(grupo.getByLabelText("Logradouro"), { target: { value: "Correção manual" } });
    expect(grupo.getByLabelText("Logradouro")).toHaveValue("Correção manual");
    await pessoa.click(grupo.getByRole("button", { name: "Consultar CEP" }));
    expect(buscarEnderecoPorCep).toHaveBeenCalledTimes(2);
    for (const outro of screen
      .getAllByRole("group")
      .filter(
        (el) =>
          el.querySelector("input[id*='cep'],input[id*='Cep']") &&
          el !== screen.getByRole("group", { name: rotulo }),
      )) {
      expect(within(outro).getByLabelText("Logradouro")).toHaveValue("Original");
    }
  });

  it.each(["tpl-formulario-liberacao", "tpl-relatorio-semestral"])(
    "isola consultas simultâneas em %s",
    async (template) => {
      const pendentes: ((r: ResultadoCep) => void)[] = [];
      vi.mocked(buscarEnderecoPorCep).mockImplementation(
        () => new Promise((r) => pendentes.push(r)),
      );
      render(<Controlado template={template} />);
      const grupos = GRUPOS_ENDERECO[template].map((g) =>
        within(screen.getByRole("group", { name: g.rotulo })),
      );
      for (const g of grupos) {
        fireEvent.click(g.getByRole("button", { name: "Alterar endereço" }));
        fireEvent.click(g.getByRole("button", { name: "Consultar CEP" }));
      }
      expect(grupos[0].getByRole("status")).toHaveTextContent("Consultando");
      expect(grupos[1].getByRole("status")).toHaveTextContent("Consultando");
      await act(async () => {
        pendentes[1]({ status: "nao_encontrado" });
        pendentes[0](sucesso("23940000"));
      });
      expect(grupos[0].getByLabelText("Logradouro")).toHaveValue("Rua encontrada");
      expect(grupos[1].getByLabelText("Logradouro")).toHaveValue("Original");
      expect(grupos[1].getByRole("status")).toHaveTextContent("CEP não encontrado");
    },
  );

  it("respeita formulário protegido e mantém identificação somente leitura", () => {
    render(<Controlado template="tpl-relatorio-semestral" desabilitado />);
    expect(
      screen
        .getAllByRole("button", { name: "Alterar endereço" })
        .every((b) => (b as HTMLButtonElement).disabled),
    ).toBe(true);
    expect(screen.queryByRole("textbox", { name: "Nome do aluno(a)" })).not.toBeInTheDocument();
    expect(buscarEnderecoPorCep).not.toHaveBeenCalled();
  });

  it("não trunca o texto legado ao consultar resposta parcial", async () => {
    vi.mocked(buscarEnderecoPorCep).mockResolvedValue({
      status: "encontrado",
      endereco: { cep: "23940000", cidade: "Pinheiral" },
    });
    render(<Controlado template="tpl-convenio-estagio" legado />);
    const grupo = within(screen.getByRole("group", { name: "Endereço da concedente" }));
    fireEvent.click(grupo.getByRole("button", { name: "Alterar endereço" }));
    fireEvent.click(grupo.getByRole("button", { name: "Consultar CEP" }));
    await waitFor(() => expect(grupo.getByLabelText("Cidade")).toHaveValue("Pinheiral"));
    expect(grupo.getByLabelText("Endereço anterior")).toHaveValue("Rua antiga, 42, Sala A");
    expect(grupo.getByLabelText("Número")).toHaveValue("");
    expect(grupo.getByLabelText("Complemento")).toHaveValue("");
    fireEvent.change(grupo.getByLabelText("Logradouro"), { target: { value: "Rua reconstruída" } });
    fireEvent.change(grupo.getByLabelText("Número"), { target: { value: "42" } });
    expect(grupo.queryByLabelText("Endereço anterior")).not.toBeInTheDocument();
  });

  it("permite salvar durante consulta e invalida a resposta após salvar", async () => {
    let resolver!: (r: ResultadoCep) => void;
    vi.mocked(buscarEnderecoPorCep).mockImplementation(
      () =>
        new Promise((r) => {
          resolver = r;
        }),
    );
    vi.mocked(salvarDocumentoAction).mockImplementation(async (_id, valores) => ({
      ok: true,
      valores,
    }));
    const templateId = "tpl-formulario-liberacao";
    render(
      <ConteudoDocumento
        descriptor={descritorPorTemplate(templateId)!}
        documento={{
          id: "doc-teste",
          templateId,
          alunoId: "usr-maria",
          valores: valoresIniciais(templateId),
          situacao: "rascunho",
          versaoTemplate: 1,
          criadoEm: "2026-01-01",
          atualizadoEm: "2026-01-01",
        }}
        preenchidos={[]}
      />,
    );
    const grupo = within(screen.getByRole("group", { name: "Endereço do aluno" }));
    fireEvent.click(grupo.getByRole("button", { name: "Alterar endereço" }));
    fireEvent.click(grupo.getByRole("button", { name: "Consultar CEP" }));
    fireEvent.change(grupo.getByLabelText("Logradouro"), {
      target: { value: "Manual durante busca" },
    });
    expect(screen.getByRole("button", { name: "Salvar rascunho" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await screen.findByText("Rascunho salvo.");
    await act(async () => resolver(sucesso("23940000")));
    expect(
      within(screen.getByRole("group", { name: "Endereço do aluno" })).getByLabelText("Logradouro"),
    ).toHaveValue("Manual durante busca");
  });

  it("mantém os campos do laboratório sem duplicação", () => {
    render(<LaboratorioFormulario />);
    expect(screen.getAllByRole("textbox", { name: "Texto" })).toHaveLength(1);
    expect(screen.getByText("Maria de Souza")).toHaveAttribute("aria-readonly", "true");
  });
});
