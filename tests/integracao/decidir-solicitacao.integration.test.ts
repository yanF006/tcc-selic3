import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/auth/[...all]/route";
import { criarAutenticacaoCadastro } from "@/lib/auth/autenticacao";
import { PrismaClient } from "@/generated/prisma/client";
import type { Usuario } from "@/lib/domain/types";
import {
  decidirSolicitacao,
  inativarUsuario,
  listarSolicitacoes,
  reativarUsuario,
} from "@/lib/services/administracao";

import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";
import { criarExecutorDdl } from "./ddl";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base = process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");
const origem = "http://localhost:3000";
const segredo = "segredo-exclusivo-da-decisao-de-solicitacao";
const senha = "SenhaOriginal123!";

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

const prefixo = `dec-${crypto.randomUUID().slice(0, 8)}`;
const emails: string[] = [];
const matriculas: string[] = [];
const usuarios: string[] = [];
const cursos: string[] = [];
let cursoA = "";
let cursoB = "";
let adminId = "";
let coordAId = "";
let coordBId = "";

function email(rotulo: string) {
  const valor = `${prefixo}-${rotulo}@teste.local`;
  emails.push(valor);
  return valor;
}

let sequenciaMatricula = 0;
const inicioMatricula = Number(BigInt(`0x${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`) % BigInt(900000000));

function matricula() {
  const valor = `87${String(inicioMatricula + ++sequenciaMatricula).padStart(9, "0")}`;
  matriculas.push(valor);
  return valor;
}

const executarDdl = criarExecutorDdl(configuracao);

async function criarPendente(rotulo: string, cursoId: string) {
  const endereco = email(rotulo);
  const numero = matricula();
  let usuarioId = "";
  let solicitacaoId = "";

  await prisma.$transaction(
    async (tx) => {
      const auth = criarAutenticacaoCadastro(tx, { origem, segredo });
      const criado = await auth.api.signUpEmail({
        body: { name: `Pendente ${rotulo}`, email: endereco, password: senha },
      });

      usuarioId = criado.user.id;
      solicitacaoId = `sol-${crypto.randomUUID()}`;

      await tx.usuario.update({
        where: { id: usuarioId },
        data: {
          papel: "aluno",
          situacao: "pendente",
          matricula: numero,
          dadosPessoais: {
            nomeCompleto: `Pendente ${rotulo}`,
            cpf: "12345678901",
            rg: "1234567",
            dataNascimento: "2000-01-01",
            email: endereco,
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
            cursoId,
            turmaId: "turma-1",
            periodoId: "periodo-1",
          },
        },
      });

      await tx.solicitacaoAcesso.create({
        data: {
          id: solicitacaoId,
          usuarioId,
          cursoId,
          situacao: "pendente",
          motivo: "Matrícula não está registrada no sistema.",
        },
      });
    },
    { timeout: 20_000 },
  );

  usuarios.push(usuarioId);
  return { usuarioId, solicitacaoId, email: endereco, matricula: numero };
}

async function login(endereco: string) {
  return POST(
    new Request(`${origem}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origem },
      body: JSON.stringify({ email: endereco, password: senha }),
    }),
  );
}

function cookies(resposta: Response) {
  return resposta.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function consultarEmOutroProcesso(cookie: string) {
  const script = fileURLToPath(new URL("../support/consultar-sessao-processo.ts", import.meta.url));
  const contexto = new URL("../support/contexto-servidor.mjs", import.meta.url).href;
  const { stdout } = await promisify(execFile)(
    process.execPath,
    ["--import", "tsx", "--import", contexto, script],
    {
      env: {
        ...process.env,
        SELIC_COOKIE_TESTE: cookie,
        DATABASE_URL: configuracao.url,
        TEST_APP_DATABASE_URL: configuracao.url,
      },
    },
  );

  return JSON.parse(stdout) as { id: string; papel: string; cursoId?: string } | null;
}

beforeAll(async () => {
  vi.stubEnv("SELIC_PERSISTENCIA", "persistente");
  vi.stubEnv("DATABASE_URL", configuracao.url);
  vi.stubEnv("SELIC_DB_CA_CERT", ca);
  vi.stubEnv("BETTER_AUTH_URL", origem);
  vi.stubEnv("BETTER_AUTH_SECRET", segredo);

  cursoA = `${prefixo}-curso-a`;
  cursoB = `${prefixo}-curso-b`;
  cursos.push(cursoA, cursoB);
  await prisma.curso.createMany({
    data: [
      { id: cursoA, nome: "Curso A", codigo: `${prefixo}-CA` },
      { id: cursoB, nome: "Curso B", codigo: `${prefixo}-CB` },
    ],
  });

  const admin = await prisma.usuario.create({
    data: {
      id: `${prefixo}-admin`,
      nome: "Administrador",
      email: email("admin"),
      papel: "administrador",
      situacao: "ativo",
    },
  });
  const coordA = await prisma.usuario.create({
    data: {
      id: `${prefixo}-coord-a`,
      nome: "Coordenador A",
      email: email("coord-a"),
      papel: "coordenador_curso",
      situacao: "ativo",
      cursoId: cursoA,
    },
  });
  const coordB = await prisma.usuario.create({
    data: {
      id: `${prefixo}-coord-b`,
      nome: "Coordenador B",
      email: email("coord-b"),
      papel: "coordenador_curso",
      situacao: "ativo",
      cursoId: cursoB,
    },
  });

  adminId = admin.id;
  coordAId = coordA.id;
  coordBId = coordB.id;
  usuarios.push(adminId, coordAId, coordBId);
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
  if (matriculas.length > 0) {
    await prisma.matriculaImportada.deleteMany({ where: { matricula: { in: matriculas } } });
  }
  if (cursos.length > 0) {
    await prisma.curso.deleteMany({ where: { id: { in: cursos } } });
  }
  await executarDdl("DROP TRIGGER IF EXISTS probe_falha_decisao");
  await prisma.$disconnect();
  vi.unstubAllEnvs();
});

describe("decisão de solicitação persistente", () => {
  it("autoriza, registra autor/data, ativa a conta existente e preserva a credencial original", async () => {
    const pendente = await criarPendente("autoriza", cursoA);

    const decidida = await decidirSolicitacao(pendente.solicitacaoId, "autorizado", adminId);

    expect(decidida).toMatchObject({
      id: pendente.solicitacaoId,
      situacao: "autorizado",
      decididoPorId: adminId,
    });
    expect(decidida.decididoEm).toBeTruthy();
    expect(
      await prisma.solicitacaoAcesso.findUnique({ where: { id: pendente.solicitacaoId } }),
    ).toMatchObject({ situacao: "autorizado", decididoPorId: adminId });
    expect(await prisma.usuario.findUnique({ where: { id: pendente.usuarioId } })).toMatchObject({
      situacao: "ativo",
    });
    expect(
      await prisma.matriculaImportada.findUnique({ where: { matricula: pendente.matricula } }),
    ).toMatchObject({ origem: "cadastro_administrador" });
    expect(
      await prisma.authAccount.count({
        where: { userId: pendente.usuarioId, providerId: "credential" },
      }),
    ).toBe(1);

    const resposta = await login(pendente.email);
    expect(resposta.status).toBe(200);
    expect((await resposta.json()).user.id).toBe(pendente.usuarioId);
  });

  it("exige motivo na recusa e inativa a conta sem registrar matrícula", async () => {
    const pendente = await criarPendente("recusa", cursoA);

    await expect(
      decidirSolicitacao(pendente.solicitacaoId, "recusado", adminId),
    ).rejects.toMatchObject({ codigo: "motivo_obrigatorio" });

    expect(
      await prisma.solicitacaoAcesso.findUnique({ where: { id: pendente.solicitacaoId } }),
    ).toMatchObject({ situacao: "pendente" });
    expect(await prisma.usuario.findUnique({ where: { id: pendente.usuarioId } })).toMatchObject({
      situacao: "pendente",
    });

    const recusada = await decidirSolicitacao(
      pendente.solicitacaoId,
      "recusado",
      adminId,
      "Documentação não confere.",
    );

    expect(recusada).toMatchObject({
      situacao: "recusado",
      motivo: "Documentação não confere.",
      decididoPorId: adminId,
    });
    expect(await prisma.usuario.findUnique({ where: { id: pendente.usuarioId } })).toMatchObject({
      situacao: "inativo",
    });
    expect(
      await prisma.matriculaImportada.count({ where: { matricula: pendente.matricula } }),
    ).toBe(0);
  });

  it("recusa decisão de coordenador de outro curso e aceita o do curso da solicitação", async () => {
    const pendente = await criarPendente("curso", cursoA);

    await expect(
      decidirSolicitacao(pendente.solicitacaoId, "autorizado", coordBId),
    ).rejects.toMatchObject({ codigo: "acesso_negado" });
    expect(
      await prisma.solicitacaoAcesso.findUnique({ where: { id: pendente.solicitacaoId } }),
    ).toMatchObject({ situacao: "pendente" });

    const decidida = await decidirSolicitacao(pendente.solicitacaoId, "autorizado", coordAId);

    expect(decidida).toMatchObject({ situacao: "autorizado", decididoPorId: coordAId });
  });

  it("tem um único vencedor em decisões concorrentes", async () => {
    const pendente = await criarPendente("concorrente", cursoA);

    const resultados = await Promise.allSettled([
      decidirSolicitacao(pendente.solicitacaoId, "autorizado", adminId),
      decidirSolicitacao(pendente.solicitacaoId, "autorizado", adminId),
    ]);

    expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter((resultado) => resultado.status === "rejected")).toHaveLength(1);
    expect(
      await prisma.solicitacaoAcesso.findUnique({ where: { id: pendente.solicitacaoId } }),
    ).toMatchObject({ situacao: "autorizado" });
    expect(
      await prisma.matriculaImportada.count({ where: { matricula: pendente.matricula } }),
    ).toBe(1);
  });

  it("desfaz decisão, matrícula e ativação quando a atualização da conta falha", async () => {
    const pendente = await criarPendente("rollback", cursoA);

    await executarDdl(`
      CREATE TRIGGER probe_falha_decisao BEFORE UPDATE ON usuarios
      FOR EACH ROW
      BEGIN
        IF NEW.id = '${pendente.usuarioId}' AND NEW.situacao = 'ativo' THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'probe_falha_decisao';
        END IF;
      END
    `);

    try {
      await expect(
        decidirSolicitacao(pendente.solicitacaoId, "autorizado", adminId),
      ).rejects.toBeDefined();
    } finally {
      await executarDdl("DROP TRIGGER IF EXISTS probe_falha_decisao");
    }

    expect(
      await prisma.solicitacaoAcesso.findUnique({ where: { id: pendente.solicitacaoId } }),
    ).toMatchObject({ situacao: "pendente", decididoPorId: null, decididoEm: null });
    expect(await prisma.usuario.findUnique({ where: { id: pendente.usuarioId } })).toMatchObject({
      situacao: "pendente",
    });
    expect(
      await prisma.matriculaImportada.count({ where: { matricula: pendente.matricula } }),
    ).toBe(0);
  });

  it("bloqueia e restitui o acesso conforme a situação persistida e mantém a decisão consultável", async () => {
    const pendente = await criarPendente("situacao", cursoA);
    await decidirSolicitacao(pendente.solicitacaoId, "autorizado", adminId);

    const administrador: Usuario = {
      id: adminId,
      nome: "Administrador",
      email: email("admin-consulta"),
      papel: "administrador",
      situacao: "ativo",
      campus: "Pinheiral",
      criadoEm: new Date().toISOString(),
    };
    const decididas = await listarSolicitacoes(
      { situacao: "autorizado", busca: pendente.email },
      administrador,
    );

    expect(decididas.itens[0]).toMatchObject({
      id: pendente.solicitacaoId,
      situacao: "autorizado",
      decididoPorId: adminId,
    });
    expect(decididas.itens[0].decididoEm).toBeTruthy();

    const loginAutorizado = await login(pendente.email);
    expect(loginAutorizado.status).toBe(200);
    const cookie = cookies(loginAutorizado);
    expect(await consultarEmOutroProcesso(cookie)).toMatchObject({ id: pendente.usuarioId });

    await inativarUsuario(pendente.usuarioId);
    expect(await prisma.authSession.count({ where: { userId: pendente.usuarioId } })).toBe(0);
    expect(await consultarEmOutroProcesso(cookie)).toBeNull();
    expect((await login(pendente.email)).status).toBe(401);

    await reativarUsuario(pendente.usuarioId);
    const loginReativado = await login(pendente.email);
    expect(loginReativado.status).toBe(200);
    expect(await consultarEmOutroProcesso(cookies(loginReativado))).toMatchObject({
      id: pendente.usuarioId,
    });
  });
});
