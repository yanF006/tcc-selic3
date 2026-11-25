import type { Endereco } from "@/lib/domain/types";
import { DESCRITORES, type DescriptorDocumento } from "./descriptors";
import {
  GRUPOS_ENDERECO,
  enderecoDoGrupo,
  estruturaSuficiente,
  formatarEndereco,
  idsDoGrupo,
} from "./grupos-endereco";

/** Documento preenchido pela coordenação ao cadastrar o convênio. */
export const TEMPLATE_CONVENIO = "tpl-convenio-estagio";

/**
 * Campos de outros documentos que repetem dados da concedente registrados no
 * Convênio de Estágio: `campo do documento` → `campo do convênio`. O endereço
 * segue os grupos de endereço de origem "concedente".
 */
const CAMPOS_DO_CONVENIO: Record<string, Record<string, string>> = {
  "tpl-termo-compromisso": {
    cnpj: "cnpj",
    responsavel: "responsavel",
    telefone: "telefone",
    email: "email",
    fax: "fax",
  },
  "tpl-ficha-frequencia": {
    nomeFantasia: "nomeFantasia",
    telefone: "telefone",
    ramal: "ramal",
    fax: "fax",
    email: "email",
  },
  "tpl-relatorio-semestral": {
    instituicaoTelefone: "telefone",
    instituicaoEmail: "email",
  },
};

function vazio(valor: unknown) {
  return valor === undefined || valor === null || String(valor).trim() === "";
}

/** Endereço da concedente gravado no documento do convênio. */
function enderecoDoConvenio(dados: Record<string, unknown>): Endereco | null {
  const grupo = GRUPOS_ENDERECO[TEMPLATE_CONVENIO]?.[0];
  if (!grupo) return null;
  const endereco = enderecoDoGrupo(grupo, dados);
  return Object.values(endereco).some((valor) => !vazio(valor)) ? endereco : null;
}

/**
 * Completa os campos ainda vazios do documento com os dados do convênio. O
 * que o aluno já digitou é preservado; um grupo de endereço só é preenchido
 * quando todos os seus campos estão vazios, para não misturar dois endereços.
 */
export function completarComConvenio(
  templateId: string,
  valores: Record<string, unknown>,
  dadosConvenio: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!dadosConvenio || templateId === TEMPLATE_CONVENIO) return valores;
  const resultado = { ...valores };
  for (const [destino, origem] of Object.entries(CAMPOS_DO_CONVENIO[templateId] ?? {})) {
    if (vazio(resultado[destino]) && !vazio(dadosConvenio[origem]))
      resultado[destino] = dadosConvenio[origem];
  }
  const endereco = enderecoDoConvenio(dadosConvenio);
  if (!endereco) return resultado;
  for (const grupo of GRUPOS_ENDERECO[templateId] ?? []) {
    if (grupo.origemInicial !== "concedente") continue;
    if (!idsDoGrupo(grupo).every((id) => vazio(resultado[id]))) continue;
    for (const [chave, id] of Object.entries(grupo.campos) as [keyof Endereco, string][])
      resultado[id] = endereco[chave] ?? "";
    resultado[grupo.composto] = estruturaSuficiente(endereco) ? formatarEndereco(endereco) : "";
  }
  return resultado;
}

/**
 * Parte do Convênio de Estágio preenchida no cadastro: dados da concedente e
 * início da vigência. O fim (início + 5 anos) e as renovações são do sistema;
 * cláusulas e assinaturas ficam no documento impresso.
 */
export function descritorCadastroConvenio(): DescriptorDocumento {
  const original = DESCRITORES.find((descritor) => descritor.templateId === TEMPLATE_CONVENIO)!;
  return {
    ...original,
    observacao: undefined,
    secoes: original.secoes
      .filter((secao) => secao.id === "instituicao" || secao.id === "vigencia")
      .map((secao) => ({
        ...secao,
        descricao:
          secao.id === "vigencia"
            ? "O convênio vale por 5 anos a partir do início da vigência."
            : secao.descricao,
        campos: secao.campos.filter((campo) => campo.id !== "renovacoes"),
      })),
  };
}
