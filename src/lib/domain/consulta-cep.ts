import { z } from "zod";
import { esquemaCep } from "./schemas";

export const camposConsultaveis = ["logradouro", "bairro", "cidade", "estado"] as const;
export type CampoConsultavel = (typeof camposConsultaveis)[number];

export const esquemaEnderecoPorCep = z
  .object({
    cep: esquemaCep,
    logradouro: z.string().optional(),
    bairro: z.string().optional(),
    cidade: z.string().optional(),
    estado: z.string().optional(),
  })
  .refine((endereco) => camposConsultaveis.some((campo) => endereco[campo]?.trim()));

export type EnderecoPorCep = z.infer<typeof esquemaEnderecoPorCep>;
export const esquemaResultadoCep = z.discriminatedUnion("status", [
  z.object({ status: z.literal("encontrado"), endereco: esquemaEnderecoPorCep }),
  z.object({ status: z.literal("invalido") }),
  z.object({ status: z.literal("nao_encontrado") }),
  z.object({ status: z.literal("indisponivel") }),
]);
export type ResultadoCep = z.infer<typeof esquemaResultadoCep>;

export const mensagensCep = {
  consultando: "Consultando CEP…",
  encontrado: "Endereço preenchido pelo CEP. Você pode corrigir qualquer campo.",
  invalido: "O CEP deve ter 8 dígitos.",
  nao_encontrado: "CEP não encontrado. Confira o número ou preencha o endereço.",
  indisponivel: "Não foi possível consultar o CEP. Preencha o endereço manualmente.",
};
