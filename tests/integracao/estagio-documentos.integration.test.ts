import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";

import { carregarUrlAppTeste, validarUrlTeste } from "./configuracao";

const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: configuracao.host,
    port: configuracao.porta,
    user: configuracao.usuario,
    password: configuracao.senha,
    database: configuracao.banco,
    connectionLimit: 1,
    ssl: { rejectUnauthorized: false },
  }),
});

const prefixo = `estagio-${crypto.randomUUID()}`;
const usuarios: string[] = [];
const instituicoes: string[] = [];
const convenios: string[] = [];
const pessoas: string[] = [];
const estagios: string[] = [];
const documentos: string[] = [];
const arquivos: string[] = [];
const lancamentos: string[] = [];
const submissoes: string[] = [];
const pareceres: string[] = [];
const observacoes: string[] = [];
const solicitacoesExclusao: string[] = [];
const pedidosEnvio: string[] = [];
const envios: string[] = [];

afterAll(async () => {
  if (envios.length) await prisma.envioExterno.deleteMany({ where: { id: { in: envios } } });
  if (pedidosEnvio.length)
    await prisma.pedidoEnvioDocumento.deleteMany({ where: { id: { in: pedidosEnvio } } });
  if (observacoes.length)
    await prisma.observacaoDocumento.deleteMany({ where: { id: { in: observacoes } } });
  if (pareceres.length) await prisma.parecer.deleteMany({ where: { id: { in: pareceres } } });
  if (submissoes.length)
    await prisma.submissaoDocumento.deleteMany({ where: { id: { in: submissoes } } });
  if (arquivos.length) await prisma.arquivo.deleteMany({ where: { id: { in: arquivos } } });
  if (documentos.length)
    await prisma.documentoPreenchido.deleteMany({ where: { id: { in: documentos } } });
  if (lancamentos.length) {
    const correcoes = await prisma.lancamentoHoras.findMany({
      where: { id: { in: lancamentos }, corrigeId: { not: null } },
      select: { id: true },
    });
    await prisma.lancamentoHoras.deleteMany({
      where: { id: { in: correcoes.map((item) => item.id) } },
    });
    await prisma.lancamentoHoras.deleteMany({ where: { id: { in: lancamentos } } });
  }
  if (solicitacoesExclusao.length)
    await prisma.solicitacaoExclusaoEstagio.deleteMany({
      where: { id: { in: solicitacoesExclusao } },
    });
  if (estagios.length) {
    await prisma.estagioTemplate.deleteMany({ where: { estagioId: { in: estagios } } });
    await prisma.estagio.deleteMany({ where: { id: { in: estagios } } });
  }
  if (convenios.length) await prisma.convenio.deleteMany({ where: { id: { in: convenios } } });
  if (instituicoes.length)
    await prisma.instituicaoConcedente.deleteMany({ where: { id: { in: instituicoes } } });
  if (pessoas.length) await prisma.pessoa.deleteMany({ where: { id: { in: pessoas } } });
  if (usuarios.length) await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
  await prisma.$disconnect();
});

async function novoUsuario(email: string) {
  const usuario = await prisma.usuario.create({
    data: { id: crypto.randomUUID(), nome: "Usuário de Estágio", email, papel: "aluno" },
  });
  usuarios.push(usuario.id);
  return usuario;
}

async function novoConvenio() {
  const instituicao = await prisma.instituicaoConcedente.create({
    data: {
      id: crypto.randomUUID(),
      nome: "Instituição de Estágio",
      cnpj: `${Date.now()}${crypto.randomUUID().slice(0, 4)}`,
    },
  });
  instituicoes.push(instituicao.id);
  const convenio = await prisma.convenio.create({
    data: {
      id: crypto.randomUUID(),
      instituicaoId: instituicao.id,
      nome: "Convênio de Estágio",
      inicioVigencia: new Date("2026-01-01T00:00:00.000Z"),
      fimVigencia: new Date("2031-01-01T00:00:00.000Z"),
    },
  });
  convenios.push(convenio.id);
  return convenio;
}

async function novaPessoa(papel: "supervisor" | "orientador") {
  const pessoa = await prisma.pessoa.create({
    data: {
      id: crypto.randomUUID(),
      nome: `Pessoa ${papel}`,
      email: `${prefixo}-${papel}-${crypto.randomUUID()}@teste.local`,
      telefone: "24999998888",
      papel,
    },
  });
  pessoas.push(pessoa.id);
  return pessoa;
}

async function novoEstagio() {
  const aluno = await novoUsuario(`${prefixo}-${crypto.randomUUID()}@teste.local`);
  const convenio = await novoConvenio();
  const supervisor = await novaPessoa("supervisor");
  const orientador = await novaPessoa("orientador");
  const estagio = await prisma.estagio.create({
    data: {
      id: crypto.randomUUID(),
      alunoId: aluno.id,
      convenioId: convenio.id,
      supervisorId: supervisor.id,
      orientadorId: orientador.id,
      dataInicio: new Date("2026-01-01T00:00:00.000Z"),
      dataFim: new Date("2026-06-30T00:00:00.000Z"),
      situacao: "em_andamento",
      cargaHorariaPrevistaMinutos: 3600,
    },
  });
  estagios.push(estagio.id);
  return { aluno, convenio, supervisor, orientador, estagio };
}

async function novoDocumento(estagioId: string, alunoId: string) {
  const documento = await prisma.documentoPreenchido.create({
    data: {
      id: crypto.randomUUID(),
      templateId: "termo-compromisso",
      alunoId,
      estagioId,
      versaoTemplate: 2,
      definicaoChecksum: "a".repeat(64),
      definicaoSnapshot: { nome: "Termo de Compromisso", campos: ["aluno", "curso"] },
      valores: { aluno: "Usuário de Estágio", curso: "Sistemas de Informação" },
      situacao: "rascunho",
    },
  });
  documentos.push(documento.id);
  return documento;
}

describe("estágio, documentos, horas e envios", () => {
  it("preserva o estágio, a seleção de templates e o snapshot do documento", async () => {
    const { estagio, aluno } = await novoEstagio();
    await prisma.estagioTemplate.create({
      data: { estagioId: estagio.id, templateId: "termo-compromisso" },
    });
    const documento = await novoDocumento(estagio.id, aluno.id);

    const completo = await prisma.estagio.findUniqueOrThrow({
      where: { id: estagio.id },
      include: {
        templates: true,
        documentos: true,
        aluno: true,
        convenio: true,
        supervisor: true,
        orientador: true,
      },
    });
    expect(completo.templates.map((item) => item.templateId)).toEqual(["termo-compromisso"]);
    expect(completo.documentos.map((item) => item.id)).toEqual([documento.id]);
    expect(completo.aluno.id).toBe(aluno.id);
    expect(completo.convenio.id).toBe(estagio.convenioId);
    expect(completo.supervisor.id).toBe(estagio.supervisorId);
    expect(completo.orientador.id).toBe(estagio.orientadorId);
    expect(completo.cargaHorariaPrevistaMinutos).toBe(3600);

    expect(documento.versaoTemplate).toBe(2);
    expect(documento.definicaoChecksum).toBe("a".repeat(64));
    expect(documento.definicaoSnapshot).toEqual({
      nome: "Termo de Compromisso",
      campos: ["aluno", "curso"],
    });
    expect(documento.valores).toEqual({
      aluno: "Usuário de Estágio",
      curso: "Sistemas de Informação",
    });

    const submissao = await prisma.submissaoDocumento.create({
      data: {
        id: crypto.randomUUID(),
        documentoId: documento.id,
        versao: 1,
        autorId: aluno.id,
      },
    });
    submissoes.push(submissao.id);
    const parecer = await prisma.parecer.create({
      data: {
        id: crypto.randomUUID(),
        documentoId: documento.id,
        decisao: "aprovado",
        consideracoes: "Sem pendências.",
        autorId: aluno.id,
        fila: "coordenador_curso",
      },
    });
    pareceres.push(parecer.id);
    const observacao = await prisma.observacaoDocumento.create({
      data: {
        id: crypto.randomUUID(),
        documentoId: documento.id,
        conteudo: "Observação de teste.",
        autorId: aluno.id,
      },
    });
    observacoes.push(observacao.id);

    expect(await prisma.submissaoDocumento.count({ where: { documentoId: documento.id } })).toBe(1);
    expect(await prisma.parecer.count({ where: { documentoId: documento.id } })).toBe(1);
    expect(await prisma.observacaoDocumento.count({ where: { documentoId: documento.id } })).toBe(
      1,
    );
  });

  it("separa metadados e conteúdo binário do arquivo", async () => {
    const { estagio, aluno } = await novoEstagio();
    const documento = await novoDocumento(estagio.id, aluno.id);
    const conteudo = Buffer.from("conteúdo binário do anexo", "utf8");
    const arquivo = await prisma.arquivo.create({
      data: {
        id: crypto.randomUUID(),
        documentoId: documento.id,
        nome: "anexo.pdf",
        mimeType: "application/pdf",
        tamanhoBytes: conteudo.byteLength,
        checksum: "b".repeat(64),
        conteudo,
        autorId: aluno.id,
      },
    });
    arquivos.push(arquivo.id);

    const metadados = await prisma.arquivo.findMany({
      where: { documentoId: documento.id },
      select: { id: true, nome: true, mimeType: true, tamanhoBytes: true, checksum: true },
    });
    expect(metadados).toEqual([
      {
        id: arquivo.id,
        nome: "anexo.pdf",
        mimeType: "application/pdf",
        tamanhoBytes: conteudo.byteLength,
        checksum: "b".repeat(64),
      },
    ]);
    expect("conteudo" in metadados[0]).toBe(false);

    const completo = await prisma.arquivo.findUniqueOrThrow({ where: { id: arquivo.id } });
    expect(Buffer.from(completo.conteudo).toString("utf8")).toBe("conteúdo binário do anexo");
  });

  it("mantém minutos inteiros e a referência de correção ao lançamento original", async () => {
    const { estagio, aluno } = await novoEstagio();
    const original = await prisma.lancamentoHoras.create({
      data: {
        id: crypto.randomUUID(),
        estagioId: estagio.id,
        alunoId: aluno.id,
        data: new Date("2026-02-02T00:00:00.000Z"),
        entrada: "08:00",
        saida: "14:00",
        minutos: 360,
      },
    });
    lancamentos.push(original.id);
    const correcao = await prisma.lancamentoHoras.create({
      data: {
        id: crypto.randomUUID(),
        estagioId: estagio.id,
        alunoId: aluno.id,
        data: new Date("2026-02-02T00:00:00.000Z"),
        entrada: "08:00",
        saida: "15:00",
        minutos: 420,
        tipo: "correcao",
        corrigeId: original.id,
        sequenciaCorrecao: 1,
      },
    });
    lancamentos.push(correcao.id);

    expect(correcao.minutos).toBe(420);
    expect(correcao.corrigeId).toBe(original.id);
    await expect(
      prisma.lancamentoHoras.create({
        data: {
          id: crypto.randomUUID(),
          estagioId: estagio.id,
          alunoId: aluno.id,
          data: new Date("2026-02-02T00:00:00.000Z"),
          entrada: "08:00",
          saida: "16:00",
          minutos: 480,
          tipo: "correcao",
          corrigeId: original.id,
          sequenciaCorrecao: 1,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("registra exclusão, pedido e tentativa de envio com vínculos próprios", async () => {
    const { estagio, aluno } = await novoEstagio();
    const documento = await novoDocumento(estagio.id, aluno.id);

    const solicitacao = await prisma.solicitacaoExclusaoEstagio.create({
      data: {
        id: crypto.randomUUID(),
        estagioId: estagio.id,
        solicitanteId: aluno.id,
        motivo: "Encerramento antecipado.",
      },
    });
    solicitacoesExclusao.push(solicitacao.id);
    const pedido = await prisma.pedidoEnvioDocumento.create({
      data: {
        id: crypto.randomUUID(),
        documentoId: documento.id,
        pedidoPorId: aluno.id,
        situacao: "pendente",
      },
    });
    pedidosEnvio.push(pedido.id);
    const envio = await prisma.envioExterno.create({
      data: {
        id: crypto.randomUUID(),
        documentoId: documento.id,
        pedidoId: pedido.id,
        destinatario: "Instituição",
        destinatarioEmail: "instituicao@teste.local",
        autorId: aluno.id,
        status: "enviado",
        tentativa: 1,
        enviadoEm: new Date("2026-02-03T12:00:00.000Z"),
      },
    });
    envios.push(envio.id);

    const solicitacaoCompleta = await prisma.solicitacaoExclusaoEstagio.findUniqueOrThrow({
      where: { id: solicitacao.id },
      include: { estagio: true, solicitante: true },
    });
    expect(solicitacaoCompleta.estagio.id).toBe(estagio.id);
    expect(solicitacaoCompleta.solicitante.id).toBe(aluno.id);

    const pedidoCompleto = await prisma.pedidoEnvioDocumento.findUniqueOrThrow({
      where: { id: pedido.id },
      include: { documento: true, pedidoPor: true, envios: true },
    });
    expect(pedidoCompleto.documento.id).toBe(documento.id);
    expect(pedidoCompleto.pedidoPor.id).toBe(aluno.id);
    expect(pedidoCompleto.envios.map((item) => item.id)).toEqual([envio.id]);
  });

  it("mantém índices de fila e de histórico consultáveis", async () => {
    const esperados: Record<string, string[]> = {
      estagios: ["alunoId", "situacao", "dataInicio"],
      documentos_preenchidos: ["estagioId", "situacao"],
      pareceres: ["fila"],
      solicitacoes_exclusao_estagio: ["situacao"],
      pedidos_envio_documento: ["situacao"],
      envios_externos: ["status"],
      lancamentos_horas: ["estagioId", "data"],
    };

    for (const [tabela, colunas] of Object.entries(esperados)) {
      const indices = await prisma.$queryRawUnsafe<Array<{ Column_name: string }>>(
        `SHOW INDEX FROM ${tabela}`,
      );
      const encontrados = new Set(indices.map((indice) => indice.Column_name));
      for (const coluna of colunas) expect(encontrados.has(coluna)).toBe(true);
    }
  });
});
