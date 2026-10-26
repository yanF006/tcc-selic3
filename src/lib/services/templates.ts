import { z } from "zod";
import type { Usuario } from "@/lib/domain/types";
import {
  camposDoTemplate,
  descritorPorTemplate,
  FONTES_ALUNO,
  FONTES_ESTAGIO,
  type CampoDescriptor,
  type DescriptorDocumento,
} from "@/lib/templates/descriptors";
import { idsDoGrupo } from "@/lib/templates/grupos-endereco";
import { exigirGestaoCadastros } from "./cadastros";
import { ErroDeRegra } from "./erros";
import { agora, obterEstado } from "./store";

export function descritorDaVersao(
  templateId: string,
  versao?: number,
): DescriptorDocumento | undefined {
  const template = obterEstado().templates.find((registro) => registro.id === templateId);
  const registro =
    versao === undefined
      ? template?.versoes.find((registro) => registro.vigente)
      : template?.versoes.find((registro) => registro.versao === versao);
  return registro?.descritor ?? descritorPorTemplate(templateId);
}

const mascara = z.enum([
  "cpf",
  "rg",
  "celular",
  "telefone",
  "telefoneOuCelular",
  "cep",
  "data",
  "horas",
  "hora",
]);
const regra = z.enum([
  "cpf",
  "rg",
  "email",
  "telefone",
  "celular",
  "cep",
  "data",
  "hora",
  "intervalo_datas",
  "numero",
  "limite_palavras",
]);
const esquemaCampo = z
  .object({
    id: z.string().trim().min(1, "Informe a chave do campo."),
    rotulo: z.string().trim().min(1, "Informe o rótulo do campo."),
    tipo: z.enum([
      "texto",
      "textarea",
      "numero",
      "data",
      "hora",
      "select",
      "radio",
      "checkbox",
      "arquivo",
      "assinatura",
      "grade",
      "auto",
      "fixo",
      "instrucao",
    ]),
    origem: z.enum(["aluno", "estagio", "literal", "digitado"]),
    fonte: z.string().optional(),
    parecer: z.enum(["decisao", "consideracoes", "data"]).optional(),
    obrigatorio: z.boolean().optional(),
    mascara: mascara.optional(),
    validacao: z.array(regra).optional(),
    opcoes: z
      .array(
        z.object({ valor: z.string(), rotulo: z.string(), exigeAnexo: z.boolean().optional() }),
      )
      .optional(),
    colunas: z
      .array(
        z.object({
          chave: z.string().min(1),
          rotulo: z.string().min(1),
          tipo: z.enum(["texto", "data", "hora", "numero"]),
          mascara: mascara.optional(),
          automatica: z.boolean().optional(),
          largura: z.string().optional(),
        }),
      )
      .optional(),
    maximoPalavras: z.number().int().positive().optional(),
    maximoCaracteres: z.number().int().positive().optional(),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    minimo: z.number().finite().optional(),
    maximo: z.number().finite().optional(),
    passo: z.number().positive().optional(),
    linhas: z.number().int().positive().optional(),
    ajuda: z.string().optional(),
    largura: z.enum(["completa", "meia", "terco", "quarto"]).optional(),
    maximoLinhas: z.number().int().positive().optional(),
    totalAutomatico: z.boolean().optional(),
    somenteLeitura: z.boolean().optional(),
    faixa: z.boolean().optional(),
  })
  .superRefine((campo, ctx) => {
    if (campo.parecer && campo.origem !== "digitado")
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["origem"],
        message:
          "Campos de parecer são preenchidos pela coordenação, não pelo cadastro do aluno ou estágio.",
      });
    const fontes =
      campo.origem === "aluno" ? FONTES_ALUNO : campo.origem === "estagio" ? FONTES_ESTAGIO : null;
    if (fontes && !campo.parecer && !fontes.includes(campo.fonte || campo.id))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fonte"],
        message: `Campo ${campo.rotulo} (${campo.id}): selecione um dado de origem cadastrado para o preenchimento automático.`,
      });
    if (["select", "radio"].includes(campo.tipo) && !campo.opcoes?.length)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["opcoes"],
        message: "Campos de seleção precisam de opções.",
      });
    if (campo.tipo === "grade" && !campo.colunas?.length)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["colunas"],
        message: "Informe as colunas da grade.",
      });
  });

export async function registrarVersaoTemplate(
  autor: Usuario,
  templateId: string,
  arquivo: { nome: string; conteudoBase64?: string },
  campos: CampoDescriptor[],
) {
  exigirGestaoCadastros(autor);
  const template = obterEstado().templates.find((registro) => registro.id === templateId);
  if (!template || template.tipo !== "preenchivel")
    throw new ErroDeRegra("Selecione um template preenchível cadastrado.", "template_invalido");
  if (!/\.docx$/i.test(arquivo.nome))
    throw new ErroDeRegra("O arquivo do template deve estar no formato .docx.", "formato_invalido");
  const validados = z.array(esquemaCampo).min(1, "Informe os campos do template.").parse(campos);
  if (new Set(validados.map((campo) => campo.id)).size !== validados.length)
    throw new ErroDeRegra("As chaves dos campos devem ser únicas.", "campo_duplicado");
  const anterior = descritorDaVersao(templateId);
  if (!anterior)
    throw new ErroDeRegra("Descritor do template não encontrado.", "template_invalido");
  const originais = camposDoTemplate(templateId, anterior);
  const porId = new Map(validados.map((campo) => [campo.id, campo]));
  const existentes = new Set(originais.map((campo) => campo.id));
  const descritor: DescriptorDocumento = {
    ...structuredClone(anterior),
    auto: anterior.auto
      ?.map((campo) => porId.get(campo.id))
      .filter((campo): campo is CampoDescriptor => Boolean(campo)),
    secoes: anterior.secoes.map((secao) => ({
      ...secao,
      campos: secao.campos
        .map((campo) => porId.get(campo.id))
        .filter((campo): campo is CampoDescriptor => Boolean(campo)),
    })),
    gruposEndereco: anterior.gruposEndereco?.filter((grupo) =>
      idsDoGrupo(grupo).every((id) => porId.has(id)),
    ),
  };
  const adicionais = validados.filter((campo) => !existentes.has(campo.id));
  if (adicionais.length) {
    const secao = descritor.secoes.find((registro) => registro.id === "campos-adicionais");
    if (secao) secao.campos.push(...adicionais);
    else
      descritor.secoes.push({
        id: "campos-adicionais",
        titulo: "Campos adicionais",
        campos: adicionais,
      });
  }
  for (const versao of template.versoes) {
    versao.descritor ??= structuredClone(anterior);
    versao.vigente = false;
  }
  const nova = {
    versao: Math.max(0, ...template.versoes.map((registro) => registro.versao)) + 1,
    arquivo: arquivo.nome.split(/[\\/]/).at(-1)!,
    registradaEm: agora(),
    vigente: true,
    descritor,
    conteudoBase64: arquivo.conteudoBase64,
  };
  template.versoes.push(nova);
  return nova;
}

export async function alterarTemplate(
  autor: Usuario,
  templateId: string,
  operacao: "inativar" | "ativar" | "excluir",
) {
  exigirGestaoCadastros(autor);
  const estado = obterEstado();
  const template = estado.templates.find((registro) => registro.id === templateId);
  if (!template) throw new ErroDeRegra("Template não encontrado.", "nao_encontrado");
  if (operacao === "excluir") {
    if (estado.documentos.some((doc) => doc.templateId === templateId))
      throw new ErroDeRegra(
        "Template possui documentos gerados. Use a inativação para preservar o histórico.",
        "template_com_vinculos",
      );
    estado.templates = estado.templates.filter((registro) => registro.id !== templateId);
  } else if (operacao === "inativar" || operacao === "ativar")
    template.situacao = operacao === "ativar" ? "ativo" : "inativo";
  else throw new ErroDeRegra("Operação inválida.", "operacao_invalida");
}

export async function templatesParaGestao(autor: Usuario) {
  exigirGestaoCadastros(autor);
  return obterEstado()
    .templates.filter((template) => template.tipo === "preenchivel")
    .map((template) => ({
      ...template,
      versoes: template.versoes.map((versao) => ({
        versao: versao.versao,
        arquivo: versao.arquivo,
        registradaEm: versao.registradaEm,
        vigente: versao.vigente,
      })),
      descritor: descritorDaVersao(template.id)!,
      totalDocumentos: obterEstado().documentos.filter((doc) => doc.templateId === template.id)
        .length,
    }));
}
