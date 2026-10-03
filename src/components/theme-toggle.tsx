"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { TEMAS, resolverTema, temaDoSistema, type TemaPreferido } from "@/lib/design/tema";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ICONES = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
} as const;

/** Acompanha a preferência do sistema para a opção Sistema (2.4). */
function usePreferenciaDoSistema() {
  return React.useSyncExternalStore(
    (ouvinte) => {
      const consulta = window.matchMedia("(prefers-color-scheme: dark)");
      consulta.addEventListener("change", ouvinte);
      return () => consulta.removeEventListener("change", ouvinte);
    },
    () => temaDoSistema(window.matchMedia("(prefers-color-scheme: dark)").matches),
    () => "light" as const,
  );
}

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const preferenciaDoSistema = usePreferenciaDoSistema();
  const montado = React.useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const preferencia: TemaPreferido = TEMAS.some((opcao) => opcao.valor === theme)
    ? (theme as TemaPreferido)
    : "system";
  const temaAtivo = montado ? resolverTema(preferencia, preferenciaDoSistema) : "light";
  const preferenciaAtiva = montado ? preferencia : undefined;
  const IconeAtivo = ICONES[temaAtivo];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Alterar tema">
          <IconeAtivo className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {TEMAS.map(({ valor, rotulo }) => {
          const Icone = ICONES[valor];

          return (
            <DropdownMenuItem
              key={valor}
              onSelect={() => setTheme(valor)}
              className="justify-between"
              data-valor-tema={valor}
            >
              <span className="flex items-center gap-2">
                <Icone className="size-4" />
                {rotulo}
              </span>
              {preferenciaAtiva === valor ? (
                <span aria-hidden="true" className="text-muted-foreground text-xs">
                  ativo
                </span>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
