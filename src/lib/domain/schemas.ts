import { z } from "zod";

import { dataParaIso, diasEntre } from "@/lib/format";

/**
 * Esquemas reutilizáveis (D7). São os mesmos objetos que o backend vai
 * importar, porque o `Contexto/visaoGeral.md` exige as mesmas validações no
 * frontend e no servidor.
 */

export const SOMENTE_DIGITOS = /^\d+$/;

/** Remove a máscara antes de validar. */
export function aoValidar(formato?: "cpf" | "data" | "numero") {
  return (valor: string) => {
    if (formato === "cpf") return valor.replace(/\D/g, "");
    if (formato === "data") return dataParaIso(valor) ?? valor;
    if (formato === "numero") return valor.replace(/\D/g, "");

    return valor;
  };
}

/* ------------------------------------------------------------------ */
/* CPF com dígito verificador                                        */
/* ------------------------------------------------------------------ */

export function cpfValido(valor: string): boolean {
  const cpf = valor.replace(/\D/g, "");

  if (cpf.length !== 11) return false;

  // Dígitos repetidos (000..., 111...) passam no cálculo e são recusados aqui.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digitos = cpf.split("").map(Number);

  for (const [tamanho, posicao] of [
    [9, 9],
    [10, 10],
  ] as const) {
    let soma = 0;

    for (let i = 0; i < tamanho; i += 1) {
      soma += digitos[i] * (tamanho + 1 - i);
    }

    const resto = (soma * 10) % 11;
    const digito = resto === 10 ? 0 : resto;

    if (digito !== digitos[posicao]) return false;
  }

  return true;
}

export const esquemaCpf = z
  .string()
  .min(1, "Informe o CPF.")
  .transform((valor) => valor.replace(/\D/g, ""))
  .refine((valor) => valor.length === 11, "O CPF deve ter 11 dígitos.")
  .refine(cpfValido, "CPF inválido.");

/* ------------------------------------------------------------------ */
/* Contato                                                            */
/* ------------------------------------------------------------------ */

export const esquemaEmail = z
  .string()
  .trim()
  .min(1, "Informe o e-mail.")
  .toLowerCase()
  .email("E-mail inválido.")
  .max(120, "O e-mail é muito longo.");

export const esquemaTelefone = z
  .string()
  .min(1, "Informe o telefone.")
  .transform((valor) => valor.replace(/\D/g, ""))
  .refine((valor) => valor.length === 10, "Informe DDD e número com 8 dígitos.")
  .refine((valor) => SOMENTE_DIGITOS.test(valor), "Telefone inválido.");

export const esquemaCelular = z
  .string()
  .min(1, "Informe o celular.")
  .transform((valor) => valor.replace(/\D/g, ""))
  .refine((valor) => valor.length === 11, "Informe DDD e número com 9 dígitos, começando por 9.")
  .refine((valor) => valor[2] === "9", "O celular deve começar por 9 depois do DDD.");

export const esquemaCep = z
  .string()
  .min(1, "Informe o CEP.")
  .transform((valor) => valor.replace(/\D/g, ""))
  .refine((valor) => valor.length === 8, "O CEP deve ter 8 dígitos.");

export const esquemaRg = z
  .string()
  .min(1, "Informe o RG.")
  .transform((valor) => valor.replace(/\D/g, ""))
  .refine((valor) => valor.length >= 7 && valor.length <= 9, "RG inválido.");

export const esquemaData = z
  .string()
  .min(1, "Informe a data.")
  .transform((valor, ctx) => {
    const iso = dataParaIso(valor);

    if (!iso) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Data inválida." });

      return z.NEVER;
    }

    return iso;
  });

export const esquemaSenha = z
  .string()
  .min(8, "A senha deve ter ao menos 8 caracteres.")
  .max(72, "A senha deve ter no máximo 72 caracteres.");

/* ------------------------------------------------------------------ */
/* Endereço e seleção de curso                                        */
/* ------------------------------------------------------------------ */

export const esquemaEndereco = z.object({
  cep: esquemaCep,
  logradouro: z.string().min(1, "Informe o logradouro."),
  numero: z.string().min(1, "Informe o número."),
  complemento: z.string().optional().or(z.literal("")),
  bairro: z.string().min(1, "Informe o bairro."),
  cidade: z.string().min(1, "Informe a cidade."),
  estado: z
    .string()
    .length(2, "Use a sigla do estado.")
    .transform((valor) => valor.toUpperCase()),
});

/** Curso, turma e período são selects: o valor precisa estar entre os cadastrados. */
export function esquemaIdCadastrado(opcoes: readonly string[], rotulo: string, mensagem?: string) {
  return z
    .string()
    .min(1, `Selecione ${rotulo}.`)
    .refine((valor) => opcoes.includes(valor), mensagem ?? `Selecione ${rotulo} cadastrado.`);
}

/* ------------------------------------------------------------------ */
/* Dados pessoais do aluno                                            */
/* ------------------------------------------------------------------ */

export interface OpcoesSelecao {
  cursosIds: readonly string[];
  turmasPorCurso: Readonly<Record<string, readonly string[]>>;
  periodosIds: readonly string[];
}

export function esquemaDadosPessoais(opcoes: OpcoesSelecao) {
  return z
    .object({
      nomeCompleto: z.string().min(3, "Informe o nome completo."),
      cpf: esquemaCpf,
      rg: esquemaRg,
      dataNascimento: esquemaData,
      email: esquemaEmail,
      telefone: esquemaTelefone,
      celular: esquemaCelular,
      endereco: esquemaEndereco,
      cursoId: esquemaIdCadastrado(opcoes.cursosIds, "o curso"),
      turmaId: z.string().min(1, "Selecione a turma."),
      periodoId: esquemaIdCadastrado(opcoes.periodosIds, "o período"),
    })
    .superRefine((dados, ctx) => {
      const turmasDoCurso = opcoes.turmasPorCurso[dados.cursoId] ?? [];

      if (!turmasDoCurso.includes(dados.turmaId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["turmaId"],
          message: "A turma não pertence ao curso selecionado.",
        });
      }
    });
}

/* ------------------------------------------------------------------ */
/* Estágio                                                            */
/* ------------------------------------------------------------------ */

export const esquemaSituacaoEstagio = z.enum(["em_andamento", "concluido"]);

export function esquemaEstagio(opcoes: { dirname?: () => string } = {}) {
  return z
    .object({
      convenioId: z.string().min(1, "Selecione a instituição."),
      supervisorId: z.string().min(1, "Selecione o supervisor."),
      orientadorId: z.string().min(1, "Selecione o orientador."),
      dataInicio: esquemaData,
      dataFim: esquemaData,
      situacao: esquemaSituacaoEstagio,
    })
    .superRefine((dados, ctx) => {
      if (diasEntre(dados.dataInicio, dados.dataFim) < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dataFim"],
          message: "A data final deve ser igual ou posterior à data inicial.",
        });
      }

      const hoje = opcoes.dirname ? opcoes.dirname() : new Date().toISOString().slice(0, 10);

      if (dados.situacao === "concluido" && dados.dataFim > hoje) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dataFim"],
          message: "Estágio concluído não pode ter data final futura.",
        });
      }
    });
}

/* ------------------------------------------------------------------ */
/* Lançamento de horas                                                */
/* ------------------------------------------------------------------ */

export const LIMITE_HORAS_DIA = 6;
export const LIMITE_HORAS_SEMANA = 30;
export const INTERVALO_ALMOCO = 1;

export const esquemaLancamentoHoras = z.object({
  data: esquemaData,
  entrada: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Informe a entrada no formato 08:00."),
  saida: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Informe a saída no formato 17:00."),
  almocoDesligado: z.boolean(),
});

/** Converte horário "HH:MM" em minutos. */
export function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);

  return h * 60 + m;
}

/**
 * Horas trabalhadas do dia, já descontando o intervalo de almoço quando o
 * aluno o desligou (limite de 6 h do Regulamento de Estágio).
 */
export function calcularHorasDia(entrada: string, saida: string, almocoDesligado: boolean): number {
  const minutos = horaParaMinutos(saida) - horaParaMinutos(entrada);

  if (minutos <= 0) return 0;

  const horas = minutos / 60;

  return almocoDesligado ? Math.max(0, horas - INTERVALO_ALMOCO) : horas;
}

/** Arredonda para meia hora, como a Ficha de Acompanhamento registra. */
export function arredondarMeiaHora(horas: number): number {
  return Math.round(horas * 2) / 2;
}
