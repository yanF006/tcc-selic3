import { beforeEach, describe, expect, it } from "vitest";

import { concluirCadastro, limparPrevias, validarEtapaUm } from "./cadastro";
import { listarSolicitacoes, usuarioPorId } from "./administracao";
import { reiniciarEstado } from "./store";

/**
 * Cadastro público em duas etapas (5.2 a 5.5): confirmação de senha, e-mail
 * único sem revelar a conta, matrícula importada e cadastro pendente.
 */

const senha = "selic123";

const etapaDois = {
  nomeCompleto: "Rafaela Nogueira",
  cpf: "111.444.777-35",
  rg: "12.345.678-9",
  dataNascimento: "2005-03-14",
  telefone: "2130000000",
  celular: "21900000000",
  endereco: {
    cep: "23900000",
    logradouro: "Rua das Acácias",
    numero: "120",
    bairro: "Centro",
    cidade: "Pinheiral",
    estado: "RJ",
  },
  cursoId: "curso-ads",
  turmaId: "turma-ads-2026-1a",
  periodoId: "periodo-2026-1",
};

describe("cadastro público", () => {
  beforeEach(() => {
    reiniciarEstado();
    limparPrevias();
  });

  it("recusa confirmação de senha divergente no campo", async () => {
    const resultado = await validarEtapaUm({
      matricula: "2023100457",
      email: "nova@aluno.ifrj.edu.br",
      senha,
      confirmacao: "outra",
    });

    expect(resultado).toEqual({
      ok: false,
      campo: "confirmacao",
      erro: expect.stringContaining("confirmação"),
    });
  });

  it("recusa e-mail já cadastrado sem dizer que a conta existe", async () => {
    const resultado = await validarEtapaUm({
      matricula: "2023100457",
      email: "maria.souza@aluno.ifrj.edu.br",
      senha,
      confirmacao: senha,
    });

    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({ campo: "email" });
    expect(resultado.ok === false && resultado.erro).not.toMatch(/já cadastrado|existe/i);
  });

  it("usa a mesma mensagem para e-mail livre com senha curta", async () => {
    const comSenhaCurta = await validarEtapaUm({
      matricula: "2023100457",
      email: "livre@aluno.ifrj.edu.br",
      senha: "123",
      confirmacao: "123",
    });
    const comEmailEmUso = await validarEtapaUm({
      matricula: "2023100457",
      email: "maria.souza@aluno.ifrj.edu.br",
      senha,
      confirmacao: senha,
    });

    expect(comSenhaCurta.ok).toBe(false);
    expect(comEmailEmUso.ok).toBe(false);
    expect(comSenhaCurta.ok === false && comSenhaCurta.erro).toBe(
      comEmailEmUso.ok === false ? comEmailEmUso.erro : "",
    );
  });

  it("confirma matrícula importada e libera o acesso", async () => {
    const primeira = await validarEtapaUm({
      matricula: "2023100788",
      email: "novo.joao@aluno.ifrj.edu.br",
      senha,
      confirmacao: senha,
    });

    expect(primeira.ok).toBe(true);
    expect(primeira.ok && primeira.previa.matriculaNaoRegistrada).toBe(false);
    expect(primeira.ok && primeira.previa.nome).toBe("João Pedro Lima");

    const conclusao = await concluirCadastro(primeira.ok ? primeira.previa.id : "", etapaDois);

    expect(conclusao).toMatchObject({ ok: true, situacao: "ativo" });

    const usuario = await usuarioPorId(conclusao.ok ? conclusao.usuarioId : "");

    expect(usuario?.papeis).toEqual(["aluno"]);
    expect(usuario?.matricula).toBe("2023100788");
    expect(usuario?.dadosPessoais?.turmaId).toBe("turma-ads-2026-1a");
  });

  it("mantém cadastro pendente e cria a solicitação quando a matrícula não consta", async () => {
    const primeira = await validarEtapaUm({
      matricula: "2023777000",
      email: "pendente@aluno.ifrj.edu.br",
      senha,
      confirmacao: senha,
    });

    expect(primeira.ok && primeira.previa.matriculaNaoRegistrada).toBe(true);
    expect(primeira.ok && primeira.mensagem).toMatch(/pendente/);

    const conclusao = await concluirCadastro(primeira.ok ? primeira.previa.id : "", etapaDois);

    expect(conclusao).toMatchObject({ ok: true, situacao: "pendente" });

    const pendentes = await listarSolicitacoes({ situacao: "pendente", busca: "pendente@" });

    expect(pendentes.total).toBe(1);
    expect(pendentes.itens[0].matricula).toBe("2023777000");
  });

  it("recusa conclusão sem selects dependentes coerentes", async () => {
    const primeira = await validarEtapaUm({
      matricula: "2023100457",
      email: "coerente@aluno.ifrj.edu.br",
      senha,
      confirmacao: senha,
    });

    const conclusao = await concluirCadastro(primeira.ok ? primeira.previa.id : "", {
      ...etapaDois,
      turmaId: "turma-eletro-2026-1a",
    });

    expect(conclusao.ok).toBe(false);
    expect(conclusao.ok === false && conclusao.erro).toMatch(/turma/i);
  });

  it("recusa conclusão com prévia inexistente", async () => {
    const conclusao = await concluirCadastro("cad-inexistente", etapaDois);

    expect(conclusao).toMatchObject({ ok: false, campo: "previa" });
  });

  it("recusa CPF inválido na segunda etapa", async () => {
    const primeira = await validarEtapaUm({
      matricula: "2023100457",
      email: "cpf@aluno.ifrj.edu.br",
      senha,
      confirmacao: senha,
    });

    const conclusao = await concluirCadastro(primeira.ok ? primeira.previa.id : "", {
      ...etapaDois,
      cpf: "111.111.111-11",
    });

    expect(conclusao.ok).toBe(false);
  });
});
