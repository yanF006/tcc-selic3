import { beforeEach, describe, expect, it } from "vitest";

import { LIMITE_HORAS_DIA, LIMITE_HORAS_SEMANA } from "@/lib/domain/schemas";
import type { Usuario } from "@/lib/domain/types";
import { criarEstagio, lancamentosDoEstagio } from "./estagios";
import { dadosSolicitacaoTeste } from "@/lib/fixtures/solicitacao-teste";
import {
  corrigirLancamento,
  horasDaSemana,
  horasExibidas,
  lancamentoEfetivoDoDia,
  lancarHoras,
  resumoDaSemana,
} from "./lancamentos";
import { entrar, sair, usuarioAtual } from "./sessao";
import { reiniciarEstado } from "./store";

async function mariaLogada(): Promise<Usuario> {
  await sair();
  await entrar("maria.souza@aluno.ifrj.edu.br", "selic123");
  return usuarioAtual() as Usuario;
}

beforeEach(() => {
  reiniciarEstado();
  sair();
});

describe("lançamento de horas (8.19)", () => {
  it("lança dentro do período e soma ao total do estágio", async () => {
    await mariaLogada();

    const lancamento = await lancarHoras({
      estagioId: "est-maria-tecnoweb",
      data: "2026-03-06",
      entrada: "09:00",
      saida: "15:00",
      almocoDesligado: true,
    });

    expect(lancamento.horas).toBe(5);
    expect(lancamentosDoEstagio("est-maria-tecnoweb").map((lan) => lan.id)).toContain(
      lancamento.id,
    );
  });

  it("recusa a jornada acima do limite diário, excluído o almoço", async () => {
    await mariaLogada();

    await expect(
      lancarHoras({
        estagioId: "est-maria-tecnoweb",
        data: "2026-03-06",
        entrada: "09:00",
        saida: "17:00",
        almocoDesligado: true,
      }),
    ).rejects.toThrow(/jornada diária não pode passar de 6 horas \(excluído o almoço\)/);
  });

  it("recusa jornada sem desconto de almoço que ultrapassa o limite", async () => {
    await mariaLogada();

    await expect(
      lancarHoras({
        estagioId: "est-maria-tecnoweb",
        data: "2026-03-06",
        entrada: "09:00",
        saida: "16:00",
        almocoDesligado: false,
      }),
    ).rejects.toThrow(/jornada diária não pode passar de 6 horas/);
  });

  it("desconta o intervalo de almoço somente quando desligado", async () => {
    await mariaLogada();

    const comAlmoco = await lancarHoras({
      estagioId: "est-maria-tecnoweb",
      data: "2026-03-05",
      entrada: "09:00",
      saida: "15:00",
      almocoDesligado: false,
    });

    expect(comAlmoco.horas).toBe(6);

    await corrigirLancamento(comAlmoco.id, {
      entrada: "09:00",
      saida: "15:00",
      almocoDesligado: true,
    });

    expect(await horasExibidas("est-maria-tecnoweb", "2026-03-05")).toBe(5);
  });

  it("recusa data fora do período do estágio", async () => {
    await mariaLogada();

    await expect(
      lancarHoras({
        estagioId: "est-maria-tecnoweb",
        data: "2030-01-01",
        entrada: "09:00",
        saida: "15:00",
        almocoDesligado: true,
      }),
    ).rejects.toThrow(/fora do período do estágio/);
  });

  it("recusa a soma de lançamentos que ultrapassa o teto do mesmo dia", async () => {
    await mariaLogada();

    await expect(
      lancarHoras({
        estagioId: "est-maria-tecnoweb",
        data: "2026-03-02",
        entrada: "09:00",
        saida: "15:00",
        almocoDesligado: true,
      }),
    ).rejects.toThrow(/limite de 6/);
  });

  it("aplica o teto de 30 horas por semana", async () => {
    const maria = await mariaLogada();
    const estagio = await criarEstagio(maria, {
      ...dadosSolicitacaoTeste(),
      convenioId: "conv-ti-pinheiral",
      supervisorId: "sup-ricardo",
      orientadorId: "ori-carla",
      dataInicio: "2027-01-04",
      dataFim: "2027-01-29",
      documentosSelecionados: [],
    });
    // Cenário autorizado para isolar o cálculo da jornada; o fluxo de liberação tem testes próprios.
    estagio.situacao = "em_andamento";
    estagio.liberadoEm = "2027-01-01T00:00:00Z";

    const dias = ["2027-01-04", "2027-01-05", "2027-01-06", "2027-01-07", "2027-01-08"];

    for (const data of dias) {
      await lancarHoras({
        estagioId: estagio.id,
        data,
        entrada: "09:00",
        saida: "16:00",
        almocoDesligado: true,
      });
    }

    expect(await horasDaSemana(estagio.id, "2027-01-04")).toBe(LIMITE_HORAS_SEMANA);
    expect(await resumoDaSemana(estagio.id, "2027-01-04")).toMatchObject({
      limite: LIMITE_HORAS_SEMANA,
      excedeu: false,
    });

    await expect(
      lancarHoras({
        estagioId: estagio.id,
        data: "2027-01-09",
        entrada: "09:00",
        saida: "11:00",
        almocoDesligado: true,
      }),
    ).rejects.toThrow(/semana ultrapassa o limite de 30 horas/);
  });

  it("aceita o limite diário máximo, excluído o almoço", async () => {
    await mariaLogada();

    const lancamento = await lancarHoras({
      estagioId: "est-maria-tecnoweb",
      data: "2026-03-06",
      entrada: "09:00",
      saida: "16:00",
      almocoDesligado: true,
    });

    expect(lancamento.horas).toBe(LIMITE_HORAS_DIA);
  });
});

describe("correção do lançamento sem rasura (8.20)", () => {
  it("preserva o original e registra a correção vinculada a ele", async () => {
    await mariaLogada();

    const correcao = await corrigirLancamento("lan-3", {
      entrada: "09:00",
      saida: "15:00",
      almocoDesligado: true,
    });

    expect(correcao.tipo).toBe("correcao");
    expect(correcao.corrigeId).toBe("lan-3");

    const original = lancamentosDoEstagio("est-maria-tecnoweb").find(
      (lancamento) => lancamento.id === "lan-3",
    );

    expect(original?.horas).toBe(6);
    expect(original?.tipo).toBe("lancamento");
    expect(await lancamentoEfetivoDoDia("est-maria-tecnoweb", "2026-03-04")).toMatchObject({
      id: correcao.id,
      tipo: "correcao",
    });
  });

  it("recusa corrigir um lançamento de correção", async () => {
    await mariaLogada();

    await expect(
      corrigirLancamento("lan-4", {
        entrada: "09:00",
        saida: "15:00",
        almocoDesligado: true,
      }),
    ).rejects.toThrow(/Só lançamentos originais podem ser corrigidos/);
  });
});
