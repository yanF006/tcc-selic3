import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DIGEST_BANCO_INDISPONIVEL, MENSAGEM_BANCO_INDISPONIVEL } from "@/lib/db/mensagens";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import { CarregandoArea } from "./carregando-area";
import { ConteudoErroArea } from "./erro-area";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("estados de área", () => {
  it("identifica o carregamento sem confundir com lista vazia", () => {
    render(<CarregandoArea />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/Carregando dados/)).toBeInTheDocument();
  });

  it("diferencia indisponibilidade de banco de erro inesperado", () => {
    const { rerender } = render(
      <ConteudoErroArea
        erro={Object.assign(new Error("qualquer"), { digest: DIGEST_BANCO_INDISPONIVEL })}
        reset={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Dados temporariamente indisponíveis" }),
    ).toBeInTheDocument();
    expect(screen.getByText(MENSAGEM_BANCO_INDISPONIVEL)).toBeInTheDocument();

    rerender(<ConteudoErroArea erro={new Error("detalhe interno")} reset={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Não foi possível carregar" })).toBeInTheDocument();
    expect(screen.queryByText("detalhe interno")).not.toBeInTheDocument();
  });

  it("refaz a leitura com reset e refresh ao tentar novamente", () => {
    const reset = vi.fn();
    render(<ConteudoErroArea erro={new Error("falha")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(reset).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});
