"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const opcoes = [
  { valor: "light", rotulo: "Claro", Icone: SunIcon },
  { valor: "dark", rotulo: "Escuro", Icone: MoonIcon },
  { valor: "system", rotulo: "Sistema", Icone: MonitorIcon },
] as const;

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const montado = React.useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Alterar tema">
          {!montado ? (
            <span className="size-4" />
          ) : resolvedTheme === "dark" ? (
            <MoonIcon className="size-4" />
          ) : (
            <SunIcon className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {opcoes.map(({ valor, rotulo, Icone }) => (
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
            {montado && resolvedTheme === valor ? (
              <span aria-hidden="true" className="text-muted-foreground text-xs">
                ativo
              </span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
