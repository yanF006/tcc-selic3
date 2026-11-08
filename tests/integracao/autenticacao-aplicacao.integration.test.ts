import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { criarAutenticacao, criarAutenticacaoCadastro } from "@/lib/auth/autenticacao";
import { opcoesDeConexao, descartarCliente } from "@/lib/db/prisma";
import { atualizarUsuario } from "@/lib/db/persistencia";
import { paraDominioUsuario } from "@/lib/db/mapeadores/usuarios";
import { GET, POST, runtime } from "@/app/api/auth/[...all]/route";

import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";

const configuracaoBanco = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base =
  process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(opcoesDeConexao(configuracaoBanco.url, { SELIC_DB_CA_CERT: ca })),
});
const configuracao = {
  origem: "https://selic.teste.local",
  segredo: "segredo-exclusivo-dos-testes-auth-aplicacao-selic",
};
const email = `auth-app-${crypto.randomUUID()}@teste.local`;
const senha = "SenhaValida123!";
let usuarioId = "";

function requisicao(
  caminho: string,
  body: Record<string, unknown>,
  cookie?: string,
  origem = configuracao.origem,
) {
  return new Request(`${configuracao.origem}/api/auth${caminho}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origem,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
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
        TEST_APP_DATABASE_URL: configuracaoBanco.url,
      },
    },
  );
  return JSON.parse(stdout) as { id: string; papel: string; cursoId?: string } | null;
}

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", configuracaoBanco.url);
  vi.stubEnv("SELIC_PERSISTENCIA", "persistente");
  vi.stubEnv("SELIC_DB_CA_CERT", ca);
  vi.stubEnv("BETTER_AUTH_URL", configuracao.origem);
  vi.stubEnv("BETTER_AUTH_SECRET", configuracao.segredo);
  await prisma.$transaction(
    async (tx) => {
      const restrita = criarAutenticacaoCadastro(tx, configuracao);
      const resultado = await restrita.api.signUpEmail({
        body: { name: "Titular da Aplicação", email, password: senha },
      });
      usuarioId = resultado.user.id;
      expect(resultado.token).toBeNull();
      await tx.usuario.update({ where: { id: usuarioId }, data: { situacao: "ativo" } });
    },
    { timeout: 20_000 },
  );
});

beforeEach(async () => {
  await prisma.authSession.deleteMany({ where: { userId: usuarioId } });
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { situacao: "ativo", papel: "aluno", cursoId: null, membroComissaoEstagio: false },
  });
});

afterAll(async () => {
  await prisma.usuario.deleteMany({ where: { email } });
  await prisma.$disconnect();
  descartarCliente();
  vi.unstubAllEnvs();
});

describe("Better Auth no modelo único da aplicação", () => {
  it.each(["pendente", "inativo"])(
    "bloqueia emissão e uso de sessão da conta %s sem revelar situação com senha errada",
    async (situacao) => {
      const login = await POST(requisicao("/sign-in/email", { email, password: senha }));
      expect(login.status).toBe(200);
      await prisma.usuario.update({ where: { id: usuarioId }, data: { situacao } });
      expect(await consultarEmOutroProcesso(cookies(login))).toBeNull();
      await prisma.authSession.deleteMany({ where: { userId: usuarioId } });

      const incorreto = await POST(
        requisicao("/sign-in/email", { email, password: "SenhaErrada123!" }),
      );
      expect(incorreto.status).toBe(401);
      expect(await incorreto.json()).toMatchObject({ code: "INVALID_EMAIL_OR_PASSWORD" });
      const correto = await POST(requisicao("/sign-in/email", { email, password: senha }));
      expect(correto.status).toBe(situacao === "pendente" ? 403 : 401);
      expect(await correto.json()).toMatchObject({
        code: situacao === "pendente" ? "CONTA_PENDENTE" : "INVALID_EMAIL_OR_PASSWORD",
      });
      expect(correto.headers.get("set-cookie")).toBeNull();
      expect(await prisma.authSession.count({ where: { userId: usuarioId } })).toBe(0);
    },
  );

  it("relê cargo/curso atuais em outro processo e revoga sessões na inativação", async () => {
    const cursoId = `curso-${crypto.randomUUID()}`;
    await prisma.curso.create({ data: { id: cursoId, nome: "Curso da Sessão", codigo: cursoId } });
    try {
      const login = await POST(requisicao("/sign-in/email", { email, password: senha }));
      expect(login.status).toBe(200);
      const cookie = cookies(login);
      const usuario = paraDominioUsuario(
        await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } }),
      );
      await atualizarUsuario({ ...usuario, papel: "coordenador_curso", cursoId });
      expect(await consultarEmOutroProcesso(cookie)).toMatchObject({
        id: usuarioId,
        papel: "coordenador_curso",
        cursoId,
      });
      await atualizarUsuario({ ...usuario, papel: "aluno", cursoId: undefined });
      expect(await consultarEmOutroProcesso(cookie)).toEqual({ id: usuarioId, papel: "aluno" });
      await atualizarUsuario({ ...usuario, situacao: "inativo" });
      expect(await prisma.authSession.count({ where: { userId: usuarioId } })).toBe(0);
      expect(await consultarEmOutroProcesso(cookie)).toBeNull();
    } finally {
      await prisma.usuario.update({ where: { id: usuarioId }, data: { cursoId: null } });
      await prisma.curso.delete({ where: { id: cursoId } });
    }
  });

  it("valida sessão em outro processo e rejeita cookie legado, adulteração, expiração e logout", async () => {
    const login = await POST(requisicao("/sign-in/email", { email, password: senha }));
    expect(login.status).toBe(200);
    const cookie = cookies(login);
    expect(await consultarEmOutroProcesso(cookie)).toMatchObject({ id: usuarioId, papel: "aluno" });
    expect(await consultarEmOutroProcesso(`selic-sessao=${usuarioId}`)).toBeNull();
    const adulterado = cookie.replace(/(session_token=)[^;]+/, "$1adulterado");
    expect(await consultarEmOutroProcesso(adulterado)).toBeNull();
    await POST(requisicao("/sign-out", {}, cookie));
    expect(await consultarEmOutroProcesso(cookie)).toBeNull();

    const novoLogin = await POST(requisicao("/sign-in/email", { email, password: senha }));
    expect(novoLogin.status).toBe(200);
    await prisma.authSession.updateMany({
      where: { userId: usuarioId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await consultarEmOutroProcesso(cookies(novoLogin))).toBeNull();
    await prisma.authSession.deleteMany({ where: { userId: usuarioId } });
  });

  it("realiza login/logout padrão no handler Node.js e usa cookie seguro", async () => {
    expect(runtime).toBe("nodejs");
    const login = await POST(requisicao("/sign-in/email", { email, password: senha }));
    expect(login.status).toBe(200);
    const dados = await login.json();
    expect(dados.user).toMatchObject({ id: usuarioId, name: "Titular da Aplicação", email });
    expect(
      await prisma.authAccount.count({ where: { userId: usuarioId, providerId: "credential" } }),
    ).toBe(1);
    expect(await prisma.authSession.count({ where: { userId: usuarioId } })).toBe(1);
    const cabecalho = login.headers
      .getSetCookie()
      .find((cookie) => cookie.includes("session_token="));
    expect(cabecalho).toContain("selic-auth.session_token=");
    expect(cabecalho).toMatch(/HttpOnly/i);
    expect(cabecalho).toMatch(/Secure/i);
    expect(cabecalho).toMatch(/SameSite=Lax/i);
    expect(cabecalho).not.toContain("selic-sessao");
    const cookie = cookies(login);
    const consultar = () =>
      GET(
        new Request(`${configuracao.origem}/api/auth/get-session`, { headers: { Cookie: cookie } }),
      );
    expect((await (await consultar()).json()).user.id).toBe(usuarioId);
    const logout = await POST(requisicao("/sign-out", {}, cookie));
    expect(logout.status).toBe(200);
    expect(await prisma.authSession.count({ where: { userId: usuarioId } })).toBe(0);
    expect(await (await consultar()).json()).toBeNull();
  });

  it("bloqueia signup genérico por HTTP e pela instância normal, sem criar domínio", async () => {
    const novoEmail = `nao-criar-${crypto.randomUUID()}@teste.local`;
    const body = {
      name: "Cadastro adulterado",
      email: novoEmail,
      password: senha,
      papel: "administrador",
      matricula: "20260000099",
      situacao: "ativo",
      membroComissaoEstagio: true,
    };
    const resposta = await POST(requisicao("/sign-up/email", body));
    expect(resposta.status).toBe(404);
    const auth = criarAutenticacao(prisma, configuracao);
    await expect(auth.api.signUpEmail({ body })).rejects.toThrow();
    expect(await prisma.usuario.count({ where: { email: novoEmail } })).toBe(0);
    expect(await prisma.authAccount.count({ where: { user: { email: novoEmail } } })).toBe(0);
  });

  it("não permite atribuir cargo, matrícula ou situação por atualização genérica", async () => {
    const antes = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    const login = await POST(requisicao("/sign-in/email", { email, password: senha }));
    expect(login.status).toBe(200);
    const resposta = await POST(
      requisicao(
        "/update-user",
        {
          papel: "administrador",
          situacao: "inativo",
          matricula: "20260000099",
          membroComissaoEstagio: true,
        },
        cookies(login),
      ),
    );
    expect(resposta.status).toBe(404);
    const depois = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(depois).toMatchObject({
      papel: antes.papel,
      matricula: antes.matricula,
      situacao: antes.situacao,
      membroComissaoEstagio: antes.membroComissaoEstagio,
    });
    await POST(requisicao("/sign-out", {}, cookies(login)));
  });

  it("recusa origem não confiável sem emitir sessão", async () => {
    const antes = await prisma.authSession.count({ where: { userId: usuarioId } });
    const resposta = await POST(
      requisicao(
        "/sign-in/email",
        { email, password: senha },
        undefined,
        "https://origem-nao-confiavel.invalid",
      ),
    );
    expect(resposta.status).toBe(403);
    expect(resposta.headers.get("set-cookie")).toBeNull();
    expect(await prisma.authSession.count({ where: { userId: usuarioId } })).toBe(antes);
  });
});
