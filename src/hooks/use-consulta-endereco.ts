"use client";

import * as React from "react";
import type { Endereco } from "@/lib/domain/types";
import { esquemaCep } from "@/lib/domain/schemas";
import { camposConsultaveis, mensagensCep, type ResultadoCep } from "@/lib/domain/consulta-cep";
import { buscarEnderecoPorCep } from "@/lib/services/endereco";

export function useConsultaEndereco({
  valores,
  aoMudar,
  habilitado = true,
  identidade,
}: {
  valores: Partial<Endereco>;
  aoMudar: (alteracoes: Partial<Endereco>) => void;
  habilitado?: boolean;
  identidade?: unknown;
}) {
  const [estado, setEstado] = React.useState<"ocioso" | "consultando" | ResultadoCep["status"]>(
    "ocioso",
  );
  const atual = React.useRef({ valores, aoMudar, habilitado });
  React.useLayoutEffect(() => {
    atual.current = { valores, aoMudar, habilitado };
  });
  const sequencia = React.useRef(0);
  const controle = React.useRef<AbortController | null>(null);
  const revisoes = React.useRef<Partial<Record<keyof Endereco, number>>>({});

  const invalidar = React.useCallback(() => {
    sequencia.current++;
    controle.current?.abort();
    controle.current = null;
  }, []);

  React.useLayoutEffect(() => {
    // Identidade cobre a troca de registro e a confirmação do salvamento.
    invalidar();
    return invalidar;
  }, [identidade, habilitado, invalidar]);

  async function consultar(cep = atual.current.valores.cep ?? "") {
    if (!atual.current.habilitado) return;
    invalidar();
    const valido = esquemaCep.safeParse(cep);
    if (!valido.success) {
      setEstado("invalido");
      return;
    }
    const id = sequencia.current;
    const versoes = { ...revisoes.current };
    const abortador = new AbortController();
    controle.current = abortador;
    setEstado("consultando");
    try {
      const resultado = await buscarEnderecoPorCep(valido.data, abortador.signal);
      if (
        id !== sequencia.current ||
        !atual.current.habilitado ||
        esquemaCep.safeParse(atual.current.valores.cep).data !== valido.data
      )
        return;
      if (resultado.status === "encontrado") {
        const alteracoes: Partial<Endereco> = {};
        for (const campo of camposConsultaveis) {
          const valor = resultado.endereco[campo]?.trim();
          if (valor && revisoes.current[campo] === versoes[campo]) alteracoes[campo] = valor;
        }
        atual.current.valores = { ...atual.current.valores, ...alteracoes };
        atual.current.aoMudar(alteracoes);
      }
      setEstado(resultado.status);
    } catch {
      if (id === sequencia.current && !abortador.signal.aborted) setEstado("indisponivel");
    }
  }

  function mudar(campo: keyof Endereco, valor: string) {
    if (!atual.current.habilitado) return;
    const anterior = atual.current.valores[campo] ?? "";
    revisoes.current[campo] = (revisoes.current[campo] ?? 0) + 1;
    atual.current.valores = { ...atual.current.valores, [campo]: valor };
    atual.current.aoMudar({ [campo]: valor });
    if (campo === "cep" && anterior.replace(/\D/g, "") !== valor.replace(/\D/g, "")) {
      invalidar();
      setEstado("ocioso");
      if (esquemaCep.safeParse(valor).success) void consultar(valor);
    }
  }

  return {
    mudar,
    consultar,
    invalidar: () => {
      invalidar();
      setEstado("ocioso");
    },
    estado,
    mensagem: estado === "ocioso" ? "" : mensagensCep[estado],
    carregando: estado === "consultando",
  };
}
