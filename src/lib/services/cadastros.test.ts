import { beforeEach, describe, expect, it } from "vitest";
import { ativarCadastro, consultarCadastros, removerCadastro, salvarCadastro } from "./cadastros";
import { classificacaoConvenio, opcoesSelecao } from "./catalogo";
import { obterEstado, reiniciarEstado } from "./store";
import { esquemaDadosPessoais } from "@/lib/domain/schemas";
import { atualizarDadosPessoais } from "./aluno";

const usuario = (id = "usr-ana") => obterEstado().usuarios.find((registro) => registro.id === id)!;
beforeEach(() => reiniciarEstado());

describe("cadastros da coordenação", () => {
  it("reserva gestão à coordenação de estágio e administração", async () => {
    for (const id of ["usr-maria", "usr-carla"]) {
      await expect(consultarCadastros(usuario(id))).rejects.toThrow(/gestão/);
      await expect(
        salvarCadastro(usuario(id), "curso", { nome: "Novo curso", codigo: "NOVO" }),
      ).rejects.toThrow(/gestão/);
    }
    expect((await consultarCadastros(usuario("usr-admin"))).cursos.length).toBeGreaterThan(0);
  });

  it("cadastra convênio com cinco anos e preserva vínculos na inativação", async () => {
    const criado = await salvarCadastro(usuario(), "convenio", {
      nome: "Convênio novo",
      instituicao: "Instituto Novo",
      cnpj: "11222333000181",
      inicioVigencia: "2024-02-29",
    });
    expect(criado).toMatchObject({ fimVigencia: "2029-02-28", campus: "Pinheiral" });
    const convenio = obterEstado().convenios.find(
      (registro) => registro.id === "conv-ti-pinheiral",
    )!;
    const estagio = obterEstado().estagios.find((registro) => registro.convenioId === convenio.id)!;
    await expect(removerCadastro(usuario(), "convenio", convenio.id)).rejects.toThrow(
      /estágios vinculados/,
    );
    await removerCadastro(usuario(), "convenio", convenio.id, true);
    expect(classificacaoConvenio(convenio)).toBe("expirado");
    expect(obterEstado().estagios).toContain(estagio);
    expect(estagio.convenioId).toBe(convenio.id);
    await ativarCadastro(usuario(), "convenio", convenio.id);
    expect(classificacaoConvenio(convenio)).toBe("ativo");
  });

  it("liga turmas a curso e períodos, validando também a seleção do aluno", async () => {
    const curso = await salvarCadastro(usuario(), "curso", { nome: "Curso novo", codigo: "NOVO" });
    const periodo = await salvarCadastro(usuario(), "periodo", { ano: 2040, semestre: 1 });
    await expect(
      salvarCadastro(usuario(), "turma", {
        nome: "Turma nova",
        cursoId: "inexistente",
        periodoIds: [periodo.id],
      }),
    ).rejects.toThrow(/curso ativo/);
    const turma = await salvarCadastro(usuario(), "turma", {
      nome: "Turma nova",
      cursoId: curso.id,
      periodoIds: [periodo.id],
    });
    const opcoes = await opcoesSelecao();
    expect(opcoes.turmasPorCurso[curso.id]).toEqual([turma.id]);
    expect(opcoes.periodosPorCurso?.[curso.id]).toEqual([periodo.id]);
    const dadosAluno = {
      ...usuario("usr-maria").dadosPessoais!,
      cursoId: curso.id,
      turmaId: turma.id,
      periodoId: periodo.id,
    };
    expect(esquemaDadosPessoais(opcoes).safeParse(dadosAluno).success).toBe(true);
    expect(
      esquemaDadosPessoais(opcoes).safeParse({ ...dadosAluno, periodoId: "periodo-2026-1" })
        .success,
    ).toBe(false);
    await expect(removerCadastro(usuario(), "curso", curso.id)).rejects.toThrow(/vínculos/);
  });

  it("recusa exclusão de curso e turma com alunos e permite inativação", async () => {
    await expect(removerCadastro(usuario(), "curso", "curso-ads")).rejects.toThrow(/vínculos/);
    await expect(removerCadastro(usuario(), "turma", "turma-ads-2026-1a")).rejects.toThrow(
      /vínculos/,
    );
    await removerCadastro(usuario(), "turma", "turma-ads-2026-1a", true);
    expect(
      obterEstado().usuarios.find((registro) => registro.id === "usr-maria")?.dadosPessoais
        ?.turmaId,
    ).toBe("turma-ads-2026-1a");
    await ativarCadastro(usuario(), "turma", "turma-ads-2026-1a");
  });

  it("exclusão do orientador remove dados pessoais e preserva referências", async () => {
    const pessoa = obterEstado().pessoas.find((registro) => registro.id === "ori-carla")!;
    expect(pessoa.dadosPessoais?.cpf).toBeTruthy();
    await removerCadastro(usuario(), "orientador", pessoa.id);
    expect(pessoa).toMatchObject({
      nome: "Cadastro excluído",
      email: "",
      telefone: "",
      situacao: "inativo",
    });
    expect(pessoa.dadosPessoais).toBeUndefined();
    expect(obterEstado().estagios.some((estagio) => estagio.orientadorId === pessoa.id)).toBe(true);
  });

  it("inativar curso e turma não impede o aluno de atualizar o perfil existente", async () => {
    const aluno = usuario("usr-maria");
    await removerCadastro(usuario(), "curso", aluno.dadosPessoais!.cursoId, true);
    await removerCadastro(usuario(), "turma", aluno.dadosPessoais!.turmaId, true);
    await removerCadastro(usuario(), "periodo", aluno.dadosPessoais!.periodoId, true);
    const resultado = await atualizarDadosPessoais(aluno, {
      ...aluno.dadosPessoais!,
      celular: "21999998888",
    });
    expect(resultado.ok).toBe(true);
    expect((await opcoesSelecao()).cursosIds).not.toContain(aluno.dadosPessoais!.cursoId);
  });
});
