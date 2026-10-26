import { beforeEach, describe, expect, it } from "vitest";
import { pesquisarEstatisticas, recorteDeEstatisticas } from "./estatisticas";
import { obterEstado, reiniciarEstado } from "./store";

const usuario = (id = "usr-ana") => obterEstado().usuarios.find((registro) => registro.id === id)!;

beforeEach(() => reiniciarEstado());

describe("estatísticas de estágio", () => {
  it("inclui a preparação na pesquisa sem somá-la ao andamento ou à conclusão (7.13)", async () => {
    const pesquisa = await pesquisarEstatisticas(usuario());

    expect(pesquisa.total).toBe(5);
    expect(pesquisa.indicadores.situacoes).toEqual({
      em_preparacao: 1,
      em_andamento: 2,
      concluido: 2,
    });
    expect(pesquisa.itens.map((item) => item.estagio.situacao)).toContain("em_preparacao");

    const preparacao = await pesquisarEstatisticas(usuario(), { situacao: "em_preparacao" });
    expect(preparacao.total).toBe(1);
    expect(preparacao.indicadores.situacoes).toMatchObject({
      em_preparacao: 1,
      em_andamento: 0,
      concluido: 0,
    });
  });

  it("pesquisa por aluno, orientador, supervisor e instituição com total (12.1)", async () => {
    const porAluno = await pesquisarEstatisticas(usuario(), { aluno: "Maria" });
    expect(porAluno.total).toBe(2);
    expect(porAluno.opcoes.alunos.find((opcao) => opcao.rotulo.includes("Maria"))?.total).toBe(2);

    const porOrientador = await pesquisarEstatisticas(usuario(), { orientador: "Carla" });
    expect(porOrientador.total).toBe(4);

    const porSupervisor = await pesquisarEstatisticas(usuario(), { supervisor: "Ricardo" });
    expect(porSupervisor.total).toBe(3);

    const porInstituicao = await pesquisarEstatisticas(usuario(), { instituicao: "Hospital" });
    expect(porInstituicao.total).toBe(1);
    expect(porInstituicao.itens[0].instituicao).toBe("Hospital Municipal de Pinheiral");

    const vazio = await pesquisarEstatisticas(usuario(), { aluno: "sem resultado" });
    expect(vazio.total).toBe(0);
    expect(vazio.itens).toEqual([]);
  });

  it("combina o filtro de concluídos com os demais filtros (12.2)", async () => {
    const concluidos = await pesquisarEstatisticas(usuario(), { situacao: "concluido" });
    expect(concluidos.total).toBe(2);
    expect(concluidos.itens.every((item) => item.estagio.situacao === "concluido")).toBe(true);

    const combinado = await pesquisarEstatisticas(usuario(), {
      situacao: "concluido",
      aluno: "Maria",
    });
    expect(combinado.total).toBe(1);
    expect(combinado.itens[0].estagio.id).toBe("est-maria-hospital");

    const vazio = await pesquisarEstatisticas(usuario(), {
      situacao: "concluido",
      aluno: "Luiza",
    });
    expect(vazio.total).toBe(0);
  });

  it("filtra por curso, ano e semestre e ordena pela data de início (12.3)", async () => {
    const eletro = await pesquisarEstatisticas(usuario(), { cursoId: "curso-eletro" });
    expect(eletro.itens.map((item) => item.estagio.id)).toEqual(["est-joao-lab"]);

    const porAno = await pesquisarEstatisticas(usuario(), { ano: 2025 });
    expect(porAno.itens.map((item) => item.estagio.id)).toEqual(["est-maria-hospital"]);

    const porSemestre = await pesquisarEstatisticas(usuario(), { ano: 2026, semestre: 1 });
    expect(porSemestre.total).toBe(2);
    expect(porSemestre.itens.map((item) => item.estagio.dataInicio)).toEqual([
      "2026-03-02",
      "2026-03-02",
    ]);

    const todos = await pesquisarEstatisticas(usuario());
    const datas = todos.itens.map((item) => item.estagio.dataInicio);
    expect(datas).toEqual([...datas].sort());
  });

  it("soma horas por aluno, curso, turma, período e instituição, com zero sem lançamento (12.4)", async () => {
    const pesquisa = await pesquisarEstatisticas(usuario());

    const maria = pesquisa.totaisHoras.porAluno.find((grupo) => grupo.rotulo.includes("Maria"));
    expect(maria).toMatchObject({ estagios: 2, horas: 35.5 });

    const joao = pesquisa.totaisHoras.porAluno.find((grupo) => grupo.rotulo.includes("João"));
    expect(joao).toMatchObject({ estagios: 1, horas: 6 });

    const luiza = pesquisa.totaisHoras.porAluno.find((grupo) => grupo.rotulo.includes("Luiza"));
    expect(luiza).toMatchObject({ estagios: 2, horas: 0 });

    const ads = pesquisa.totaisHoras.porCurso.find((grupo) => grupo.rotulo.includes("Análise"));
    expect(ads).toMatchObject({ estagios: 4, horas: 35.5 });

    const tecnico = pesquisa.totaisHoras.porTurma.find((grupo) =>
      grupo.rotulo.includes("ADS 2026.1"),
    );
    expect(tecnico).toMatchObject({ estagios: 4, horas: 35.5 });

    const tecnnoweb = pesquisa.totaisHoras.porInstituicao.find((grupo) =>
      grupo.rotulo.includes("Tecnoweb"),
    );
    expect(tecnnoweb).toMatchObject({ estagios: 3, horas: 19.5 });
    expect(pesquisa.totaisHoras.porPeriodo.length).toBeGreaterThan(0);
  });

  it("monta os painéis de situação, convênios e documentos (12.5, 12.6)", async () => {
    const pesquisa = await pesquisarEstatisticas(usuario());

    expect(pesquisa.indicadores.situacoes.em_andamento).toBe(2);
    expect(pesquisa.indicadores.situacoes.concluido).toBe(2);
    expect(pesquisa.indicadores.convenios.ativos.map((convenio) => convenio.id)).toEqual(
      expect.arrayContaining(["conv-ti-pinheiral", "conv-hospital-pinheiral"]),
    );
    expect(pesquisa.indicadores.convenios.expirados.map((convenio) => convenio.id)).toEqual(
      expect.arrayContaining(["conv-lab-eletro", "conv-cooperativa-serrinha"]),
    );

    const liberacao = pesquisa.indicadores.documentos.find(
      (documento) => documento.templateId === "tpl-formulario-liberacao",
    );
    expect(liberacao).toMatchObject({
      emPreenchimento: 0,
      aprovados: 4,
      indeferidos: 1,
      total: 5,
    });

    const requerimento = pesquisa.indicadores.documentos.find(
      (documento) => documento.templateId === "tpl-requerimento-aproveitamento",
    );
    expect(requerimento?.emPreenchimento).toBe(3);
  });

  it("calcula a taxa de aproveitamento com deferidos e indeferidos (12.7)", async () => {
    const estado = obterEstado();
    estado.documentos.find((documento) => documento.id === "doc-requerimento-maria")!.situacao =
      "aprovado";
    estado.documentos.find((documento) => documento.id === "doc-requerimento-submetido")!.situacao =
      "indeferido";

    const pesquisa = await pesquisarEstatisticas(usuario());

    expect(pesquisa.indicadores.aproveitamento).toEqual({
      deferidos: 1,
      indeferidos: 1,
      taxa: 50,
    });
  });

  it("lista estágios concluídos sem parecer final e o total de pendências (12.8)", async () => {
    const pesquisa = await pesquisarEstatisticas(usuario());

    expect(pesquisa.indicadores.totalPendencias).toBe(2);
    expect(pesquisa.indicadores.pendencias.map((pendencia) => pendencia.estagioId)).toEqual(
      expect.arrayContaining(["est-maria-hospital", "est-joao-lab"]),
    );
    expect(pesquisa.indicadores.pendencias.every((pendencia) => pendencia.documentos >= 1)).toBe(
      true,
    );
  });

  it("restringe o recorte do coordenador de curso ao próprio curso (12.9)", async () => {
    expect(recorteDeEstatisticas(usuario("usr-ana"))).toEqual({
      escopo: "campus",
      titulo: "Estatísticas — Campus Pinheiral",
    });
    expect(recorteDeEstatisticas(usuario("usr-admin")).escopo).toBe("campus");

    const recorte = recorteDeEstatisticas(usuario("usr-carla"));
    expect(recorte).toMatchObject({ escopo: "curso", cursoId: "curso-ads" });
    expect(recorte.titulo).toContain("Análise e Desenvolvimento de Sistemas");

    const pesquisa = await pesquisarEstatisticas(usuario("usr-carla"));
    expect(pesquisa.itens.every((item) => item.cursoId === "curso-ads")).toBe(true);

    await expect(pesquisarEstatisticas(usuario("usr-maria"))).rejects.toThrow(/indisponíveis/);
  });
});
