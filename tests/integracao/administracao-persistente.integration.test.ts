import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import type { Usuario } from "@/lib/domain/types";
import {
  cadastrarUsuario,
  editarUsuario,
  excluirUsuario,
  listarSolicitacoes,
} from "@/lib/services/administracao";
import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";
import { criarExecutorDdl } from "./ddl";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base = process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: configuracao.host,
    port: configuracao.porta,
    user: configuracao.usuario,
    password: configuracao.senha,
    database: configuracao.banco,
    connectionLimit: 2,
    ssl: { rejectUnauthorized: false },
  }),
});

const prefixo = `adm-${crypto.randomUUID().slice(0, 8)}`;
const emails: string[] = [];
const matriculas: string[] = [];
const cursos: string[] = [];
const usuarios: string[] = [];

function email(rotulo: string) {
  const valor = `${prefixo}-${rotulo}@teste.local`;
  emails.push(valor);
  return valor;
}

function matricula(sufixo: string) {
  const valor = `2026${sufixo.padStart(7, "0")}`;
  matriculas.push(valor);
  return valor;
}

const executarDdl = criarExecutorDdl(configuracao);

async function criarPendente(opcoes: {
  email: string;
  matricula: string;
  cursoId: string;
  criadoEm: Date;
  solicitacaoId?: string;
}) {
  const usuarioId = `usr-${crypto.randomUUID()}`;
  const solicitacaoId = opcoes.solicitacaoId ?? `sol-${crypto.randomUUID()}`;

  await prisma.usuario.create({
    data: {
      id: usuarioId,
      nome: `Pendente ${opcoes.matricula}`,
      email: opcoes.email,
      matricula: opcoes.matricula,
      papel: "aluno",
      situacao: "pendente",
      dadosPessoais: {
        nomeCompleto: `Pendente ${opcoes.matricula}`,
        cpf: "12345678901",
        rg: "1234567",
        dataNascimento: "2000-01-01",
        email: opcoes.email,
        telefone: "24999990000",
        celular: "24999990001",
        endereco: {
          cep: "27100000",
          logradouro: "Rua A",
          numero: "1",
          bairro: "Centro",
          cidade: "Pinheiral",
          estado: "RJ",
        },
        cursoId: opcoes.cursoId,
        turmaId: "turma-1",
        periodoId: "periodo-1",
      },
    },
  });
  await prisma.solicitacaoAcesso.create({
    data: {
      id: solicitacaoId,
      usuarioId,
      cursoId: opcoes.cursoId,
      situacao: "pendente",
      motivo: "Matrícula não está registrada no sistema.",
      criadoEm: opcoes.criadoEm,
    },
  });

  usuarios.push(usuarioId);
  return { usuarioId, solicitacaoId };
}

beforeAll(async () => {
  vi.stubEnv("SELIC_PERSISTENCIA", "persistente");
  vi.stubEnv("DATABASE_URL", configuracao.url);
  vi.stubEnv("SELIC_DB_CA_CERT", ca);
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("BETTER_AUTH_SECRET", "segredo-exclusivo-do-cadastro-administrativo");

  // Evita que a hidratação semeie fixtures com cursos que este schema isolado
  // não possui; os testes abaixo não dependem das fixtures.
  const ancora = await prisma.usuario.create({
    data: {
      id: `${prefixo}-ancora`,
      nome: "Conta Âncora",
      email: email("ancora"),
      papel: "administrador",
      situacao: "ativo",
    },
  });
  usuarios.push(ancora.id);
});

afterAll(async () => {
  if (usuarios.length > 0) {
    await prisma.authVerification.deleteMany({ where: { value: { in: usuarios } } });
    await prisma.solicitacaoAcesso.deleteMany({ where: { usuarioId: { in: usuarios } } });
    await prisma.dadosPessoaisAluno.deleteMany({ where: { usuarioId: { in: usuarios } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.authAccount.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
  }
  await prisma.usuario.deleteMany({ where: { email: { in: emails } } });
  if (matriculas.length > 0) {
    await prisma.matriculaImportada.deleteMany({ where: { matricula: { in: matriculas } } });
  }
  if (cursos.length > 0) {
    await prisma.curso.deleteMany({ where: { id: { in: cursos } } });
  }
  await executarDdl("DROP TRIGGER IF EXISTS probe_falha_usuario");
  await prisma.$disconnect();
  vi.unstubAllEnvs();
});

describe("cadastro e edição administrativos persistentes", () => {
  it("cria conta ativa, registra a matrícula e pede a primeira senha sem credencial", async () => {
    const endereco = email("aluno");
    const numero = matricula("37001");

    const criado = await cadastrarUsuario({
      nome: "Aluno Administrativo",
      email: endereco,
      papel: "aluno",
      matricula: numero,
    });
    usuarios.push(criado.id);

    const persistido = await prisma.usuario.findUnique({
      where: { id: criado.id },
      include: { authAccounts: true },
    });

    expect(criado).toMatchObject({ situacao: "ativo", matricula: numero, papel: "aluno" });
    expect(persistido?.authAccounts).toHaveLength(0);
    expect(
      await prisma.matriculaImportada.findUnique({ where: { matricula: numero } }),
    ).toMatchObject({ origem: "cadastro_administrador", nome: "Aluno Administrativo" });
    expect(await prisma.authVerification.count({ where: { value: criado.id } })).toBeGreaterThan(0);
  });

  it("desfaz a matrícula nova quando a criação da conta falha", async () => {
    const endereco = email("falha");
    const numero = matricula("37002");
    const existente = await prisma.usuario.create({
      data: {
        id: `${prefixo}-existente`,
        nome: "Conta Existente",
        email: email("existente"),
        papel: "administrador",
        situacao: "ativo",
      },
    });
    usuarios.push(existente.id);

    await executarDdl(`
      CREATE TRIGGER probe_falha_usuario BEFORE INSERT ON usuarios
      FOR EACH ROW
      BEGIN
        IF NEW.email = '${endereco}' THEN
          SET NEW.id = '${existente.id}';
        END IF;
      END
    `);

    try {
      await expect(
        cadastrarUsuario({
          nome: "Aluno com Falha",
          email: endereco,
          papel: "aluno",
          matricula: numero,
        }),
      ).rejects.toMatchObject({ codigo: "registro_duplicado" });
    } finally {
      await executarDdl("DROP TRIGGER IF EXISTS probe_falha_usuario");
    }

    expect(await prisma.usuario.count({ where: { email: endereco } })).toBe(0);
    expect(await prisma.matriculaImportada.count({ where: { matricula: numero } })).toBe(0);
  });

  it("edita a matrícula do aluno na mesma transação e limpa o vínculo ao trocar de cargo", async () => {
    const endereco = email("edicao");
    const original = matricula("37003");
    const novo = matricula("37004");
    const cursoId = `${prefixo}-curso`;
    cursos.push(cursoId);

    await prisma.curso.create({
      data: { id: cursoId, nome: "Curso da Edição", codigo: `${prefixo}-C1` },
    });

    const criado = await cadastrarUsuario({
      nome: "Aluno Editado",
      email: endereco,
      papel: "aluno",
      matricula: original,
    });
    usuarios.push(criado.id);

    const editado = await editarUsuario(criado.id, { matricula: novo });

    expect(editado.matricula).toBe(novo);
    expect(await prisma.usuario.findUnique({ where: { id: criado.id } })).toMatchObject({
      matricula: novo,
    });
    expect(await prisma.matriculaImportada.findUnique({ where: { matricula: novo } })).not.toBeNull();

    const coordenador = await editarUsuario(criado.id, {
      papel: "coordenador_curso",
      cursoId,
    });

    expect(coordenador.papel).toBe("coordenador_curso");
    expect(coordenador.cursoId).toBe(cursoId);
    expect(coordenador.matricula).toBeUndefined();
    expect(
      (await prisma.usuario.findUnique({ where: { id: criado.id } }))?.matricula,
    ).toBeNull();
  });

  it("lista pendências persistentes por recorte, busca, paginação e desempate criação/ID", async () => {
    const cursoA = `${prefixo}-sol-a`;
    const cursoB = `${prefixo}-sol-b`;
    cursos.push(cursoA, cursoB);

    await prisma.curso.createMany({
      data: [
        { id: cursoA, nome: "Curso A", codigo: `${prefixo}-SA` },
        { id: cursoB, nome: "Curso B", codigo: `${prefixo}-SB` },
      ],
    });

    const a1 = await criarPendente({
      email: email("pendente-a1"),
      matricula: matricula("38001"),
      cursoId: cursoA,
      criadoEm: new Date("2026-11-10T09:00:00.000Z"),
      solicitacaoId: `${prefixo}-sol-a-1`,
    });
    const a2 = await criarPendente({
      email: email("pendente-a2"),
      matricula: matricula("38002"),
      cursoId: cursoA,
      criadoEm: new Date("2026-11-10T09:00:00.000Z"),
      solicitacaoId: `${prefixo}-sol-a-2`,
    });
    const b1 = await criarPendente({
      email: email("pendente-b1"),
      matricula: matricula("38003"),
      cursoId: cursoB,
      criadoEm: new Date("2026-11-10T10:00:00.000Z"),
      solicitacaoId: `${prefixo}-sol-b-1`,
    });

    const emailProcesso = email("pendente-processo");
    const matriculaProcesso = matricula("38004");
    const script = fileURLToPath(
      new URL("../support/criar-solicitacao-processo.ts", import.meta.url),
    );
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        "--import",
        "tsx",
        script,
        emailProcesso,
        matriculaProcesso,
        cursoA,
        "2026-11-10T08:00:00.000Z",
      ],
      {
        env: {
          ...process.env,
          DATABASE_URL: "",
          TEST_APP_DATABASE_URL: configuracao.url,
        },
      },
    );
    const processo = JSON.parse(stdout) as { usuarioId: string; solicitacaoId: string };
    usuarios.push(processo.usuarioId);

    const admin: Usuario = {
      id: `${prefixo}-admin-lista`,
      nome: "Admin Lista",
      email: email("admin-lista"),
      papel: "administrador",
      situacao: "ativo",
      campus: "Pinheiral",
      criadoEm: new Date().toISOString(),
    };
    const coordenadorA: Usuario = {
      ...admin,
      id: `${prefixo}-coord-a`,
      nome: "Coordenador A",
      email: email("coord-a"),
      papel: "coordenador_curso",
      cursoId: cursoA,
    };
    const coordenadorB: Usuario = {
      ...coordenadorA,
      id: `${prefixo}-coord-b`,
      nome: "Coordenador B",
      email: email("coord-b"),
      cursoId: cursoB,
    };

    const primeira = await listarSolicitacoes({ busca: prefixo, tamanho: 2 }, admin);
    const segunda = await listarSolicitacoes(
      { busca: prefixo, pagina: 2, tamanho: 2 },
      admin,
    );
    const busca = await listarSolicitacoes({ busca: emailProcesso, tamanho: 1 }, admin);
    const recorteA = await listarSolicitacoes({ busca: prefixo }, coordenadorA);
    const recorteB = await listarSolicitacoes({ busca: prefixo }, coordenadorB);

    expect(primeira.total).toBe(4);
    expect(primeira.itens.map((item) => item.id)).toEqual([b1.solicitacaoId, a2.solicitacaoId]);
    expect(segunda.itens.map((item) => item.id)).toEqual([
      a1.solicitacaoId,
      processo.solicitacaoId,
    ]);
    expect(busca.total).toBe(1);
    expect(busca.itens[0]).toMatchObject({
      email: emailProcesso,
      matricula: matriculaProcesso,
      situacao: "pendente",
    });
    expect(recorteA.total).toBe(3);
    expect(recorteA.itens.every((item) => item.dadosPessoais.cursoId === cursoA)).toBe(true);
    expect(recorteB.total).toBe(1);
    expect(recorteB.itens[0].id).toBe(b1.solicitacaoId);
  });
});

describe("exclusão administrativa persistente", () => {
  it("apaga conta sem histórico e anonimiza identidade referenciada, removendo dados pessoais e sessões", async () => {
    const semHistorico = await prisma.usuario.create({ data: {
      id: `${prefixo}-sem-historico`, nome: "Sem Histórico", email: email("sem-historico"), papel: "aluno", situacao: "ativo",
    } });
    usuarios.push(semHistorico.id);
    const sessaoSemHistorico = await prisma.authSession.create({ data: { id: `${prefixo}-sessao-sem`, token: `${prefixo}-token-sem`, userId: semHistorico.id, expiresAt: new Date(Date.now() + 60_000) } });
    await excluirUsuario(semHistorico.id);
    expect(await prisma.authSession.findUnique({ where: { id: sessaoSemHistorico.id } })).toBeNull();
    expect(await prisma.usuario.findUnique({ where: { id: semHistorico.id } })).toBeNull();

    const curso = await prisma.curso.create({ data: { id: `${prefixo}-curso-exclusao`, nome: `${prefixo}-curso`, codigo: `${prefixo}-curso` } });
    cursos.push(curso.id);
    const { usuarioId, solicitacaoId } = await criarPendente({
      email: email("com-historico"), matricula: matricula(String(Date.now()).slice(-7)), cursoId: curso.id, criadoEm: new Date(),
    });
    const sessao = await prisma.authSession.create({ data: { id: `${prefixo}-sessao`, token: `${prefixo}-token`, userId: usuarioId, expiresAt: new Date(Date.now() + 60_000) } });
    await excluirUsuario(usuarioId);
    const persistido = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    expect(persistido).toMatchObject({ nome: "Cadastro excluído", situacao: "inativo", matricula: null, dadosPessoais: null });
    expect(persistido?.email).toMatch(/^excluido\./);
    expect(await prisma.dadosPessoaisAluno.count({ where: { usuarioId } })).toBe(0);
    expect(await prisma.authSession.findUnique({ where: { id: sessao.id } })).toBeNull();
    expect(await prisma.solicitacaoAcesso.findUnique({ where: { id: solicitacaoId } })).toMatchObject({ usuarioId, situacao: "pendente" });
  });
});
