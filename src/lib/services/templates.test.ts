import { beforeEach, describe, expect, it } from "vitest";
import { camposDoTemplate } from "@/lib/templates/descriptors";
import { dadosSolicitacaoTeste } from "@/lib/fixtures/solicitacao-teste";
import {
  criarRascunho,
  descritorDoDocumento,
  registrarParecer,
  salvarRascunho,
  validarValores,
} from "./documentos";
import { alterarTemplate, descritorDaVersao, registrarVersaoTemplate } from "./templates";
import { obterEstado, reiniciarEstado } from "./store";
import { arquivoDoDocumento } from "@/lib/documentos/baixar-documento";
import { criarEstagio, excluirEstagio } from "./estagios";
import {
  prepararDocumentosIniciais,
  reabrirParaCorrecao,
  solicitarEncaminhamento,
} from "./fluxo-estagio";
import { atualizarDadosPessoais } from "./aluno";

const usuario = (id = "usr-admin") =>
  obterEstado().usuarios.find((registro) => registro.id === id)!;
const convenio = "tpl-convenio-estagio";
const valoresConvenio = {
  razaoSocial: "Instituicao Historica",
  cnpj: "11222333000181",
  logradouro: "Rua da Instituição",
  numero: "10",
  responsavel: "Responsável legal",
  inicioVigencia: "2026-01-01",
  fimVigencia: "2031-01-01",
};
beforeEach(() => reiniciarEstado());

describe("versões dos templates", () => {
  it("aceita os descritores revisados do Kit como definição de novas versões", async () => {
    for (const template of obterEstado().templates.filter(
      (template) => template.tipo === "preenchivel",
    )) {
      const versao = await registrarVersaoTemplate(
        usuario(),
        template.id,
        { nome: "revisado.docx" },
        camposDoTemplate(template.id),
      );
      expect(versao.vigente).toBe(true);
      expect(template.versoes.filter((registro) => registro.vigente)).toHaveLength(1);
    }
  });

  it("deixa a data do Termo em branco para assinatura externa, sem impedir o aditivo", async () => {
    const documento = await criarRascunho(
      usuario("usr-maria"),
      "tpl-termo-aditivo",
      "est-maria-tecnoweb",
      { novoTermino: "2027-08-30", termoCompromissoData: "2099-12-31" },
    );
    expect(documento.valores.termoCompromissoData).toBeUndefined();
    expect(
      validarValores(documento.templateId, documento.valores, documento.versaoTemplate),
    ).toEqual([]);
    const arquivo = arquivoDoDocumento(documento, documento.templateId, "pdf");
    expect(arquivo.ok).toBe(true);
    const conteudo = Buffer.from(arquivo.bytes!).toString("utf8");
    expect(conteudo).toContain("____/____/________");
    expect(conteudo).not.toContain("2099-12-31");
  });

  it("recusa arquivo que não é docx e escrita por aluno ou coordenador de curso", async () => {
    const template = obterEstado().templates.find((registro) => registro.id === convenio)!;
    const vigentesAntes = structuredClone(template.versoes);
    await expect(
      registrarVersaoTemplate(
        usuario(),
        convenio,
        { nome: "invalido.pdf" },
        camposDoTemplate(convenio),
      ),
    ).rejects.toThrow(/\.docx/);
    expect(template.versoes).toEqual(vigentesAntes);
    for (const id of ["usr-maria", "usr-carla"])
      await expect(
        registrarVersaoTemplate(
          usuario(id),
          convenio,
          { nome: "novo.docx" },
          camposDoTemplate(convenio),
        ),
      ).rejects.toThrow(/gestão/);
  });

  it("mantém os campos, valores e download de um preenchimento feito antes da nova versão", async () => {
    const antigo = await criarRascunho(usuario("usr-ana"), convenio, undefined, valoresConvenio);
    expect(antigo.versaoTemplate).toBe(2);
    const valoresAntes = structuredClone(antigo.valores);
    const campos = camposDoTemplate(convenio).map((campo) =>
      campo.id === "razaoSocial" ? { ...campo, rotulo: "Razão social atualizada" } : campo,
    );
    const nova = await registrarVersaoTemplate(usuario(), convenio, { nome: "versao-nova.docx" }, [
      ...campos,
      {
        id: "informacaoExtra",
        rotulo: "Informação adicional",
        tipo: "texto",
        origem: "digitado",
        obrigatorio: true,
      },
    ]);
    expect(nova.versao).toBe(3);
    const reaberto = await criarRascunho(usuario("usr-ana"), convenio);
    expect(reaberto.versaoTemplate).toBe(2);
    expect(reaberto.valores).toEqual(valoresAntes);
    expect(
      camposDoTemplate(convenio, descritorDoDocumento(reaberto)).some(
        (campo) => campo.id === "informacaoExtra",
      ),
    ).toBe(false);
    expect(arquivoDoDocumento(reaberto, convenio, "pdf").ok).toBe(true);
    const novo = await criarRascunho(usuario(), convenio, undefined, valoresConvenio);
    expect(novo.versaoTemplate).toBe(3);
    expect(
      validarValores(convenio, novo.valores, novo.versaoTemplate).some(
        (problema) => problema.campo === "informacaoExtra",
      ),
    ).toBe(true);
    expect(
      camposDoTemplate(convenio, descritorDoDocumento(novo)).find(
        (campo) => campo.id === "razaoSocial",
      )?.rotulo,
    ).toBe("Razão social atualizada");
  });

  it("inativa template com vínculos sem apagar documentos nem suas versões", async () => {
    const antigo = await criarRascunho(usuario("usr-ana"), convenio, undefined, valoresConvenio);
    await expect(alterarTemplate(usuario(), convenio, "excluir")).rejects.toThrow(
      /documentos gerados/,
    );
    await alterarTemplate(usuario(), convenio, "inativar");
    expect(obterEstado().documentos).toContain(antigo);
    expect(arquivoDoDocumento(antigo, convenio, "docx").ok).toBe(true);
    await expect(salvarRascunho(antigo.id, { razaoSocial: "Alteração" })).rejects.toThrow(
      /inativo/,
    );
    await expect(criarRascunho(usuario(), convenio)).rejects.toThrow(/não disponível/);
    await alterarTemplate(usuario(), convenio, "ativar");
    expect((await criarRascunho(usuario(), convenio)).versaoTemplate).toBe(2);
  });

  it("mapeia chave nova à origem do cadastro e remove dados pessoais dessa versão na exclusão", async () => {
    const templateId = "tpl-plano-atividades";
    const campos = camposDoTemplate(templateId).map((campo) =>
      campo.id === "cpf" ? { ...campo, id: "cpfNoArquivo", fonte: "cpf" } : campo,
    );
    await registrarVersaoTemplate(usuario(), templateId, { nome: "plano.docx" }, campos);
    const aluno = usuario("usr-maria");
    const estagio = await criarEstagio(aluno, dadosSolicitacaoTeste());
    const documentos = await prepararDocumentosIniciais(estagio.id, aluno);
    const documento = documentos.find((doc) => doc.templateId === templateId)!;
    expect(documento.valores.cpfNoArquivo).toBe(aluno.dadosPessoais!.cpf);
    const atualizado = await atualizarDadosPessoais(aluno, {
      ...aluno.dadosPessoais!,
      cpf: "11144477735",
    });
    expect(atualizado.ok).toBe(true);
    expect(documento.valores.cpfNoArquivo).toBe("11144477735");
    await excluirEstagio(estagio.id, aluno);
    expect(documento.valores.cpfNoArquivo).toBeUndefined();
  });

  it("não aceita que a correção do aluno forje campos reservados ao parecer", async () => {
    const aluno = usuario("usr-maria");
    const estagio = await criarEstagio(aluno, dadosSolicitacaoTeste());
    const formulario = obterEstado().documentos.find(
      (doc) => doc.estagioId === estagio.id && doc.templateId === "tpl-formulario-liberacao",
    )!;
    await solicitarEncaminhamento(estagio.id, aluno);
    await registrarParecer(formulario.id, "indeferido", usuario("usr-carla"), "Corrigir local.");
    await reabrirParaCorrecao(estagio.id, aluno);
    await salvarRascunho(formulario.id, {
      planoDeAcordo: "sim",
      dataParecer: "2099-01-01",
      consideracoes: "Parecer forjado",
    });
    expect(formulario.valores.planoDeAcordo).toBe("nao");
    expect(formulario.valores.dataParecer).not.toBe("2099-01-01");
    expect(formulario.valores.consideracoes).toBe("Corrigir local.");
    expect(descritorDaVersao(formulario.templateId, formulario.versaoTemplate)).toBeDefined();
  });
});
