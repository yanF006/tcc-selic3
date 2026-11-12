import { camposDoTemplate } from "@/lib/templates/descriptors";
import { idsDoGrupo } from "@/lib/templates/grupos-endereco";
import { descritorDaVersao } from "./templates";

const CAMPOS_PRESERVADOS_NO_HISTORICO = [
  "nomeCompleto",
  "aluno",
  "curso",
  "turma",
  "periodo",
  "ano",
  "semestre",
  "anoSemestre",
  "turmaSemestreAno",
  "campus",
];

const CAMPOS_PESSOAIS_DIRETOS = [
  "cpf",
  "rg",
  "dataNascimento",
  "matricula",
  "enderecoAluno",
  "cepAluno",
  "telefoneAluno",
  "celularAluno",
  "emailAluno",
];

/**
 * Remove do preenchimento os dados pessoais do aluno que não fazem parte do
 * histórico permitido do estágio. Usado pelas exclusões em ambos os modos de
 * persistência, para que a regra exista em um único lugar.
 */
export function valoresSemDadosDoAluno(
  templateId: string,
  versaoTemplate: number,
  valoresOriginais: Record<string, unknown>,
): Record<string, unknown> {
  const valores = { ...valoresOriginais };
  const descriptor = descritorDaVersao(templateId, versaoTemplate);
  for (const campo of camposDoTemplate(templateId, descriptor)) {
    if (campo.origem === "aluno" && !CAMPOS_PRESERVADOS_NO_HISTORICO.includes(campo.fonte || campo.id))
      delete valores[campo.id];
  }
  for (const id of CAMPOS_PESSOAIS_DIRETOS) delete valores[id];
  for (const grupo of descriptor?.gruposEndereco ?? []) {
    if (grupo.origemInicial === "aluno") for (const id of idsDoGrupo(grupo)) delete valores[id];
  }
  return valores;
}
