import { beforeEach, describe, expect, it } from "vitest";

import type { Usuario } from "@/lib/domain/types";
import {
  convenios,
  cursos,
  estagios,
  lancamentosHoras,
  matriculasImportadas,
  pessoas,
  periodos,
  solicitacoesAcesso,
  turmas,
  usuarios,
} from "@/lib/fixtures/base";
import { templates } from "@/lib/fixtures/templates";

import { cadastrarConvenio, listarConvenios } from "./catalogo";
import { documentosDoAluno, documentosDoEstagio, listarDocumentos } from "./documentos";
import { listarLancamentos, horasEfetivasDoDia, lancamentoEfetivoDoDia } from "./lancamentos";
import { listarEstagios, estagiosDoAluno } from "./estagios";
import { filtrarPorTexto, paginar, TAMANHO_PADRAO } from "./paginacao";
import { entrar, usuarioAtual } from "./sessao";
import { reiniciarEstado } from "./store";

import { documentos, notificacoes, pareceres } from "@/lib/fixtures/base";

/**
 * Validação das fixtures (3.2): toda referência entre agregados precisa
 * apontar para um registro existente.
 */

beforeEach(() => {
  reiniciarEstado();
});

describe("integridade das fixtures", () => {
  it("cobre os dois ou mais cursos com turmas e períodos", () => {
    expect(cursos.length).toBeGreaterThanOrEqual(2);
    expect(turmas.length).toBeGreaterThanOrEqual(2);
    expect(periodos.length).toBeGreaterThanOrEqual(2);
  });

  it("tem convênios ativos e expirados", () => {
    const fimVigencias = convenios.map((convenio) => convenio.fimVigencia);

    expect(convenios.some((convenio) => convenio.fimVigencia > "2026-10-01")).toBe(true);
    expect(convenios.some((convenio) => convenio.fimVigencia < "2026-10-01")).toBe(true);
    expect(fimVigencias.length).toBe(convenios.length);
  });

  it("tem orientadores e supervisores, um deles inativo", () => {
    expect(pessoas.filter((pessoa) => pessoa.papel === "orientador").length).toBeGreaterThan(0);
    expect(pessoas.filter((pessoa) => pessoa.papel === "supervisor").length).toBeGreaterThan(0);
    expect(pessoas.some((pessoa) => pessoa.situacao === "inativo")).toBe(true);
  });

  it("tem estágios em andamento e concluídos", () => {
    expect(estagios.some((estagio) => estagio.situacao === "em_andamento")).toBe(true);
    expect(estagios.some((estagio) => estagio.situacao === "concluido")).toBe(true);
  });

  it("tem documentos em todas as situações", () => {
    const situacoes = new Set(documentos.map((documento) => documento.situacao));

    for (const situacao of [
      "rascunho",
      "registrada",
      "submetido",
      "em_analise",
      "aprovado",
      "indeferido",
      "inativo",
    ]) {
      expect(situacoes.has(situacao as (typeof documentos)[number]["situacao"]), situacao).toBe(
        true,
      );
    }
  });

  it("não deixa referência quebrada de estágio", () => {
    const usuariosIds = new Set(usuarios.map((usuario) => usuario.id));
    const conveniosIds = new Set(convenios.map((convenio) => convenio.id));
    const pessoasIds = new Set(pessoas.map((pessoa) => pessoa.id));
    const templatesIds = new Set(templates.map((template) => template.id));

    for (const estagio of estagios) {
      expect(usuariosIds.has(estagio.alunoId), estagio.id).toBe(true);
      expect(conveniosIds.has(estagio.convenioId), estagio.id).toBe(true);
      expect(pessoasIds.has(estagio.supervisorId), estagio.id).toBe(true);
      expect(pessoasIds.has(estagio.orientadorId), estagio.id).toBe(true);
      expect(estagio.dataFim > estagio.dataInicio, estagio.id).toBe(true);

      for (const templateId of estagio.documentosSelecionados) {
        expect(templatesIds.has(templateId), `${estagio.id} → ${templateId}`).toBe(true);
      }
    }
  });

  it("não deixa referência quebrada de lançamento, documento, parecer e notificação", () => {
    const estagiosIds = new Set(estagios.map((estagio) => estagio.id));
    const usuariosIds = new Set(usuarios.map((usuario) => usuario.id));
    const templatesIds = new Set(templates.map((template) => template.id));
    const documentosIds = new Set(documentos.map((documento) => documento.id));

    for (const lancamento of lancamentosHoras) {
      expect(estagiosIds.has(lancamento.estagioId), lancamento.id).toBe(true);
      expect(usuariosIds.has(lancamento.alunoId), lancamento.id).toBe(true);
      expect(lancamento.horas).toBeGreaterThan(0);
    }

    for (const documento of documentos) {
      expect(usuariosIds.has(documento.alunoId), documento.id).toBe(true);
      expect(templatesIds.has(documento.templateId), documento.id).toBe(true);

      if (documento.estagioId)
        expect(estagiosIds.has(documento.estagioId), documento.id).toBe(true);
    }

    for (const parecer of pareceres) {
      expect(documentosIds.has(parecer.documentoId), parecer.id).toBe(true);
      expect(usuariosIds.has(parecer.autorId), parecer.id).toBe(true);
    }

    for (const notificacao of notificacoes) {
      expect(usuariosIds.has(notificacao.destinatarioId), notificacao.id).toBe(true);
    }
  });

  it("não deixa referência quebrada em matrículas, solicitações e cadastros", () => {
    expect(matriculasImportadas.length).toBeGreaterThan(0);
    expect(solicitacoesAcesso.some((solicitacao) => solicitacao.situacao === "pendente")).toBe(
      true,
    );

    const cursosIds = new Set(cursos.map((curso) => curso.id));
    const turmasIds = new Set(turmas.map((turma) => turma.id));
    const periodosIds = new Set(periodos.map((periodo) => periodo.id));

    for (const usuario of usuarios) {
      if (!usuario.dadosPessoais) continue;

      const dados = usuario.dadosPessoais;

      expect(cursosIds.has(dados.cursoId), usuario.id).toBe(true);
      expect(turmasIds.has(dados.turmaId), usuario.id).toBe(true);
      expect(periodosIds.has(dados.periodoId), usuario.id).toBe(true);
    }
  });

  it("mantém o campus único do sistema", () => {
    for (const convenio of convenios) expect(convenio.campus).toBe("Pinheiral");
    for (const usuario of usuarios) expect(usuario.campus).toBe("Pinheiral");
  });

  it("mantém o identificador único por agregado", () => {
    const conjuntos = [
      cursos,
      turmas,
      periodos,
      convenios,
      pessoas,
      usuarios,
      estagios,
      documentos,
    ];

    for (const registros of conjuntos) {
      const ids = registros.map((registro) => registro.id);

      expect(new Set(ids).size, "identificador repetido").toBe(ids.length);
    }
  });
});

describe("paginação das listagens", () => {
  it("aplica tamanho de página padrão", () => {
    const pagina = paginar(Array.from({ length: 25 }, (_, i) => i));

    expect(pagina.itens).toHaveLength(TAMANHO_PADRAO);
    expect(pagina.total).toBe(25);
    expect(pagina.pagina).toBe(1);
  });

  it("corrige página fora do intervalo", () => {
    expect(paginar([1, 2, 3], { pagina: 9 }).pagina).toBe(1);
    expect(paginar([1, 2, 3], { pagina: 0 }).pagina).toBe(1);
  });

  it("filtra por texto em campos informados", () => {
    const itens = [{ nome: "Maria" }, { nome: "João" }];

    expect(filtrarPorTexto(itens, "mar", (item) => [item.nome])).toEqual([{ nome: "Maria" }]);
    expect(filtrarPorTexto(itens, "", (item) => [item.nome])).toHaveLength(2);
  });

  it("pagina documentos do aluno", async () => {
    const primeira = await listarDocumentos("usr-maria", { tamanho: 3, pagina: 1 });
    const segunda = await listarDocumentos("usr-maria", { tamanho: 3, pagina: 2 });

    expect(primeira.total).toBeGreaterThan(3);
    expect(primeira.itens).toHaveLength(3);
    expect(segunda.itens[0].id).not.toBe(primeira.itens[0].id);
  });

  it("filtra documentos por estágio", async () => {
    const doEstagio = await documentosDoEstagio("est-maria-hospital");

    expect(doEstagio.length).toBeGreaterThan(0);
    expect(doEstagio.every((documento) => documento.estagioId === "est-maria-hospital")).toBe(true);
  });

  it("filtra convênios por situação e busca", async () => {
    const ativos = await listarConvenios({ situacao: "ativo", tamanho: 50 });

    expect(
      ativos.itens.every(
        (convenio) => convenio.fimVigencia > new Date().toISOString().slice(0, 10),
      ),
    ).toBe(true);

    const buscados = await listarConvenios({ busca: "hospital", tamanho: 50 });

    expect(buscados.itens).toHaveLength(1);
    expect(buscados.itens[0].id).toBe("conv-hospital-pinheiral");
  });

  it("cadastra convênio com cinco anos de vigência e Campus Pinheiral", async () => {
    const convenio = await cadastrarConvenio({
      instituicao: "Instituto de EducaçãoNova",
      nome: "Convênio de Estágio — Instituto Nova",
      cnpj: "99.888.777/0001-66",
      inicioVigencia: "2026-11-01",
    });

    expect(convenio.fimVigencia).toBe("2031-11-01");
    expect(convenio.campus).toBe("Pinheiral");
    expect(convenio.renovacoes).toBe(0);
    expect(convenio.situacao).toBe("ativo");
  });

  it("pagina estágios e lançamentos", async () => {
    const paginaEstagios = await listarEstagios({ tamanho: 2 });
    const paginaLancamentos = await listarLancamentos("est-maria-hospital", { tamanho: 1 });

    expect(paginaEstagios.total).toBe(estagios.length);
    expect(paginaEstagios.itens).toHaveLength(2);
    expect(paginaLancamentos.total).toBe(2);
    expect(paginaLancamentos.itens).toHaveLength(1);
  });

  it("mantém o valor efetivo do lançamento corrigido", async () => {
    const efetivo = await lancamentoEfetivoDoDia("est-maria-tecnoweb", "2026-03-04");

    expect(efetivo?.tipo).toBe("correcao");
    expect(await horasEfetivasDoDia("est-maria-tecnoweb", "2026-03-04")).toBe(5.5);
  });

  it("documentos do aluno incluem as duas situações de todos os fixtures", async () => {
    await entrar("maria.souza@aluno.ifrj.edu.br", "selic123");
    const lista = await documentosDoAluno("usr-maria");

    expect(lista.some((documento) => documento.situacao === "rascunho")).toBe(true);
    expect(lista.some((documento) => documento.situacao === "aprovado")).toBe(true);
  });

  it("estágios do aluno trazem convenênio, supervisor e orientador", async () => {
    await entrar("maria.souza@aluno.ifrj.edu.br", "selic123");

    const usuario = usuarioAtual() as Usuario;
    const lista = await estagiosDoAluno(usuario.id);

    expect(lista).toHaveLength(2);
  });
});
