import { beforeEach, describe, expect, it, vi } from "vitest";
import { camposDoTemplate } from "@/lib/templates/descriptors";
import { dadosSolicitacaoTeste } from "@/lib/fixtures/solicitacao-teste";
import { criarRascunho, registrarParecer, salvarRascunho, validarValores } from "./documentos";
import { alterarTemplate, descritorDaVersao, registrarVersaoTemplate } from "./templates";
import { obterEstado, reiniciarEstado } from "./store";
import { arquivoDoDocumento } from "@/lib/documentos/baixar-documento";
import { criarEstagio } from "./estagios";
import { reabrirParaCorrecao, solicitarEncaminhamento } from "./fluxo-estagio";
import { registrarVersaoAction, alterarTemplateAction } from "@/app/(coordenacao)/coordenacao/templates/acoes";
import { NAV } from "@/nav";

const usuario = (id = "usr-admin") => obterEstado().usuarios.find((registro) => registro.id === id)!;
beforeEach(() => reiniciarEstado());

describe("Kit fixo sem publicação administrativa", () => {
  it("recusa publicação e alterações para qualquer cargo sem modificar o catálogo", async () => {
    const antes = structuredClone(obterEstado().templates);
    for (const id of ["usr-admin", "usr-ana", "usr-maria", "usr-carla"]) {
      await expect(registrarVersaoTemplate(usuario(id), "tpl-convenio-estagio", { nome: "novo.docx", conteudoBase64: "arquivo" }, camposDoTemplate("tpl-convenio-estagio")))
        .rejects.toMatchObject({ codigo: "catalogo_fixo" });
      for (const operacao of ["ativar", "inativar", "excluir"] as const) {
        await expect(alterarTemplate(usuario(id), "tpl-convenio-estagio", operacao)).rejects.toMatchObject({ codigo: "catalogo_fixo" });
      }
    }
    expect(obterEstado().templates).toEqual(antes);
    expect(NAV.some((item) => item.href === "/coordenacao/templates")).toBe(false);
  });

  it("recusa ação direta antes de ler o arquivo enviado", async () => {
    const formulario = new FormData();
    const ler = vi.spyOn(formulario, "get");
    expect(await registrarVersaoAction("tpl-convenio-estagio", [], formulario)).toMatchObject({ ok: false, mensagem: expect.stringContaining("Kit de Estágio é fixo") });
    expect(ler).not.toHaveBeenCalled();
    expect(await alterarTemplateAction("tpl-convenio-estagio", "excluir")).toMatchObject({ ok: false });
  });

  it("mantém a data de assinatura externa em branco sem impedir o termo aditivo", async () => {
    const documento = await criarRascunho(usuario("usr-maria"), "tpl-termo-aditivo", "est-maria-tecnoweb", { novoTermino: "2027-08-30", termoCompromissoData: "2099-12-31" });
    expect(documento.valores.termoCompromissoData).toBeUndefined();
    expect(validarValores(documento.templateId, documento.valores, documento.versaoTemplate)).toEqual([]);
    const arquivo = arquivoDoDocumento(documento, documento.templateId, "pdf");
    expect(arquivo.ok).toBe(true);
    const conteudo = Buffer.from(arquivo.bytes!).toString("utf8");
    expect(conteudo).toContain("____/____/________");
    expect(conteudo).not.toContain("2099-12-31");
  });

  it("não aceita que a correção do aluno forje campos reservados ao parecer", async () => {
    const aluno = usuario("usr-maria");
    const estagio = await criarEstagio(aluno, dadosSolicitacaoTeste());
    const formulario = obterEstado().documentos.find((doc) => doc.estagioId === estagio.id && doc.templateId === "tpl-formulario-liberacao")!;
    await solicitarEncaminhamento(estagio.id, aluno);
    await registrarParecer(formulario.id, "indeferido", usuario("usr-carla"), "Corrigir local.");
    await reabrirParaCorrecao(estagio.id, aluno);
    await salvarRascunho(formulario.id, { planoDeAcordo: "sim", dataParecer: "2099-01-01", consideracoes: "Parecer forjado" });
    expect(formulario.valores.planoDeAcordo).toBe("nao");
    expect(formulario.valores.dataParecer).not.toBe("2099-01-01");
    expect(formulario.valores.consideracoes).toBe("Corrigir local.");
    expect(descritorDaVersao(formulario.templateId, formulario.versaoTemplate)).toBeDefined();
  });
});
