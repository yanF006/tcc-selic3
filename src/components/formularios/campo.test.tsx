import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CampoSenha, CampoTexto } from "./campo";

function TextoControlado({
  erro,
  tipo = "text",
  inicial = "",
}: {
  erro?: string;
  tipo?: "text" | "email";
  inicial?: string;
}) {
  const [valor, setValor] = React.useState(inicial);

  return (
    <CampoTexto
      id="campo-nome"
      rotulo="Nome completo"
      tipo={tipo}
      obrigatorio
      descricao="Como consta no documento."
      valor={valor}
      aoMudar={setValor}
      erro={erro}
    />
  );
}

function SenhaControlada({ erro }: { erro?: string }) {
  const [valor, setValor] = React.useState("");

  return (
    <CampoSenha
      id="campo-senha"
      rotulo="Senha"
      obrigatorio
      valor={valor}
      aoMudar={setValor}
      erro={erro}
      conferirMinimo
    />
  );
}

describe("associação de rótulo e erro por campo (13.4)", () => {
  it("associa o rótulo, a descrição e o erro ao campo de texto", () => {
    render(<TextoControlado erro="Informe o nome." />);

    const campo = screen.getByLabelText("Nome completo");
    expect(campo).toHaveAttribute("id", "campo-nome");
    expect(campo).toHaveAttribute("aria-required", "true");
    expect(campo).toHaveAttribute("aria-invalid", "true");

    const descricao = document.getElementById("campo-nome-descricao");
    const mensagem = document.getElementById("campo-nome-mensagem");
    expect(descricao).toHaveTextContent("Como consta no documento.");
    expect(mensagem).toHaveTextContent("Informe o nome.");
    expect(campo).toHaveAttribute("aria-describedby", "campo-nome-descricao campo-nome-mensagem");
  });

  it("liga o erro de formato de e-mail ao próprio campo depois do blur", async () => {
    render(<TextoControlado tipo="email" inicial="maria" />);
    const campo = screen.getByLabelText("Nome completo");
    await userEvent.click(campo);
    await userEvent.tab();

    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAttribute("aria-describedby", "campo-nome-descricao campo-nome-mensagem");
    expect(document.getElementById("campo-nome-mensagem")).toHaveTextContent(
      "Formato de e-mail inválido",
    );
  });

  it("associa a mensagem de senha curta ao campo e mantém o botão de visibilidade nomeado", async () => {
    render(<SenhaControlada />);
    const campo = screen.getByLabelText("Senha");
    await userEvent.type(campo, "curta");
    await userEvent.tab();

    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAttribute("aria-describedby", "campo-senha-mensagem");
    expect(document.getElementById("campo-senha-mensagem")).toHaveTextContent(
      "A senha deve ter ao menos 8 caracteres.",
    );
    expect(screen.getByRole("button", { name: "Mostrar a senha" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("mostra o erro do servidor no campo sem depender da cor", () => {
    render(<SenhaControlada erro="Senha incorreta." />);

    expect(screen.getByLabelText("Senha")).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById("campo-senha-mensagem")).toHaveTextContent("Senha incorreta.");
  });
});
