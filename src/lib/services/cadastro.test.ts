import { beforeEach, describe, expect, it } from "vitest";

import { concluirCadastro, validarEtapaUm } from "./cadastro";
import { listarSolicitacoes, usuarioPorId } from "./administracao";
import { obterEstado, reiniciarEstado } from "./store";

/**
 * Cadastro público em duas etapas visuais (5.1 a 5.5): confirmação de senha,
 * e-mail/matrícula únicos sem revelar a conta, consulta antecipada sem reserva,
 * matrícula importada e cadastro pendente.
 */

const senha = "selic123";

const etapaUm = {
  matricula: "20230444555",
  email: "nova@aluno.ifrj.edu.br",
  senha,
  confirmacao: senha,
};

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
  });

  it.each(["2024100690", "202410069040", "2024100690A"])(
    "recusa matrícula fora do formato de onze dígitos: %s",
    async (matricula) => {
      const resultado = await validarEtapaUm({ ...etapaUm, matricula });

      expect(resultado).toMatchObject({ ok: false, campo: "matricula" });
    },
  );

  it("recusa confirmação de senha divergente no campo", async () => {
    const resultado = await validarEtapaUm({ ...etapaUm, confirmacao: "outra" });

    expect(resultado).toEqual({
      ok: false,
      campo: "confirmacao",
      erro: expect.stringContaining("confirmação"),
    });
  });

  it("recusa e-mail já cadastrado sem dizer que a conta existe", async () => {
    const resultado = await validarEtapaUm({
      ...etapaUm,
      email: "maria.souza@aluno.ifrj.edu.br",
    });

    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({ campo: "email" });
    expect(resultado.ok === false && resultado.erro).not.toMatch(/já cadastrado|existe/i);
  });

  it("usa a mesma mensagem para e-mail livre com senha curta", async () => {
    const comSenhaCurta = await validarEtapaUm({ ...etapaUm, senha: "123", confirmacao: "123" });
    const comEmailEmUso = await validarEtapaUm({
      ...etapaUm,
      email: "maria.souza@aluno.ifrj.edu.br",
    });

    expect(comSenhaCurta.ok).toBe(false);
    expect(comEmailEmUso.ok).toBe(false);
    expect(comSenhaCurta.ok === false && comSenhaCurta.erro).toBe(
      comEmailEmUso.ok === false ? comEmailEmUso.erro : "",
    );
  });

  it("consulta a primeira etapa sem criar conta, credencial ou solicitação", async () => {
    const antes = {
      usuarios: obterEstado().usuarios.length,
      solicitacoes: obterEstado().solicitacoes.length,
    };

    const primeira = await validarEtapaUm({ ...etapaUm, matricula: "20231000555" });
    const segunda = await validarEtapaUm({ ...etapaUm, matricula: "20231000555" });

    expect(primeira.ok).toBe(true);
    expect(segunda.ok).toBe(true);
    expect(obterEstado().usuarios.length).toBe(antes.usuarios);
    expect(obterEstado().solicitacoes.length).toBe(antes.solicitacoes);
  });

  it("confirma matrícula importada e libera o acesso", async () => {
    const primeira = await validarEtapaUm({ ...etapaUm, matricula: "20231000555" });

    expect(primeira.ok).toBe(true);
    expect(primeira.ok && primeira.matriculaNaoRegistrada).toBe(false);
    expect(primeira.ok && primeira.nome).toBe("Aluno Sem Conta");

    const conclusao = await concluirCadastro({
      ...etapaUm,
      matricula: "20231000555",
      email: "novo.joao@aluno.ifrj.edu.br",
      ...etapaDois,
    });

    expect(conclusao).toMatchObject({ ok: true, situacao: "ativo" });

    const usuario = await usuarioPorId(conclusao.ok ? conclusao.usuarioId : "");

    expect(usuario?.papel).toBe("aluno");
    expect(usuario?.matricula).toBe("20231000555");
    expect(usuario?.dadosPessoais?.turmaId).toBe("turma-ads-2026-1a");
  });

  it("ignora cargo e comissão enviados pelo cliente no cadastro público", async () => {
    const adulterado = {
      ...etapaUm,
      email: "cargo.adulterado@teste.local",
      ...etapaDois,
      papel: "administrador",
      papeis: ["administrador", "coordenador_estagio"],
      membroComissaoEstagio: true,
    };
    const conclusao = await concluirCadastro(adulterado);

    expect(conclusao.ok).toBe(true);
    const usuario = await usuarioPorId(conclusao.ok ? conclusao.usuarioId : "");

    expect(usuario?.papel).toBe("aluno");
    expect(usuario?.membroComissaoEstagio).toBe(false);
  });

  it("mantém cadastro pendente e cria a solicitação quando a matrícula não consta", async () => {
    const primeira = await validarEtapaUm({ ...etapaUm, matricula: "20230777000" });

    expect(primeira.ok && primeira.matriculaNaoRegistrada).toBe(true);
    expect(primeira.ok && primeira.mensagem).toMatch(/pendente/);

    const conclusao = await concluirCadastro({
      ...etapaUm,
      matricula: "20230777000",
      email: "pendente@aluno.ifrj.edu.br",
      ...etapaDois,
    });

    expect(conclusao).toMatchObject({ ok: true, situacao: "pendente" });

    const pendentes = await listarSolicitacoes({ situacao: "pendente", busca: "pendente@" });

    expect(pendentes.total).toBe(1);
    expect(pendentes.itens[0].matricula).toBe("20230777000");
  });

  it("recusa conclusão com selects dependentes incoerentes", async () => {
    const conclusao = await concluirCadastro({
      ...etapaUm,
      email: "coerente@aluno.ifrj.edu.br",
      ...etapaDois,
      turmaId: "turma-eletro-2026-1a",
    });

    expect(conclusao.ok).toBe(false);
    expect(conclusao.ok === false && conclusao.erro).toMatch(/turma|curso/i);
  });

  it("recusa curso, turma e período que não estão cadastrados", async () => {
    const cursoInexistente = await concluirCadastro({
      ...etapaUm,
      email: "selecao@aluno.ifrj.edu.br",
      ...etapaDois,
      cursoId: "curso-inexistente",
    });

    expect(cursoInexistente).toMatchObject({ ok: false, campo: "dados" });

    const turmaInexistente = await concluirCadastro({
      ...etapaUm,
      email: "selecao2@aluno.ifrj.edu.br",
      ...etapaDois,
      turmaId: "turma-inexistente",
    });

    expect(turmaInexistente.ok).toBe(false);

    const periodoInexistente = await concluirCadastro({
      ...etapaUm,
      email: "selecao3@aluno.ifrj.edu.br",
      ...etapaDois,
      periodoId: "periodo-2099-1",
    });

    expect(periodoInexistente.ok).toBe(false);
  });

  it("revalida o formulário completo mesmo sem consulta anterior", async () => {
    const cpfInvalido = await concluirCadastro({
      ...etapaUm,
      email: "direto@aluno.ifrj.edu.br",
      ...etapaDois,
      cpf: "111.111.111-11",
    });

    expect(cpfInvalido.ok).toBe(false);
    expect(obterEstado().usuarios.some((usuario) => usuario.email === "direto@aluno.ifrj.edu.br")).toBe(
      false,
    );

    const matriculaOcupada = await concluirCadastro({
      ...etapaUm,
      matricula: "20231000788",
      email: "livre@aluno.ifrj.edu.br",
      ...etapaDois,
    });

    expect(matriculaOcupada.ok).toBe(false);
  });

  it("duas consultas à matrícula livre não reservam e a repetição não duplica", async () => {
    const primeira = await validarEtapaUm({ ...etapaUm, email: "repetida@aluno.ifrj.edu.br" });
    const segunda = await validarEtapaUm({ ...etapaUm, email: "repetida@aluno.ifrj.edu.br" });

    expect(primeira.ok && segunda.ok).toBe(true);

    const dados = { ...etapaUm, email: "repetida@aluno.ifrj.edu.br", ...etapaDois };
    const conclusao = await concluirCadastro(dados);
    const repetida = await concluirCadastro(dados);

    expect(conclusao.ok).toBe(true);
    expect(repetida.ok).toBe(false);
    expect(
      obterEstado().usuarios.filter((usuario) => usuario.email === "repetida@aluno.ifrj.edu.br"),
    ).toHaveLength(1);
    expect(obterEstado().solicitacoes.filter((item) => item.email === "repetida@aluno.ifrj.edu.br")).toHaveLength(
      1,
    );
  });
});
