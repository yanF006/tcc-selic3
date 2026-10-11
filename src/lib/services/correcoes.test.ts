import { beforeEach, describe, expect, it } from "vitest";

import {
  criarRascunho,
  podeConsultarDocumento,
  documentosParaParecer,
  salvarRascunho,
  submeter,
  validarValores,
  valoresAutomaticos,
  valoresDoPreenchimento,
} from "./documentos";
import { exigirAcessoEstagio, editarEstagio, totalHorasDoEstagio } from "./estagios";
import { corrigirLancamento, horasEfetivasDoDia, lancarHoras } from "./lancamentos";
import { decidirSolicitacao, excluirUsuario, listarSolicitacoes } from "./administracao";
import { obterEstado, reiniciarEstado } from "./store";
import { descritorPorTemplate } from "@/lib/templates/descriptors";
import { atualizarDadosPessoais } from "./aluno";
import { concluirCadastro, validarEtapaUm } from "./cadastro";

const usuario = (id: string) => obterEstado().usuarios.find((registro) => registro.id === id)!;

beforeEach(() => {
  reiniciarEstado();
});

describe("integridade dos lançamentos e correções", () => {
  it("soma vários lançamentos por dia e substitui apenas o original corrigido", async () => {
    const primeiro = await lancarHoras({
      estagioId: "est-maria-tecnoweb",
      data: "2026-03-06",
      entrada: "09:00",
      saida: "12:00",
      almocoDesligado: false,
    });
    await lancarHoras({
      estagioId: "est-maria-tecnoweb",
      data: "2026-03-06",
      entrada: "14:00",
      saida: "16:00",
      almocoDesligado: false,
    });
    expect(await horasEfetivasDoDia("est-maria-tecnoweb", "2026-03-06")).toBe(5);
    expect(await totalHorasDoEstagio("est-maria-tecnoweb")).toBe(24.5);
    await corrigirLancamento(primeiro.id, {
      entrada: "08:00",
      saida: "12:00",
      almocoDesligado: false,
    });
    expect(await horasEfetivasDoDia("est-maria-tecnoweb", "2026-03-06")).toBe(6);
    await corrigirLancamento(primeiro.id, {
      entrada: "10:00",
      saida: "12:00",
      almocoDesligado: false,
    });
    expect(await horasEfetivasDoDia("est-maria-tecnoweb", "2026-03-06")).toBe(4);
    expect(
      obterEstado().lancamentos.filter((registro) => registro.corrigeId === primeiro.id),
    ).toHaveLength(2);
  });

  it("recusa correção que ultrapassa o limite semanal sem alterar o histórico", async () => {
    obterEstado().lancamentos = [];
    const primeiro = await lancarHoras({
      estagioId: "est-maria-tecnoweb",
      data: "2026-03-02",
      entrada: "09:00",
      saida: "14:00",
      almocoDesligado: false,
    });
    for (const data of ["2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06"]) {
      await lancarHoras({
        estagioId: "est-maria-tecnoweb",
        data,
        entrada: "09:00",
        saida: "15:00",
        almocoDesligado: false,
      });
    }
    await lancarHoras({
      estagioId: "est-maria-tecnoweb",
      data: "2026-03-07",
      entrada: "09:00",
      saida: "10:00",
      almocoDesligado: false,
    });
    const historico = structuredClone(obterEstado().lancamentos);
    await expect(
      corrigirLancamento(primeiro.id, { entrada: "09:00", saida: "15:00", almocoDesligado: false }),
    ).rejects.toThrow(/30 horas/);
    await expect(
      corrigirLancamento(primeiro.id, { entrada: "09:00", saida: "09:00", almocoDesligado: false }),
    ).rejects.toThrow(/não resulta em horas/);
    expect(obterEstado().lancamentos).toEqual(historico);
    expect(await totalHorasDoEstagio("est-maria-tecnoweb")).toBe(30);
  });
});

describe("documentos e campos derivados", () => {
  it("mantém o conteúdo histórico ao reabrir um rascunho após excluir o aluno", async () => {
    const documento = await criarRascunho(
      usuario("usr-maria"),
      "tpl-ficha-acompanhamento",
      "est-maria-tecnoweb",
    );
    const valores = structuredClone(documento.valores);
    await excluirUsuario("usr-maria");
    const reaberto = await criarRascunho(
      usuario("usr-admin"),
      documento.templateId,
      documento.estagioId,
    );
    expect(reaberto.valores).toEqual(valores);
    await expect(salvarRascunho(documento.id, { aluno: "Outro aluno" })).rejects.toThrow(
      /cadastro inativo/,
    );
    expect(reaberto.valores).toEqual(valores);
  });
  it("trata como pendência o endereço ausente em um cadastro legado", async () => {
    const aluno = structuredClone(usuario("usr-sem-endereco"));
    Reflect.deleteProperty(aluno.dadosPessoais!, "endereco");
    const valores = await valoresAutomaticos("tpl-relatorio-semestral", aluno, "est-sem-endereco");
    expect(valores.endereco).toBe("");
    expect(
      validarValores("tpl-relatorio-semestral", valores).map((problema) => problema.campo),
    ).toContain("endereco");
  });
  it("resolve campos automáticos nas seções e usa rótulos do cadastro", async () => {
    const valores = await valoresAutomaticos(
      "tpl-formulario-liberacao",
      usuario("usr-maria"),
      "est-maria-tecnoweb",
    );
    expect(valores.localEstagio).toContain("Tecnoweb");
    expect(valores.turmaSemestreAno).not.toContain("turma-ads");
    expect(valores.curso).toBe("Análise e Desenvolvimento de Sistemas");
  });

  it("reabre rascunho legado com valores de origem atualizados e impede falsificação", async () => {
    const aluno = usuario("usr-maria");
    const documento = await criarRascunho(
      aluno,
      "tpl-requerimento-aproveitamento",
      "est-maria-hospital",
    );
    expect(documento.valores.nomeCompleto).toBe(aluno.nome);
    await salvarRascunho(documento.id, { nomeCompleto: "Outro aluno" });
    expect(documento.valores.nomeCompleto).toBe(aluno.nome);
    aluno.nome = "Maria Oliveira";
    expect(
      (await criarRascunho(aluno, documento.templateId, documento.estagioId)).valores.nomeCompleto,
    ).toBe("Maria Oliveira");
  });

  it("associa ao aluno do estágio o documento registrado pelo coordenador", async () => {
    const documento = await criarRascunho(
      usuario("usr-ana"),
      "tpl-ficha-frequencia",
      "est-maria-tecnoweb",
    );
    expect(documento.alunoId).toBe("usr-maria");
    expect(documento.valores.aluno).toBe(usuario("usr-maria").nome);
  });

  it("calcula o conceito global no servidor ignorando o valor enviado pelo cliente", async () => {
    const valores = await valoresDoPreenchimento(
      "tpl-ficha-frequencia",
      usuario("usr-maria"),
      "est-maria-tecnoweb",
      { criterio_1: 9.5, criterio_2: 7.5, conceitoGlobal: 1 },
    );
    expect(valores.conceitoGlobal).toBe(8.5);
  });

  it("bloqueia dados obrigatórios de origem ausentes e notas negativas ou não numéricas", async () => {
    const valores = await valoresDoPreenchimento(
      "tpl-relatorio-semestral",
      usuario("usr-sem-endereco"),
      "est-sem-endereco",
      {},
    );
    expect(valores.endereco).toBe("");
    expect(validarValores("tpl-relatorio-semestral", valores).map((erro) => erro.campo)).toContain(
      "endereco",
    );
    for (const criterio_1 of [-1, Number.NaN, "dez"]) {
      expect(
        validarValores("tpl-ficha-frequencia", { criterio_1 }).map((erro) => erro.campo),
      ).toContain("criterio_1");
    }
  });

  it("alinha a matriz de parecer com as specs e recusa submeter o Plano", async () => {
    expect(descritorPorTemplate("tpl-plano-atividades")?.metadados?.tipoParecer).toBe("nenhum");
    expect(descritorPorTemplate("tpl-relatorio-semestral")?.metadados?.tipoParecer).toBe("externo");
    const documento = await criarRascunho(
      usuario("usr-maria"),
      "tpl-plano-atividades",
      "est-maria-tecnoweb",
    );
    const situacao = documento.situacao;
    await expect(submeter(documento.id)).rejects.toThrow(/não está sujeito a parecer/);
    expect(documento.situacao).toBe(situacao);
  });
});

describe("autorização por vínculo e integridade de edição", () => {
  it("restringe também a consulta da fila de parecer ao papel e curso responsáveis", async () => {
    const documento = obterEstado().documentos.find(
      (registro) =>
        registro.templateId === "tpl-formulario-liberacao" && registro.alunoId === "usr-maria",
    )!;
    documento.situacao = "em_analise";
    expect((await documentosParaParecer("coordenador_curso", usuario("usr-maria"))).itens).toEqual(
      [],
    );
    expect((await documentosParaParecer("coordenador_curso", usuario("usr-bruno"))).itens).toEqual(
      [],
    );
    expect(
      (await documentosParaParecer("coordenador_curso", usuario("usr-carla"))).itens.map(
        (registro) => registro.id,
      ),
    ).toContain(documento.id);
  });
  it("aceita RG e telefone opcionais no perfil e bloqueia mutação de cadastro pendente", async () => {
    const aluno = usuario("usr-maria");
    expect(
      (await atualizarDadosPessoais(aluno, { ...aluno.dadosPessoais!, rg: "", telefone: "" })).ok,
    ).toBe(true);
    const pendente = usuario("usr-paula");
    const antes = structuredClone(pendente.dadosPessoais);
    expect(
      (
        await atualizarDadosPessoais(pendente, {
          ...pendente.dadosPessoais!,
          nomeCompleto: "Nome alterado",
        })
      ).ok,
    ).toBe(false);
    expect(pendente.dadosPessoais).toEqual(antes);
  });

  it("valida contato também no cadastro público do servidor", async () => {
    const previa = await validarEtapaUm({
      matricula: "2026000500",
      email: "contato.invalido@aluno.ifrj.edu.br",
      senha: "selic123",
      confirmacao: "selic123",
    });
    if (!previa.ok) throw new Error("Prévia válida esperada.");
    const resultado = await concluirCadastro(previa.previa.id, {
      ...usuario("usr-maria").dadosPessoais!,
      celular: "123",
    });
    expect(resultado.ok).toBe(false);
    expect(
      obterEstado().usuarios.some(
        (registro) => registro.email === "contato.invalido@aluno.ifrj.edu.br",
      ),
    ).toBe(false);
  });
  it("recusa acesso cruzado de aluno e coordenador de outro curso", async () => {
    await expect(exigirAcessoEstagio(usuario("usr-joao"), "est-maria-tecnoweb")).rejects.toThrow(
      /não disponível/,
    );
    await expect(exigirAcessoEstagio(usuario("usr-bruno"), "est-maria-tecnoweb")).rejects.toThrow(
      /não disponível/,
    );
    await expect(
      exigirAcessoEstagio(usuario("usr-carla"), "est-maria-tecnoweb"),
    ).resolves.toMatchObject({ alunoId: "usr-maria" });
    const documento = obterEstado().documentos.find(
      (registro) => registro.alunoId === "usr-maria",
    )!;
    expect(await podeConsultarDocumento(usuario("usr-joao"), documento)).toBe(false);
    expect(await podeConsultarDocumento(usuario("usr-ana"), documento)).toBe(true);
  });

  it("não aplica edição de estágio com período inválido", async () => {
    const original = structuredClone(
      obterEstado().estagios.find((registro) => registro.id === "est-maria-tecnoweb"),
    );
    await expect(
      editarEstagio("est-maria-tecnoweb", { dataFim: "2026-01-01" }, "usr-maria"),
    ).rejects.toThrow();
    expect(obterEstado().estagios.find((registro) => registro.id === "est-maria-tecnoweb")).toEqual(
      original,
    );
  });

  it("restringe fila e decisão ao curso do coordenador", async () => {
    const outra = structuredClone(
      obterEstado().solicitacoes.find((registro) => registro.situacao === "pendente")!,
    );
    outra.id = "sol-outro-curso";
    outra.dadosPessoais.cursoId = "curso-eletro";
    obterEstado().solicitacoes.push(outra);
    expect(
      (await listarSolicitacoes({}, usuario("usr-carla"))).itens.map((registro) => registro.id),
    ).not.toContain(outra.id);
    await expect(decidirSolicitacao(outra.id, "autorizado", "usr-carla")).rejects.toThrow(
      /não disponível/,
    );
    expect(outra.situacao).toBe("pendente");
  });
});
