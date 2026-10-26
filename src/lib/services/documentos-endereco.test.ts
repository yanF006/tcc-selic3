import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarRascunho, salvarRascunho, valoresDoPreenchimento } from "./documentos";
import { obterEstado, reiniciarEstado } from "./store";
import {
  salvarDocumentoAction,
  submeterDocumentoAction,
  baixarDocumentoAction,
} from "@/app/(catalogo)/documentos/acoes";
import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import { DocumentoImpressao } from "@/components/documentos/documento-impressao";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { descritorPorTemplate } from "@/lib/templates/descriptors";
import { dadosSolicitacaoTeste } from "@/lib/fixtures/solicitacao-teste";
import { prepararDocumentosIniciais } from "./fluxo-estagio";

vi.mock("@/lib/auth/sessao-servidor", () => ({ usuarioDaRequisicaoObrigatorio: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const usuario = (id = "usr-maria") => obterEstado().usuarios.find((u) => u.id === id)!;
beforeEach(async () => {
  reiniciarEstado();
  obterEstado().documentos = [];
  const estagio = obterEstado().estagios.find((registro) => registro.id === "est-maria-tecnoweb")!;
  estagio.situacao = "em_preparacao";
  estagio.liberadoEm = undefined;
  obterEstado().documentos.push({
    id: "liberacao-em-correcao",
    templateId: "tpl-formulario-liberacao",
    alunoId: "usr-maria",
    estagioId: estagio.id,
    versaoTemplate: 1,
    valores: {},
    situacao: "rascunho",
    correcaoAberta: true,
    criadoEm: "2026-01-01T00:00:00Z",
    atualizadoEm: "2026-01-01T00:00:00Z",
  });
  await prepararDocumentosIniciais(
    estagio.id,
    usuario(),
    dadosSolicitacaoTeste().valoresDocumentos,
  );
  vi.clearAllMocks();
  vi.mocked(usuarioDaRequisicaoObrigatorio).mockResolvedValue(usuario());
});
const manual = {
  logradouroAluno: "Rua corrigida",
  numeroAluno: "s/n",
  complementoAluno: "Bloco B",
  bairroAluno: "Bairro manual",
  cepAluno: "23940000",
  telefoneAluno: "2133337788",
  celularAluno: "21998761234",
  emailAluno: "maria.souza@aluno.ifrj.edu.br",
  enderecoLocal: "Rua da empresa, 10",
  telefoneSupervisor: "2133331000",
};

describe("endereços persistidos nos documentos", () => {
  it("inicializa endereço do aluno e não confunde a concedente", async () => {
    obterEstado().documentos = [];
    const doc = await criarRascunho(usuario(), "tpl-formulario-liberacao", "est-maria-tecnoweb");
    expect(doc.valores.logradouroAluno).toBe(usuario().dadosPessoais!.endereco.logradouro);
    expect(doc.valores.cepAluno).toBe(usuario().dadosPessoais!.endereco.cep);
    expect(doc.valores.enderecoLocal).toBe("");
    const incompleto = structuredClone(usuario());
    incompleto.dadosPessoais!.endereco = {
      ...incompleto.dadosPessoais!.endereco,
      logradouro: "",
      numero: "",
    };
    const valores = await valoresDoPreenchimento(
      "tpl-relatorio-semestral",
      incompleto,
      undefined,
      {},
    );
    expect(valores.cidade).toBe(incompleto.dadosPessoais!.endereco.cidade);
    expect(valores.endereco).toBe("");
  });
  it("preserva valores salvos e vazios após atualização do perfil", async () => {
    const doc = await criarRascunho(usuario(), "tpl-formulario-liberacao", "est-maria-tecnoweb");
    await salvarRascunho(doc.id, { ...manual, cidadeAluno: "", nomeCompleto: "Falso" });
    usuario().dadosPessoais!.endereco.logradouro = "Perfil atualizado";
    const reaberto = await criarRascunho(usuario(), doc.templateId, doc.estagioId);
    expect(reaberto.valores).toMatchObject({
      logradouroAluno: "Rua corrigida",
      cidadeAluno: "",
      enderecoAluno: "Rua corrigida, s/n, Bloco B, Bairro manual",
      nomeCompleto: usuario().nome,
    });
    expect(usuario().dadosPessoais!.endereco.numero).not.toBe("s/n");
  });
  it("preserva texto legado e não mistura campos com o perfil", async () => {
    const legado = { endereco: "Alameda antiga, 42, apartamento 7", cep: "23940000" };
    let valores = await valoresDoPreenchimento(
      "tpl-relatorio-semestral",
      usuario(),
      undefined,
      legado,
    );
    expect(valores.endereco).toBe(legado.endereco);
    expect(valores.numero).toBeUndefined();
    valores = await valoresDoPreenchimento("tpl-relatorio-semestral", usuario(), undefined, {
      ...valores,
      logradouro: "Nova Alameda",
    });
    expect(valores.endereco).toBe(legado.endereco);
    valores = await valoresDoPreenchimento("tpl-relatorio-semestral", usuario(), undefined, {
      ...valores,
      numero: "42",
      complemento: "apartamento 7",
    });
    expect(valores.endereco).toBe("Nova Alameda, 42, apartamento 7");
  });
  it("salva e submete valores finais manuais sem consulta e protege identificação", async () => {
    const doc = await criarRascunho(usuario(), "tpl-formulario-liberacao", "est-maria-tecnoweb");
    const resultado = await salvarDocumentoAction(doc.id, { ...manual, nomeCompleto: "Falso" });
    expect(resultado.ok).toBe(true);
    expect(resultado.valores).toMatchObject({ ...manual, nomeCompleto: usuario().nome });
    expect((await submeterDocumentoAction(doc.id, manual)).ok).toBe(true);
    expect(doc.situacao).toBe("submetido");
    const historico = structuredClone(doc.valores);
    usuario().dadosPessoais!.endereco.logradouro = "Mudou";
    await criarRascunho(usuario(), doc.templateId, doc.estagioId);
    expect(doc.valores).toEqual(historico);
    expect((await salvarDocumentoAction(doc.id, manual)).ok).toBe(false);
  });
  it("recusa perfil sem permissão e titular inativo", async () => {
    const doc = await criarRascunho(usuario(), "tpl-formulario-liberacao", "est-maria-tecnoweb");
    vi.mocked(usuarioDaRequisicaoObrigatorio).mockResolvedValue(usuario("usr-ana"));
    expect((await salvarDocumentoAction(doc.id, manual)).ok).toBe(false);
    vi.mocked(usuarioDaRequisicaoObrigatorio).mockResolvedValue(usuario());
    usuario().situacao = "inativo";
    expect((await salvarDocumentoAction(doc.id, manual)).ok).toBe(false);
  });
  it("download e impressão usam o endereço corrigido e mantêm número/complemento", async () => {
    const doc = await criarRascunho(usuario(), "tpl-formulario-liberacao", "est-maria-tecnoweb");
    expect((await salvarDocumentoAction(doc.id, manual)).ok).toBe(true);
    usuario().dadosPessoais!.endereco.logradouro = "Não imprimir";
    const arquivo = await baixarDocumentoAction(doc.id, doc.templateId, "pdf");
    expect(arquivo.ok).toBe(true);
    expect(Buffer.from(arquivo.base64!, "base64").toString()).toContain("Rua corrigida");
    const html = renderToStaticMarkup(
      createElement(DocumentoImpressao, {
        descriptor: descritorPorTemplate(doc.templateId)!,
        valores: doc.valores,
      }),
    );
    expect(html).toContain("Rua corrigida, s/n, Bloco B, Bairro manual");
    expect(html).not.toContain("Não imprimir");
  });
});
