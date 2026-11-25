import {
  esquemaCelular,
  esquemaCep,
  esquemaCpf,
  esquemaData,
  esquemaEmail,
  esquemaRg,
  esquemaTelefone,
} from "@/lib/domain/schemas";

import {
  camposDoTemplate,
  classificacaoDoCampo,
  fonteParecer,
  type DescriptorDocumento,
} from "./descriptors";
import { enderecoDoGrupo, estruturaSuficiente } from "./grupos-endereco";

const ESQUEMAS = {
  cpf: esquemaCpf,
  rg: esquemaRg,
  email: esquemaEmail,
  telefone: esquemaTelefone,
  celular: esquemaCelular,
  cep: esquemaCep,
  data: esquemaData,
} as const;

function vazio(valor: unknown): boolean {
  return (
    valor === undefined ||
    valor === null ||
    valor === false ||
    String(valor).trim() === "" ||
    (Array.isArray(valor) && valor.length === 0)
  );
}

/**
 * Rótulos dos campos que o usuário ainda precisa preencher (ou corrigir) no
 * documento. Só olha os campos digitáveis: dados automáticos do cadastro e do
 * estágio não dependem de quem está preenchendo. Usado no passo a passo dos
 * documentos iniciais para liberar o botão "Próximo" (Problema006).
 */
export function pendenciasDoDocumento(
  descriptor: DescriptorDocumento,
  valores: Record<string, unknown>,
): string[] {
  const pendencias: string[] = [];
  const grupos = descriptor.gruposEndereco ?? [];
  // O endereço composto é montado pelo servidor a partir de logradouro e
  // número, então a pendência é avaliada pelos componentes do grupo.
  const compostos = new Map(grupos.map((grupo) => [grupo.composto, grupo]));

  for (const campo of camposDoTemplate(descriptor.templateId, descriptor)) {
    const grupo = compostos.get(campo.id);
    if (grupo) {
      const endereco = enderecoDoGrupo(grupo, valores);
      const preenchido = estruturaSuficiente(endereco) || !vazio(valores[campo.id]);
      if (campo.obrigatorio && !preenchido) pendencias.push(grupo.rotulo);
      continue;
    }
    if (classificacaoDoCampo(campo) !== "campo") continue;
    if (campo.tipo === "assinatura") continue;
    if (campo.origem !== "digitado" || campo.somenteLeitura) continue;
    if (fonteParecer(descriptor.templateId, campo)) continue;

    const valor = valores[campo.id];

    if (vazio(valor)) {
      if (campo.obrigatorio) pendencias.push(campo.rotulo);
      continue;
    }

    if (campo.tipo === "numero") {
      const numero = typeof valor === "number" ? valor : Number(valor);
      const foraDaFaixa =
        !Number.isFinite(numero) ||
        (campo.min !== undefined && numero < campo.min) ||
        (campo.max !== undefined && numero > campo.max);

      if (foraDaFaixa) pendencias.push(campo.rotulo);
      continue;
    }

    const invalido = (campo.validacao ?? []).some(
      (regra) =>
        regra in ESQUEMAS && !ESQUEMAS[regra as keyof typeof ESQUEMAS].safeParse(valor).success,
    );

    if (invalido) pendencias.push(campo.rotulo);
  }

  return [...new Set(pendencias)];
}
