import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { AdaptadorCampoMascarado, CampoMascarado } from "./campo-mascarado";

/** Campo controlado por estado, como o usado nas telas. */
function Controlado({
  mascara,
  rotulo,
  inicial = "",
  aoSair,
  erro,
}: {
  mascara: Parameters<typeof CampoMascarado>[0]["mascara"];
  rotulo: string;
  inicial?: string;
  aoSair?: () => void;
  erro?: string;
}) {
  const [valor, setValor] = React.useState(inicial);

  return (
    <CampoMascarado
      id={`teste-${rotulo.toLowerCase().replaceAll(" ", "-")}`}
      rotulo={rotulo}
      mascara={mascara}
      valor={valor}
      aoMudar={setValor}
      aoSair={aoSair}
      erro={erro}
    />
  );
}

/** Formulário mínimo para exercitar o adaptador sobre o React Hook Form. */
function Formulario() {
  const metodo = useForm({ defaultValues: { cpf: "" } });

  return (
    <FormProvider {...metodo}>
      <form>
        <AdaptadorCampoMascarado
          control={metodo.control}
          name="cpf"
          id="teste-cpf"
          rotulo="CPF"
          mascara="cpf"
          obrigatorio
        />
      </form>
    </FormProvider>
  );
}

describe("CampoMascarado", () => {
  it("exibe os onze dígitos do celular com a máscara", async () => {
    const pessoa = userEvent.setup();

    render(<Controlado mascara="celular" rotulo="Celular" />);

    const campo = screen.getByLabelText("Celular");

    await pessoa.type(campo, "21987654321");

    expect(campo).toHaveValue("(21) 98765-4321");
  });

  it("recusa letras e símbolos", async () => {
    const pessoa = userEvent.setup();

    render(<Controlado mascara="cep" rotulo="CEP" />);

    const campo = screen.getByLabelText("CEP");

    await pessoa.type(campo, "abc23940-000def");

    expect(campo).toHaveValue("23940-000");
  });

  it("limita a quantidade de dígitos da máscara", async () => {
    const pessoa = userEvent.setup();

    render(<Controlado mascara="telefone" rotulo="Telefone" />);

    const campo = screen.getByLabelText("Telefone");

    await pessoa.type(campo, "2133334444999");

    expect(campo).toHaveValue("(21) 3333-4444");
  });

  it("formata a data no padrão de dia, mês e ano", async () => {
    const pessoa = userEvent.setup();

    render(<Controlado mascara="data" rotulo="Data de nascimento" />);

    const campo = screen.getByLabelText("Data de nascimento");

    await pessoa.type(campo, "12031998");

    expect(campo).toHaveValue("12/03/1998");
  });

  it("avisa ao sair do campo", async () => {
    const pessoa = userEvent.setup();
    let saidas = 0;

    render(
      <Controlado
        mascara="cpf"
        rotulo="CPF"
        aoSair={() => {
          saidas += 1;
        }}
      />,
    );

    await pessoa.click(screen.getByLabelText("CPF"));
    await pessoa.click(document.body);

    expect(saidas).toBe(1);
  });

  it("associa o erro ao campo", () => {
    render(<Controlado mascara="rg" rotulo="RG" erro="RG inválido." inicial="12.345.678" />);

    const campo = screen.getByRole("textbox", { name: /RG/ });

    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAttribute("aria-describedby", "teste-rg-mensagem");
    expect(document.getElementById("teste-rg-mensagem")).toHaveTextContent("RG inválido.");
  });

  it("anuncia a obrigatoriedade sem alterar o nome acessível", () => {
    render(
      <CampoMascarado
        id="teste-cpf-obrigatorio"
        rotulo="CPF"
        mascara="cpf"
        valor=""
        aoMudar={() => {}}
        obrigatorio
      />,
    );

    const campo = screen.getByRole("textbox", { name: "CPF" });

    expect(campo).toHaveAttribute("aria-required", "true");
    expect(campo).toBeRequired();
  });
});

describe("AdaptadorCampoMascarado", () => {
  it("escreve o valor já com máscara no formulário", async () => {
    const pessoa = userEvent.setup();

    render(<Formulario />);

    const campo = screen.getByLabelText("CPF");

    await pessoa.type(campo, "52998224725");

    expect(campo).toHaveValue("529.982.247-25");
  });
});