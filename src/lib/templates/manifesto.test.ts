import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { definicaoKit, lerArquivoKit, templatesFixos, checksumDefinicao } from "./manifesto";
import { catalogoDocumentos, listarTemplates, templatePorId } from "@/lib/services/documentos";
import { descritorDaVersao } from "@/lib/services/templates";
import * as store from "@/lib/services/store";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("manifesto fixo do Kit", () => {
  it("identifica os 12 documentos e verifica os 14 arquivos oficiais por checksum", async () => {
    const catalogo = templatesFixos();
    expect(catalogo).toHaveLength(12);
    expect(catalogo.filter((item) => item.tipo === "download")).toHaveLength(2);
    expect(catalogo.filter((item) => item.tipo === "preenchivel")).toHaveLength(10);
    let arquivos = 0;
    for (const template of catalogo) {
      const definicao = definicaoKit(template.id)!;
      expect(definicao.descritor.templateId).toBe(template.id);
      expect(definicao.checksum).toMatch(/^[a-f0-9]{64}$/);
      for (const arquivo of definicao.arquivos) {
        const recebido = await lerArquivoKit(template.id, arquivo.versao);
        expect(recebido.conteudo.byteLength).toBeGreaterThan(0);
        expect(recebido.checksum).toBe(arquivo.checksum);
        arquivos++;
      }
    }
    expect(arquivos).toBe(14);
  });

  it("recusa definição, versão, arquivo ausente e conteúdo divergente", async () => {
    await expect(lerArquivoKit("../../.env")).rejects.toMatchObject({ codigo: "definicao_kit_ausente" });
    await expect(lerArquivoKit("tpl-lei-estagio", 999)).rejects.toMatchObject({ codigo: "arquivo_kit_indisponivel" });
    const temporario = await fs.mkdtemp(join(tmpdir(), "selic-kit-"));
    vi.spyOn(process, "cwd").mockReturnValue(temporario);
    try {
      await expect(lerArquivoKit("tpl-lei-estagio")).rejects.toMatchObject({ codigo: "arquivo_kit_indisponivel" });
      const pasta = join(temporario, "Contexto/kit-estagio");
      await fs.mkdir(pasta, { recursive: true });
      await fs.writeFile(join(pasta, "01 - Lei de Estágio 11788.pdf"), "conteúdo divergente");
      await expect(lerArquivoKit("tpl-lei-estagio")).rejects.toMatchObject({ codigo: "arquivo_kit_indisponivel" });
    } finally {
      vi.restoreAllMocks();
      await fs.rm(temporario, { recursive: true, force: true });
    }
  });

  it("consulta o catálogo persistente sem ler fixtures e entrega cópias isoladas", async () => {
    vi.stubEnv("SELIC_PERSISTENCIA", "persistente");
    vi.stubEnv("DATABASE_URL", "mysql://teste:teste@127.0.0.1:33306/selic_teste_app");
    vi.spyOn(store, "obterEstado").mockImplementation(() => { throw new Error("Fixtures proibidas."); });
    expect(await listarTemplates("download")).toHaveLength(2);
    const catalogo = await catalogoDocumentos();
    expect(catalogo.filter((item) => item.tipo === "preenchivel")).toHaveLength(10);
    const template = await templatePorId("tpl-lei-estagio");
    template!.nome = "Mutação local";
    expect((await templatePorId("tpl-lei-estagio"))?.nome).toBe("Lei de Estágio");
    const descritor = descritorDaVersao("tpl-termo-compromisso", 2)!;
    const hash = checksumDefinicao(descritor);
    descritor.titulo = "Mutação local";
    expect(checksumDefinicao(descritorDaVersao("tpl-termo-compromisso", 2))).toBe(hash);
    expect(descritorDaVersao("tpl-termo-compromisso", 999)).toBeUndefined();
    expect(checksumDefinicao({ a: 1, b: 2 })).toBe(checksumDefinicao({ b: 2, a: 1 }));
  });
});
