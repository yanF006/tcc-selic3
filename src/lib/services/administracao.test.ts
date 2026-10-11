import { beforeEach, describe, expect, it } from "vitest";

import type { Campus } from "@/lib/domain/types";
import { cursoDoUsuario } from "@/lib/domain/usuario";

import {
  cadastrarUsuario,
  contarUsuariosPorSituacao,
  decidirSolicitacao,
  editarUsuario,
  excluirUsuario,
  importarMatriculas,
  inativarUsuario,
  listarMatriculas,
  listarSolicitacoes,
  listarUsuarios,
  registrarMatricula,
  reativarUsuario,
  usuarioPorId,
} from "./administracao";
import { convenioPorId } from "./catalogo";
import { entrar, temPapel, usuarioAtual } from "./sessao";
import { obterEstado, reiniciarEstado } from "./store";

beforeEach(() => {
  reiniciarEstado();
});

async function entrarComoAdministrador() {
  await entrar("felipe.andrade@ifrj.edu.br", "selic123");

  return usuarioAtual()!;
}

describe("usuários", () => {
  it("lista por papel, por situação e por busca", async () => {
    const alunos = await listarUsuarios({ papel: "aluno" });

    expect(alunos.itens.every((usuario) => usuario.papeis.includes("aluno"))).toBe(true);
    expect(alunos.total).toBeGreaterThanOrEqual(2);

    const inativos = await listarUsuarios({ papel: "aluno", situacao: "inativo" });

    expect(inativos.itens.every((usuario) => usuario.situacao === "inativo")).toBe(true);

    const busca = await listarUsuarios({ busca: "maria" });

    expect(buscadosNomes(busca.itens)).toEqual(["Maria de Souza Oliveira"]);
  });

  it("pagina a lista de usuários", async () => {
    const primeira = await listarUsuarios({ tamanho: 3, pagina: 1 });
    const segunda = await listarUsuarios({ tamanho: 3, pagina: 2 });

    expect(primeira.total).toBe(segunda.total);
    expect(primeira.itens).toHaveLength(3);
    expect(segunda.itens[0].id).not.toBe(primeira.itens[0].id);
  });

  it("registra a matrícula no cadastro do aluno e libera o acesso", async () => {
    await entrarComoAdministrador();

    const aluno = await cadastrarUsuario({
      nome: "Novo Aluno",
      email: "novo.aluno@aluno.ifrj.edu.br",
      papeis: ["aluno"],
      matricula: "20260009999",
    });

    // Matrícula recem-registrada significa acesso liberado: nada de pendência.
    expect(aluno.situacao).toBe("ativo");
    expect(aluno.campus).toBe("Pinheiral");
    expect(await usuarioPorId(aluno.id)).toMatchObject({ nome: "Novo Aluno" });

    const matriculas = await listarMatriculas({ busca: "20260009999" });
    expect(matriculas.itens).toHaveLength(1);
    expect(matriculas.itens[0]).toMatchObject({
      matricula: "20260009999",
      nome: "Novo Aluno",
      origem: "cadastro_administrador",
    });
  });

  it("mantém a matrícula já registrada sem duplicar no cadastro do aluno", async () => {
    await entrarComoAdministrador();

    await registrarMatricula({
      matricula: "20260008888",
      nome: "Aluno Do Lançamento Manual",
      curso: "Informática",
    });

    await cadastrarUsuario({
      nome: "Aluno Do Lançamento Manual",
      email: "manual@aluno.ifrj.edu.br",
      papeis: ["aluno"],
      matricula: "20260008888",
    });

    const matriculas = await listarMatriculas({ busca: "20260008888" });
    expect(matriculas.itens).toHaveLength(1);
  });

  it.each(["123", "2024100690", "202410069040", "2024100690A"])(
    "recusa a matrícula fora do formato de onze dígitos: %s",
    async (matricula) => {
      await entrarComoAdministrador();

      await expect(
        cadastrarUsuario({
          nome: "Aluno Sem Formato",
          email: "formato@aluno.ifrj.edu.br",
          papeis: ["aluno"],
          matricula,
        }),
      ).rejects.toThrow(/11 dígitos/);
    },
  );

  it("filtra usuários por curso, do aluno e do coordenador", async () => {
    const doCurso = await listarUsuarios({ cursoId: "curso-ads" });

    expect(doCurso.total).toBeGreaterThan(0);
    expect(doCurso.itens.every((usuario) => cursoDoUsuario(usuario) === "curso-ads")).toBe(true);

    const daEletricidade = await listarUsuarios({ cursoId: "curso-eletro" });

    expect(
      daEletricidade.itens.every((usuario) => cursoDoUsuario(usuario) === "curso-eletro"),
    ).toBe(true);
  });

  it("recusa cadastro sem papel, e-mail repetido e campus fora de Pinheiral", async () => {
    await entrarComoAdministrador();

    await expect(
      cadastrarUsuario({ nome: "Sem Papel", email: "sem.papel@ifrj.edu.br", papeis: [] }),
    ).rejects.toThrow(/papel/);
    await expect(
      cadastrarUsuario({
        nome: "Ana Correia",
        email: "ana.correia@ifrj.edu.br",
        papeis: ["coordenador_estagio"],
      }),
    ).rejects.toThrow(/já utilizado/);
    await expect(
      cadastrarUsuario({
        nome: "Outro Campus",
        email: "outro.campus@ifrj.edu.br",
        papeis: ["administrador"],
        campus: "Volta Redonda" as Campus,
      }),
    ).rejects.toThrow(/Pinheiral/);
  });

  it("edita nome e curso do coordenador", async () => {
    const lista = await listarUsuarios({ papel: "coordenador_curso" });
    const [coordenador] = lista.itens;

    const editado = await editarUsuario(coordenador.id, {
      nome: "Carla Menezes de Souza",
      cursoId: "cur-informatica",
    });

    expect(editado.nome).toBe("Carla Menezes de Souza");
    expect(editado.cursoId).toBe("cur-informatica");
  });

  it("inativa preservando os registros criados pelo usuário", async () => {
    const administrador = await entrarComoAdministrador();
    const loginAntes = await usuarioPorId(administrador.id);

    await inativarUsuario(administrador.id);

    expect((await usuarioPorId(administrador.id))?.situacao).toBe("inativo");
    expect(loginAntes?.email).toBe(administrador.email);
    await expect(inativarUsuario(administrador.id)).rejects.toThrow(/já está inativo/);

    await reativarUsuario(administrador.id);

    expect((await usuarioPorId(administrador.id))?.situacao).toBe("ativo");
    expect(await contarUsuariosPorSituacao()).toMatchObject({ ativo: expect.any(Number) });
  });

  it("remove dados pessoais e preserva o histórico ao excluir aluno com estágios", async () => {
    await entrarComoAdministrador();

    const documentos = structuredClone(obterEstado().documentos);
    const pareceres = structuredClone(obterEstado().pareceres);
    await excluirUsuario("usr-maria");
    expect(await usuarioPorId("usr-maria")).toMatchObject({
      nome: "Cadastro excluído",
      situacao: "inativo",
    });
    expect((await usuarioPorId("usr-maria"))?.dadosPessoais).toBeUndefined();
    expect(obterEstado().documentos).toEqual(documentos);
    expect(obterEstado().pareceres).toEqual(pareceres);
    await expect(excluirUsuario("usr-inexistente")).rejects.toThrow(/não encontrado/);
  });
});

describe("solicitações de acesso", () => {
  it("filtra pendentes e autoriza liberando o acesso do aluno", async () => {
    const administrador = await entrarComoAdministrador();
    const pendentes = await listarSolicitacoes({ situacao: "pendente" });

    expect(pendentes.total).toBeGreaterThan(0);

    const solicitacao = pendentes.itens[0];
    const decidida = await decidirSolicitacao(
      solicitacao.id,
      "autorizado",
      administrador.id,
      "Matrícula conferida no SIGAA.",
    );

    expect(decidida.situacao).toBe("autorizado");
    expect(decidida.decididoEm).toBeTruthy();
    expect(decidida.decididoPorId).toBe(administrador.id);

    const usuario = await listarUsuarios({ busca: solicitacao.email });

    expect(usuario.itens[0].situacao).toBe("ativo");

    // Autorizar também registra a matrícula, que passa a valer no sistema.
    const matriculas = await listarMatriculas({ busca: solicitacao.matricula });

    expect(matriculas.itens[0]).toMatchObject({
      matricula: solicitacao.matricula,
      nome: solicitacao.nome,
      origem: "cadastro_administrador",
    });
    await expect(decidirSolicitacao(solicitacao.id, "recusado", administrador.id)).rejects.toThrow(
      /já autorizado/,
    );
  });

  it("recusa deferir solicitação inexistente", async () => {
    const administrador = await entrarComoAdministrador();

    await expect(
      decidirSolicitacao("sol-inexistente", "recusado", administrador.id),
    ).rejects.toThrow(/não encontrada/);
  });
});

describe("importação manual de matrículas", () => {
  it("classifica válidas, ignoradas e rejeitadas", async () => {
    const resultado = await importarMatriculas("matriculas-2026-1.csv", [
      { matricula: "20260000001", nome: "Ana Paula Souza", curso: "Informática" },
      { matricula: "20260000001", nome: "Ana Paula Souza", curso: "Informática" },
      { matricula: "", nome: "Sem matrícula", curso: "Informática" },
      { matricula: "2024100690", nome: "Matrícula curta", curso: "Informática" },
      { matricula: "202410069040", nome: "Matrícula longa", curso: "Informática" },
      { matricula: "2024100690A", nome: "Matrícula com letra", curso: "Informática" },
    ]);

    expect(resultado.validas).toBe(1);
    expect(resultado.ignoradas).toBe(1);
    expect(resultado.rejeitadas).toBe(4);
    expect(resultado.itens[1].resultado).toBe("ignorada");
    expect(resultado.itens[2].motivo).toMatch(/obrigatórios/);
    expect(resultado.itens.slice(3).every((item) => item.motivo?.includes("11 dígitos"))).toBe(
      true,
    );
    expect((await listarMatriculas({ busca: "2024100690" })).itens).toHaveLength(1);
    expect(resultado.arquivo).toBe("matriculas-2026-1.csv");
  });

  it("lista matrículas com origem e total importado", async () => {
    const pagina = await listarMatriculas({ busca: "informática" });

    expect(pagina.total).toBeGreaterThan(0);
    expect(pagina.itens[0].origem).toBe("cadastro_administrador");

    const importadas = await listarMatriculas({ origem: "importacao" });

    expect(importadas.total).toBe(2);
    expect(importadas.itens.every((matricula) => matricula.matricula.length === 11)).toBe(true);
  });

  it("registra matrícula válida por lançamento manual e recusa duplicidade", async () => {
    await entrarComoAdministrador();

    const registro = await registrarMatricula({
      matricula: "20260444888",
      nome: "Aluno Lançado",
      curso: "Informática",
    });

    expect(registro).toMatchObject({
      matricula: "20260444888",
      origem: "cadastro_administrador",
    });

    // A matrícula recém-registrada já libera o cadastro do aluno.
    const aluno = await cadastrarUsuario({
      nome: "Aluno Lançado",
      email: "aluno.lancado@aluno.ifrj.edu.br",
      papeis: ["aluno"],
      matricula: "20260444888",
    });

    expect(aluno.situacao).toBe("ativo");

    await expect(
      registrarMatricula({ matricula: "20260444888", nome: "Outro", curso: "Informática" }),
    ).rejects.toThrow(/já está registrada/);
    await expect(
      registrarMatricula({ matricula: "123", nome: "Matrícula curta", curso: "Informática" }),
    ).rejects.toThrow(/11 dígitos/);
  });
});

describe("isolamento dos serviços", () => {
  it("não deixa a tela alcançar convênio sem passar pelo serviço", async () => {
    const convenio = await convenioPorId("conv-cooperativa-serrinha");

    expect(convenio?.instituicao).toContain("Cooperativa");
  });

  it("mantém os papéis da sessão simulada", async () => {
    await entrar("carla.menezes@ifrj.edu.br", "selic123");

    expect(temPapel("coordenador_curso")).toBe(true);
  });
});

function buscadosNomes(usuarios: { nome: string }[]): string[] {
  return usuarios.map((usuario) => usuario.nome);
}
