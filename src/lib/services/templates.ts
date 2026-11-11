import type { Usuario } from "@/lib/domain/types";
import { descritorPorTemplate, type CampoDescriptor, type DescriptorDocumento } from "@/lib/templates/descriptors";
import { bancoConfigurado } from "@/lib/db/prisma";
import { definicaoKit } from "@/lib/templates/manifesto";
import { obterEstado } from "./store";
import { ErroDeRegra } from "./erros";

export function descritorDaVersao(templateId: string, versao?: number): DescriptorDocumento | undefined {
  if (bancoConfigurado()) {
    const definicao = definicaoKit(templateId);
    if (!definicao || (versao !== undefined && !definicao.arquivos.some((arquivo) => arquivo.versao === versao))) return undefined;
    return definicao.descritor;
  }
  const template = obterEstado().templates.find((registro) => registro.id === templateId);
  const registro = versao === undefined
    ? template?.versoes.find((item) => item.vigente)
    : template?.versoes.find((item) => item.versao === versao);
  return registro?.descritor ?? descritorPorTemplate(templateId);
}

function recusarGestao(): never {
  throw new ErroDeRegra("O Kit de Estágio é fixo. Publicação e alteração administrativa de templates não estão disponíveis.", "catalogo_fixo");
}

/** Compatibilidade com chamadas antigas; nenhum caminho publica ou altera o catálogo. */
export async function registrarVersaoTemplate(
  autor: Usuario, templateId: string,
  arquivo: { nome: string; conteudoBase64?: string }, campos: CampoDescriptor[],
): Promise<never> {
  void autor; void templateId; void arquivo; void campos;
  return recusarGestao();
}

export async function alterarTemplate(autor: Usuario, templateId: string, operacao: "inativar" | "ativar" | "excluir"): Promise<never> {
  void autor; void templateId; void operacao;
  return recusarGestao();
}
