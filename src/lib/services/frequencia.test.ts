import { beforeEach, describe, expect, it } from "vitest";

import type { Usuario } from "@/lib/domain/types";

import { criarRascunho, documentosDoEstagio } from "./documentos";
import { fichaDoEstagio, iniciarRegistroFicha, registrarFichaFrequencia } from "./frequencia";
import { entrar, sair, usuarioAtual } from "./sessao";
import { reiniciarEstado } from "./store";

const VALORES_FICHA = {
  endereco: "Rua das Acácias, 215",
  areaAtuacao: "Desenvolvimento de software",
  setor: "Tecnologia",
  responsavel: "Ricardo Alves",
  nomeSupervisor: "Ricardo Alves",
  meses: [{ ano: 2026, mes: "Março", diasUteis: 21, diasTrabalhados: 20, horasTrabalhadas: 160 }],
  criterio_1: 9.5,
  criterio_2: 7.5,
};

async function login(email: string) {
  const resultado = await entrar(email, "selic123");

  expect(resultado.ok).toBe(true);

  const atual = usuarioAtual();

  expect(atual).not.toBeNull();

  return atual as Usuario;
}

beforeEach(() => {
  reiniciarEstado();
  sair();
});

describe("registro da Ficha de Frequência assinada (8.12)", () => {
  it("registra a ficha com as horas e as avaliações e a associa ao estágio", async () => {
    const ana = await login("ana.correia@ifrj.edu.br");

    const resultado = await registrarFichaFrequencia(ana, "est-maria-tecnoweb", {
      ...VALORES_FICHA,
      // O cliente pode mandar conceito errado: o servidor recalcula pelas notas.
      conceitoGlobal: 99,
    });

    expect(resultado.erro).toBeUndefined();
    expect(resultado.ok).toBe(true);

    const ficha = await fichaDoEstagio("est-maria-tecnoweb");

    expect(ficha).toMatchObject({
      templateId: "tpl-ficha-frequencia",
      alunoId: "usr-maria",
      estagioId: "est-maria-tecnoweb",
      situacao: "registrada",
      registradoPorId: "usr-ana",
    });
    expect(ficha?.registradoEm).toBeTruthy();
    expect(ficha?.valores.meses).toEqual(VALORES_FICHA.meses);
    expect(ficha?.valores.criterio_1).toBe(9.5);
    expect(ficha?.valores.conceitoGlobal).toBe(8.5);
    expect((await documentosDoEstagio("est-maria-tecnoweb")).map((doc) => doc.id)).toContain(
      ficha?.id,
    );
  });

  it("reaproveita a ficha já registrada ao reabrir o formulário", async () => {
    const ana = await login("ana.correia@ifrj.edu.br");

    const preparado = await iniciarRegistroFicha(ana, "est-maria-hospital");

    expect(preparado.ficha?.id).toBe("doc-frequencia-hospital");
    expect(preparado.aluno.id).toBe("usr-maria");
    expect(preparado.valores.nomeSupervisor).toBe("Marta Ribeiro");
  });

  it("recusa o registro fora do perfil da matriz de preenchimento", async () => {
    const carla = await login("carla.menezes@ifrj.edu.br");

    const resultado = await registrarFichaFrequencia(carla, "est-maria-tecnoweb", VALORES_FICHA);

    expect(resultado.ok).toBe(false);
    expect(resultado.erro).toBe("O registro desta ficha cabe a outro perfil.");
    expect(await fichaDoEstagio("est-maria-tecnoweb")).toBeNull();
  });

  it("recusa o registro quando o estágio não está disponível ao usuário", async () => {
    const ana = await login("ana.correia@ifrj.edu.br");

    const resultado = await registrarFichaFrequencia(ana, "est-nao-existe", VALORES_FICHA);

    expect(resultado.ok).toBe(false);
    expect(resultado.erro).toMatch(/Estágio não disponível para este usuário/);
    expect(await fichaDoEstagio("est-maria-tecnoweb")).toBeNull();
  });

  it("aponta os campos obrigatórios pendentes sem criar documento", async () => {
    const ana = await login("ana.correia@ifrj.edu.br");

    const resultado = await registrarFichaFrequencia(ana, "est-joao-lab", {
      criterio_1: 8,
    });

    expect(resultado.ok).toBe(false);
    expect(resultado.problemas?.map((problema) => problema.campo)).toEqual(
      expect.arrayContaining(["endereco", "areaAtuacao", "setor", "responsavel", "nomeSupervisor"]),
    );
    expect(await fichaDoEstagio("est-joao-lab")).toBeNull();
  });

  it("substitui o rascunho da ficha preservando o mesmo documento", async () => {
    const ana = await login("ana.correia@ifrj.edu.br");
    const rascunho = await criarRascunho(ana, "tpl-ficha-frequencia", "est-maria-tecnoweb");

    const resultado = await registrarFichaFrequencia(ana, "est-maria-tecnoweb", VALORES_FICHA);

    expect(resultado.ok).toBe(true);
    expect(resultado.ficha?.id).toBe(rascunho.id);
    expect(resultado.ficha?.situacao).toBe("registrada");
    const fichas = (await documentosDoEstagio("est-maria-tecnoweb")).filter(
      (doc) => doc.templateId === "tpl-ficha-frequencia",
    );
    expect(fichas).toHaveLength(1);
  });
});
