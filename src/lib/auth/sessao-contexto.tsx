"use client";

import * as React from "react";

import type { Papel, Usuario } from "@/lib/domain/types";

/**
 * Sessão no cliente (4.6). O layout de servidor já resolveu a sessão pelo cookie
 * e entrega o usuário por aqui; componentes de cliente leem o mesmo estado sem
 * fazer uma segunda consulta. Com Better Auth, este provedor passa a consumir a
 * sessão real.
 */

export interface SessaoCliente {
  usuario: Usuario;
  papeis: Papel[];
  area: "aluno" | "coordenacao" | "admin";
  ehAdministrador: boolean;
}

const ContextoSessao = React.createContext<SessaoCliente | null>(null);

export function ProvedorSessao({
  usuario,
  children,
}: {
  usuario: Usuario;
  children: React.ReactNode;
}) {
  const valor = React.useMemo<SessaoCliente>(() => {
    const area = usuario.papeis.includes("administrador")
      ? "admin"
      : usuario.papeis.some((papel) => papel.startsWith("coordenador"))
        ? "coordenacao"
        : "aluno";

    return {
      usuario,
      papeis: usuario.papeis,
      area,
      ehAdministrador: usuario.papeis.includes("administrador"),
    };
  }, [usuario]);

  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>;
}

/** Sessão do usuário autenticado; null fora das áreas protegidas. */
export function useSessao(): SessaoCliente | null {
  return React.useContext(ContextoSessao);
}
