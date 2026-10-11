import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FormularioDocumento } from "./formulario-documento";
import { descritorPorTemplate, type DescriptorDocumento } from "@/lib/templates/descriptors";

const DESCRITOR: DescriptorDocumento = {
  templateId: "tpl-teste",
  titulo: "Documento de teste",
  descricao: "Descritor de teste",
  preenchivel: true,
  auto: [
    {
      id: "autoPreenchido",
      rotulo: "Nome do aluno",
      tipo: "auto",
      origem: "aluno",
      somenteLeitura: true,
    },
    {
      id: "autoPendente",
      rotulo: "Endereço do aluno",
      tipo: "auto",
      origem: "aluno",
      obrigatorio: true,
      somenteLeitura: true,
    },
  ],
  secoes: [
    {
      id: "campos",
      titulo: "Campos",
      campos: [
        {
          id: "texto",
          rotulo: "Campo de texto",
          tipo: "texto",
          origem: "digitado",
          obrigatorio: true,
        },
        {
          id: "resumo",
          rotulo: "Resumo",
          tipo: "textarea",
          origem: "digitado",
          maximoPalavras: 3,
        },
        { id: "nota", rotulo: "Nota", tipo: "numero", origem: "digitado", min: 0, max: 10 },
        { id: "data", rotulo: "Data", tipo: "data", origem: "digitado" },
        { id: "hora", rotulo: "Hora", tipo: "hora", origem: "digitado" },
        {
          id: "selecao",
          rotulo: "Seleção",
          tipo: "select",
          origem: "digitado",
          opcoes: [{ valor: "a", rotulo: "Opção A" }],
        },
        {
          id: "escolha",
          rotulo: "Escolha",
          tipo: "radio",
          origem: "digitado",
          opcoes: [
            { valor: "sim", rotulo: "Sim" },
            { valor: "nao", rotulo: "Não" },
          ],
        },
        { id: "marcacao", rotulo: "Marcação", tipo: "checkbox", origem: "digitado" },
        {
          id: "fixo",
          rotulo: "Texto fixo",
          tipo: "fixo",
          origem: "literal",
          ajuda: "Conteúdo fixo.",
        },
        {
          id: "instrucao",
          rotulo: "Instrução",
          tipo: "instrucao",
          origem: "literal",
          ajuda: "Orienta o preenchimento.",
        },
        {
          id: "grade",
          rotulo: "Lançamentos",
          tipo: "grade",
          origem: "digitado",
          totalAutomatico: true,
          colunas: [
            { chave: "entrada", rotulo: "Entrada", tipo: "hora", mascara: "hora" },
            { chave: "saida", rotulo: "Saída", tipo: "hora", mascara: "hora" },
            { chave: "duracao", rotulo: "Duração (h)", tipo: "numero", automatica: true },
          ],
        },
        { id: "assinatura", rotulo: "Assinatura do aluno", tipo: "assinatura", origem: "digitado" },
      ],
    },
  ],
};

/** Formulário controlado, como a página de preenchimento usa. */
function Controlado({ descriptor = DESCRITOR }: { descriptor?: DescriptorDocumento }) {
  const [valores, setValores] = React.useState<Record<string, unknown>>({
    autoPreenchido: "Maria de Souza",
  });

  return (
    <FormularioDocumento
      descriptor={descriptor}
      valores={valores}
      aoMudar={(campoId, valor) => setValores((atual) => ({ ...atual, [campoId]: valor }))}
    />
  );
}

describe("FormularioDocumento", () => {
  it("exibe um único rótulo e mantém as máscaras no Formulário de Liberação", async () => {
    const pessoa = userEvent.setup();
    const descriptor = descritorPorTemplate("tpl-formulario-liberacao")!;

    render(<Controlado descriptor={descriptor} />);

    for (const rotulo of ["CEP", "Telefone", "Celular", "Telefone do(a) supervisor(a)"]) {
      expect(screen.getByText(rotulo)).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: rotulo })).toBeRequired();
    }

    const cep = screen.getByRole("textbox", { name: "CEP" });
    await pessoa.type(cep, "23940000");
    expect(cep).toHaveValue("23940-000");
  });

  it("renderiza um controle para cada tipo de campo do descritor", () => {
    render(<Controlado />);

    expect(screen.getByText("Campo de texto")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Sim" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Marcação" })).toBeInTheDocument();
    expect(screen.getByText("Conteúdo fixo.")).toBeInTheDocument();
    expect(screen.getByText("Orienta o preenchimento.")).toBeInTheDocument();
    expect(screen.getByText(/assinatura colhida na via impressa/i)).toBeInTheDocument();
  });

  it("preenche o campo automático em modo somente leitura", () => {
    render(<Controlado />);

    const automatico = screen.getByText("Maria de Souza");

    expect(automatico).toHaveAttribute("aria-readonly", "true");
  });

  it("sinaliza pendência quando o dado automático não está no cadastro", () => {
    render(<Controlado />);

    expect(screen.getByText(/complete o cadastro/i)).toBeInTheDocument();
  });

  it("conta as palavras e sinaliza o excedente", async () => {
    const pessoa = userEvent.setup();

    render(<Controlado />);

    const resumo = screen.getByLabelText("Resumo");
    await pessoa.type(resumo, "uma duas tres quatro");

    expect(screen.getByText("4 de 3 palavras")).toBeInTheDocument();
    expect(screen.getByText(/o limite é de 3 palavras/i)).toBeInTheDocument();
  });

  it("calcula a duração e o total da grade", async () => {
    const pessoa = userEvent.setup();

    render(<Controlado />);

    await pessoa.click(screen.getByRole("button", { name: /adicionar linha/i }));
    await pessoa.type(screen.getByLabelText("Entrada — linha 1"), "13:00");
    await pessoa.type(screen.getByLabelText("Saída — linha 1"), "17:00");

    expect(screen.getAllByText("4,0").length).toBeGreaterThan(0);
    expect(screen.getByText(/total \(duração \(h\)\)/i)).toBeInTheDocument();
  });

  it("totaliza horas mensais digitadas na Ficha de Frequência", () => {
    const descriptor: DescriptorDocumento = {
      ...DESCRITOR,
      auto: [],
      secoes: [
        {
          id: "meses",
          titulo: "Frequência mensal",
          campos: [
            {
              id: "meses",
              rotulo: "Meses",
              tipo: "grade",
              origem: "digitado",
              totalAutomatico: true,
              colunas: [{ chave: "horasTrabalhadas", rotulo: "Horas trabalhadas", tipo: "numero" }],
            },
          ],
        },
      ],
    };
    render(
      <FormularioDocumento
        descriptor={descriptor}
        valores={{ meses: [{ horasTrabalhadas: "120" }, { horasTrabalhadas: "80" }] }}
        aoMudar={() => {}}
      />,
    );
    expect(screen.getByText("200,0")).toBeInTheDocument();
  });
});
