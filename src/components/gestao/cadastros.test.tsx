import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { alterarCadastroAction } from "@/app/(coordenacao)/coordenacao/cadastros/acoes";
import { Cadastros } from "./cadastros";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(coordenacao)/coordenacao/cadastros/acoes", () => ({ alterarCadastroAction: vi.fn() }));

it("envia contatos no formulário existente e preserva o preenchimento quando a gravação falha", async () => {
  vi.mocked(alterarCadastroAction).mockResolvedValue({ ok: false, mensagem: "Tente novamente." });
  const tela = render(<Cadastros apenasConvenios dados={{ cursos: [], turmas: [], periodos: [], pessoas: [], convenios: [] }} />);
  fireEvent.click(screen.getByRole("button", { name: "Adicionar contato" }));
  const contato = within(screen.getByRole("group", { name: "Contato 1" }));
  for (const [rotulo, valor] of [["Nome", "Ana"], ["E-mail", "ana@teste.local"], ["Telefone", "2433334444"], ["Cargo (opcional)", "Diretora"]]) {
    fireEvent.change(contato.getByLabelText(rotulo), { target: { value: valor } });
  }
  fireEvent.submit(tela.container.querySelector("form")!);
  await waitFor(() => expect(alterarCadastroAction).toHaveBeenCalledWith("convenio", expect.objectContaining({
    responsaveis: [{ nome: "Ana", email: "ana@teste.local", telefone: "2433334444", cargo: "Diretora" }],
  }), undefined, "salvar"));
  expect(await screen.findByText("Tente novamente.")).toBeInTheDocument();
  expect(contato.getByLabelText("Nome")).toHaveValue("Ana");
  fireEvent.click(screen.getByRole("button", { name: "Remover contato 1" }));
  expect(screen.queryByRole("group", { name: "Contato 1" })).not.toBeInTheDocument();
});
