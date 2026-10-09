"use client";

import * as React from "react";

import { FormularioDocumento } from "@/components/documentos/formulario-documento";
import type { DescriptorDocumento } from "@/lib/templates/descriptors";

/**
 * Formulário de laboratório (8.5): um descritor sintético que reúne todos os
 * tipos de campo observados no Kit de Estágio, para a conferência visual do
 * renderizador sem depender de um documento real.
 */

const DESCRITOR_LABORATORIO: DescriptorDocumento = {
  templateId: "tpl-laboratorio",
  titulo: "Formulário de laboratório",
  descricao: "Todos os tipos de campo do renderizador dirigido pelo descritor.",
  preenchivel: true,
  auto: [
    {
      id: "labAutoPreenchido",
      rotulo: "Campo automático (preenchido)",
      tipo: "auto",
      origem: "aluno",
      somenteLeitura: true,
    },
    {
      id: "labAutoPendente",
      rotulo: "Campo automático (sem dado no cadastro)",
      tipo: "auto",
      origem: "aluno",
      obrigatorio: true,
      somenteLeitura: true,
    },
  ],
  secoes: [
    {
      id: "tipos",
      titulo: "Tipos de campo",
      descricao: "Cada controle abaixo é resolvido a partir do descritor.",
      campos: [
        {
          id: "labTexto",
          rotulo: "Texto",
          tipo: "texto",
          origem: "digitado",
          obrigatorio: true,
          largura: "meia",
        },
        {
          id: "labTextoMascara",
          rotulo: "Texto com máscara (CPF)",
          tipo: "texto",
          origem: "digitado",
          mascara: "cpf",
          validacao: ["cpf"],
          largura: "meia",
        },
        {
          id: "labArea",
          rotulo: "Área de texto com limite de palavras",
          tipo: "textarea",
          origem: "digitado",
          linhas: 3,
          maximoPalavras: 10,
          ajuda: "Escreva até dez palavras para ver o contador.",
        },
        {
          id: "labNumero",
          rotulo: "Número",
          tipo: "numero",
          origem: "digitado",
          min: 0,
          max: 10,
          passo: 0.1,
          largura: "meia",
        },
        { id: "labData", rotulo: "Data", tipo: "data", origem: "digitado", largura: "quarto" },
        { id: "labHora", rotulo: "Hora", tipo: "hora", origem: "digitado", largura: "quarto" },
        {
          id: "labSelect",
          rotulo: "Seleção",
          tipo: "select",
          origem: "digitado",
          largura: "meia",
          opcoes: [
            { valor: "a", rotulo: "Opção A" },
            { valor: "b", rotulo: "Opção B" },
          ],
        },
        {
          id: "labRadio",
          rotulo: "Escolha única",
          tipo: "radio",
          origem: "digitado",
          largura: "meia",
          opcoes: [
            { valor: "sim", rotulo: "Sim" },
            { valor: "nao", rotulo: "Não" },
          ],
        },
        {
          id: "labCheckbox",
          rotulo: "Marcação",
          tipo: "checkbox",
          origem: "digitado",
          ajuda: "Item obrigatório a marcar.",
        },
        {
          id: "labFixo",
          rotulo: "Texto fixo",
          tipo: "fixo",
          origem: "literal",
          ajuda: "Texto que entra no documento final e não é editável.",
        },
        {
          id: "labInstrucao",
          rotulo: "Instrução de preenchimento",
          tipo: "instrucao",
          origem: "literal",
          ajuda: "Texto de orientação que o gerador futuro descarta.",
        },
      ],
    },
    {
      id: "grade",
      titulo: "Grade repetível",
      campos: [
        {
          id: "labGrade",
          rotulo: "Lançamentos",
          tipo: "grade",
          origem: "digitado",
          maximoLinhas: 4,
          totalAutomatico: true,
          ajuda: "A duração é calculada a partir da entrada e da saída.",
          colunas: [
            { chave: "data", rotulo: "Data", tipo: "data", mascara: "data" },
            { chave: "entrada", rotulo: "Entrada", tipo: "hora", mascara: "hora" },
            { chave: "saida", rotulo: "Saída", tipo: "hora", mascara: "hora" },
            { chave: "duracao", rotulo: "Duração (h)", tipo: "numero", automatica: true },
            { chave: "rubrica", rotulo: "Rubrica", tipo: "texto" },
          ],
        },
      ],
    },
    {
      id: "assinaturas",
      titulo: "Assinaturas",
      campos: [
        {
          id: "labAssinatura",
          rotulo: "Assinatura do(a) aluno(a)",
          tipo: "assinatura",
          origem: "digitado",
        },
      ],
    },
  ],
};

export function LaboratorioFormulario() {
  const [valores, setValores] = React.useState<Record<string, unknown>>({
    labAutoPreenchido: "Maria de Souza",
  });

  function aoMudar(campoId: string, valor: unknown) {
    setValores((atual) => ({ ...atual, [campoId]: valor }));
  }

  return (
    <FormularioDocumento descriptor={DESCRITOR_LABORATORIO} valores={valores} aoMudar={aoMudar} />
  );
}
