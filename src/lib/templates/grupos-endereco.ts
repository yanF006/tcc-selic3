import type { Endereco } from "@/lib/domain/types";
import type { CampoDescriptor, DescriptorDocumento } from "./descriptors";

export interface GrupoEndereco {
  id: string;
  rotulo: string;
  origemInicial: "aluno" | "concedente";
  campos: Record<keyof Endereco, string>;
  composto: string;
}

function grupo(
  id: string,
  rotulo: string,
  origemInicial: GrupoEndereco["origemInicial"],
  composto: string,
  sufixo = "",
): GrupoEndereco {
  return {
    id,
    rotulo,
    origemInicial,
    composto,
    campos: {
      cep: `cep${sufixo}`,
      logradouro: `logradouro${sufixo}`,
      numero: `numero${sufixo}`,
      complemento: `complemento${sufixo}`,
      bairro: `bairro${sufixo}`,
      cidade: `cidade${sufixo}`,
      estado: `uf${sufixo}`,
    },
  };
}

const instituicao = grupo(
  "instituicao",
  "Endereço da instituição",
  "concedente",
  "instituicaoEndereco",
);
instituicao.campos = {
  cep: "instituicaoCep",
  logradouro: "instituicaoLogradouro",
  numero: "instituicaoNumero",
  complemento: "instituicaoComplemento",
  bairro: "instituicaoBairro",
  cidade: "instituicaoCidade",
  estado: "instituicaoUf",
};

export const GRUPOS_ENDERECO: Record<string, GrupoEndereco[]> = {
  "tpl-formulario-liberacao": [
    grupo("aluno", "Endereço do aluno", "aluno", "enderecoAluno", "Aluno"),
    grupo("local", "Endereço do local de estágio", "concedente", "enderecoLocal", "Local"),
  ],
  "tpl-convenio-estagio": [grupo("concedente", "Endereço da concedente", "concedente", "endereco")],
  "tpl-termo-compromisso": [
    grupo("concedente", "Endereço da concedente", "concedente", "endereco"),
  ],
  "tpl-ficha-frequencia": [grupo("concedente", "Endereço da concedente", "concedente", "endereco")],
  "tpl-relatorio-semestral": [
    grupo("aluno", "Endereço do aluno", "aluno", "endereco"),
    instituicao,
  ],
};

const rotulos: Record<keyof Endereco, string> = {
  cep: "CEP",
  logradouro: "Logradouro",
  numero: "Número",
  complemento: "Complemento",
  bairro: "Bairro",
  cidade: "Cidade",
  estado: "UF",
};

/** Acrescenta os campos sem renomear/remover chaves legadas ou mudar obrigatoriedade. */
export function comGruposEndereco(descritores: DescriptorDocumento[]): DescriptorDocumento[] {
  return descritores.map((descritor) => {
    const grupos = GRUPOS_ENDERECO[descritor.templateId];
    if (!grupos) return descritor;
    for (const grupo of grupos) {
      const todos = [
        ...(descritor.auto ?? []),
        ...descritor.secoes.flatMap((secao) => secao.campos),
      ];
      const destino = descritor.auto?.some((campo) => campo.id === grupo.composto)
        ? descritor.auto
        : descritor.secoes.find((secao) =>
            secao.campos.some((campo) => campo.id === grupo.composto),
          )!.campos;
      for (const [chave, id] of Object.entries(grupo.campos) as [keyof Endereco, string][]) {
        const existente = todos.find((campo) => campo.id === id);
        const campo: CampoDescriptor = existente ?? {
          id,
          rotulo: rotulos[chave],
          tipo: "texto",
          origem: "digitado",
          largura: "meia",
        };
        if (chave === "cep") {
          campo.mascara = "cep";
          campo.validacao = ["cep"];
        }
        if (!existente) destino!.push(campo);
      }
    }
    return { ...descritor, gruposEndereco: grupos };
  });
}

export function idsDoGrupo(grupo: GrupoEndereco) {
  return [grupo.composto, ...Object.values(grupo.campos)];
}

export function enderecoDoGrupo(grupo: GrupoEndereco, valores: Record<string, unknown>): Endereco {
  return Object.fromEntries(
    Object.entries(grupo.campos).map(([chave, id]) => [
      chave,
      typeof valores[id] === "string" ? valores[id] : "",
    ]),
  ) as unknown as Endereco;
}

export function estruturaSuficiente(endereco: Partial<Endereco>): boolean {
  return Boolean(endereco.logradouro?.trim() && endereco.numero?.trim());
}

export function formatarEndereco(endereco: Partial<Endereco>): string {
  return [endereco.logradouro, endereco.numero, endereco.complemento, endereco.bairro]
    .filter((valor) => valor?.trim())
    .join(", ");
}
