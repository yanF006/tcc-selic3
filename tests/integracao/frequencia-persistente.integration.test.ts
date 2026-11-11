import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import type { Usuario } from "@/lib/domain/types";
import { descartarCliente } from "@/lib/db/prisma";
import { criarEstagio } from "@/lib/services/estagios";
import { fichaDoEstagio, iniciarRegistroFicha, registrarFichaFrequencia } from "@/lib/services/frequencia";
import { dadosSolicitacaoTeste } from "@/lib/fixtures/solicitacao-teste";
import * as store from "@/lib/services/store";
import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
const base = process.env.SELIC_MYSQL_TESTE_BASE || join(homedir(), ".local/share/selic-mysql-teste");
const ca = readFileSync(join(base, "tls/ca.pem"), "utf8");
const prefixo = `ficha-${crypto.randomUUID().slice(0, 8)}`;
const prisma = new PrismaClient({ adapter: new PrismaMariaDb({ host: configuracao.host, port: configuracao.porta, user: configuracao.usuario,
  password: configuracao.senha, database: configuracao.banco, connectionLimit: 2, ssl: { ca, rejectUnauthorized: true } }) });
const id = (sufixo: string) => `${prefixo}-${sufixo}`;
const aluno: Usuario = { id: id("aluno"), nome: "aluno", email: `${id("aluno")}@teste.local`, papel: "aluno", situacao: "ativo", campus: "Pinheiral", criadoEm: "2026-11-10" };
const estagiario: Usuario = { id: id("estagiario"), nome: "estagiario", email: `${id("estagiario")}@teste.local`, papel: "coordenador_estagio", situacao: "ativo", campus: "Pinheiral", criadoEm: "2026-11-10" };
const coordenador: Usuario = { id: id("coordenador"), nome: "coordenador", email: `${id("coordenador")}@teste.local`, papel: "coordenador_curso", situacao: "ativo", campus: "Pinheiral", criadoEm: "2026-11-10" };

const VALORES_FICHA = {
  endereco: "Rua das Acácias, 215",
  areaAtuacao: "Desenvolvimento de software",
  setor: "Tecnologia",
  responsavel: "Ricardo Alves",
  nomeSupervisor: "Ricardo Alves",
  meses: [{ ano: 2028, mes: "Março", diasUteis: 21, diasTrabalhados: 20, horasTrabalhadas: 120 }],
  criterio_1: 9.5,
  criterio_2: 7.5,
};

beforeAll(async () => {
  vi.stubEnv("SELIC_PERSISTENCIA", "persistente");
  vi.stubEnv("DATABASE_URL", configuracao.url);
  vi.stubEnv("SELIC_DB_CA_CERT", ca);
  vi.spyOn(store, "obterEstado").mockImplementation(() => { throw new Error("Fixtures proibidas neste fluxo."); });
  await prisma.curso.create({ data: { id: id("curso"), nome: id("curso"), codigo: id("curso") } });
  await prisma.periodo.create({ data: { id: id("periodo"), rotulo: "2098.1", ano: 2098, semestre: 1 } });
  await prisma.turma.create({ data: { id: id("turma"), nome: id("turma"), cursoId: id("curso") } });
  await prisma.turmaPeriodo.create({ data: { turmaId: id("turma"), periodoId: id("periodo") } });
  for (const usuario of [aluno, estagiario, coordenador]) await prisma.usuario.create({ data: {
    id: usuario.id, nome: usuario.nome, email: usuario.email, situacao: "ativo", papel: usuario.papel, campus: usuario.campus,
  } });
  await prisma.dadosPessoaisAluno.create({ data: {
    id: id("dp"), usuarioId: aluno.id, cpf: "52998224725", rg: "12345678", dataNascimento: new Date("2000-01-01"), telefone: "2433334444", celular: "24999994444",
    endereco: { cep: "27197000", logradouro: "Rua do cadastro", numero: "1", bairro: "Centro", cidade: "Pinheiral", estado: "RJ" }, cursoId: id("curso"), turmaId: id("turma"), periodoId: id("periodo"),
  } });
  await prisma.instituicaoConcedente.create({ data: { id: id("instituicao"), nome: prefixo, cnpj: prefixo } });
  await prisma.convenio.create({ data: { id: id("convenio"), instituicaoId: id("instituicao"), nome: prefixo, inicioVigencia: new Date("2027-01-01"), fimVigencia: new Date("2032-01-01") } });
  for (const papel of ["supervisor", "orientador"]) await prisma.pessoa.create({ data: { id: id(papel), nome: papel, email: `${papel}@teste.local`, telefone: "2433334444", papel } });
});

afterAll(async () => {
  vi.restoreAllMocks();
  await prisma.observacaoDocumento.deleteMany({ where: { documento: { alunoId: aluno.id } } });
  await prisma.submissaoDocumento.deleteMany({ where: { documento: { alunoId: aluno.id } } });
  await prisma.documentoPreenchido.deleteMany({ where: { alunoId: aluno.id } });
  await prisma.estagioTemplate.deleteMany({ where: { estagio: { alunoId: aluno.id } } });
  await prisma.estagio.deleteMany({ where: { alunoId: aluno.id } });
  await prisma.convenio.deleteMany({ where: { id: id("convenio") } });
  await prisma.instituicaoConcedente.deleteMany({ where: { id: id("instituicao") } });
  await prisma.pessoa.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.dadosPessoaisAluno.deleteMany({ where: { usuarioId: aluno.id } });
  await prisma.usuario.deleteMany({ where: { id: { startsWith: prefixo } } });
  await prisma.turmaPeriodo.deleteMany({ where: { turmaId: id("turma") } });
  await prisma.turma.deleteMany({ where: { id: id("turma") } });
  await prisma.periodo.deleteMany({ where: { id: id("periodo") } });
  await prisma.curso.deleteMany({ where: { id: id("curso") } });
  await prisma.$disconnect();
  descartarCliente();
  vi.unstubAllEnvs();
});

async function estagioPersistente(liberado: boolean, ano = 2028) {
  const estagio = await criarEstagio(aluno, { ...dadosSolicitacaoTeste(), convenioId: id("convenio"), supervisorId: id("supervisor"), orientadorId: id("orientador"), dataInicio: `${ano}-06-03`, dataFim: `${ano}-06-28` });
  if (liberado) await prisma.estagio.update({ where: { id: estagio.id }, data: { situacao: "em_andamento", liberadoEm: new Date(), liberadoPorId: estagiario.id } });
  return estagio;
}

describe("ficha de frequência persistente", () => {
  it("registra horas e avaliações apenas com estágio liberado e cargo permitido", async () => {
    const bloqueado = await estagioPersistente(false, 2027);
    const recusado = await registrarFichaFrequencia(estagiario, bloqueado.id, VALORES_FICHA);
    expect(recusado).toMatchObject({ ok: false, erro: "O estágio aguarda liberação ou está cancelado/excluído." });
    expect(await prisma.documentoPreenchido.count({ where: { estagioId: bloqueado.id, templateId: "tpl-ficha-frequencia" } })).toBe(0);

    const estagio = await estagioPersistente(true);
    await expect(iniciarRegistroFicha(coordenador, estagio.id)).rejects.toMatchObject({ codigo: "acesso_negado" });
    const preparacao = await iniciarRegistroFicha(estagiario, estagio.id);
    expect(preparacao).toMatchObject({ aluno: { id: aluno.id }, ficha: null });
    expect(preparacao.valores.aluno).toBe(aluno.nome);

    const resultado = await registrarFichaFrequencia(estagiario, estagio.id, { ...VALORES_FICHA, conceitoGlobal: 99 });
    expect(resultado).toMatchObject({ ok: true, ficha: { templateId: "tpl-ficha-frequencia", alunoId: aluno.id, estagioId: estagio.id, situacao: "registrada", registradoPorId: estagiario.id } });
    expect(resultado.ficha?.registradoEm).toBeTruthy();
    expect(resultado.ficha?.valores).toMatchObject({ meses: VALORES_FICHA.meses, criterio_1: 9.5, criterio_2: 7.5, conceitoGlobal: 8.5 });
    const salva = await prisma.documentoPreenchido.findUniqueOrThrow({ where: { id: resultado.ficha!.id } });
    expect(salva).toMatchObject({ registradoPorId: estagiario.id, situacao: "registrada" });
    expect(salva.registradoEm).toBeTruthy();
    expect(await fichaDoEstagio(estagio.id)).toMatchObject({ id: salva.id, registradoPorId: estagiario.id });
  });

  it("reaproveita a ficha registrada, exige valores válidos e não altera o histórico ao inativar", async () => {
    const estagio = await estagioPersistente(true, 2029);
    const primeira = await registrarFichaFrequencia(estagiario, estagio.id, VALORES_FICHA);
    expect(primeira.ok).toBe(true);
    const idFicha = primeira.ficha!.id;
    const reaproveitada = await iniciarRegistroFicha(estagiario, estagio.id);
    expect(reaproveitada.ficha?.id).toBe(idFicha);
    expect(reaproveitada.valores.meses).toEqual(VALORES_FICHA.meses);

    const invalida = await registrarFichaFrequencia(estagiario, estagio.id, { criterio_1: 8 });
    expect(invalida.ok).toBe(false);
    expect(invalida.problemas?.map((problema) => problema.campo)).toEqual(expect.arrayContaining(["endereco", "areaAtuacao", "setor", "responsavel", "nomeSupervisor"]));
    expect(await prisma.documentoPreenchido.count({ where: { estagioId: estagio.id, templateId: "tpl-ficha-frequencia" } })).toBe(1);

    const segundo = await registrarFichaFrequencia(estagiario, estagio.id, { ...VALORES_FICHA, criterio_1: 6 });
    expect(segundo.ficha?.id).toBe(idFicha);
    expect(segundo.ficha?.valores.criterio_1).toBe(6);
    const linhas = await prisma.documentoPreenchido.findMany({ where: { estagioId: estagio.id, templateId: "tpl-ficha-frequencia" } });
    expect(linhas).toHaveLength(1);
    await prisma.documentoPreenchido.update({ where: { id: idFicha }, data: { situacao: "inativo", inativadoEm: new Date() } });
    expect(await fichaDoEstagio(estagio.id)).toBeNull();
    expect((await prisma.documentoPreenchido.findUniqueOrThrow({ where: { id: idFicha } })).valores).toMatchObject({ criterio_1: 6 });
  });
});
