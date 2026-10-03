"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronsUpDownIcon } from "lucide-react";

import { rotuloPapel } from "@/lib/domain/status";
import type { Usuario } from "@/lib/domain/types";

import { trocarSessaoAction } from "@/app/(publico)/acoes/sessao";

/**
 * Seletor de papel (D3), atrás da flag `NEXT_PUBLIC_SELIC_SELADOR_PAPEL`.
 * Existe para demonstrar as quatro áreas na reunião com a cliente; cada conta
 * troca a sessão por Server Action, sem estado de carregamento no cliente.
 */

export function SeletorPapel({
  contas,
  usuarioAtual,
}: {
  contas: { id: string; nome: string; papeis: Usuario["papeis"] }[];
  usuarioAtual: Usuario;
}) {
  if (!contas.length) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <span className="hidden md:inline">Ver como</span>
          <span>{rotuloPapel(usuarioAtual.papeis[0])}</span>
          <ChevronsUpDownIcon className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        <DropdownMenuLabel>Trocar de conta (demonstração)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {contas.map((conta) => (
          <DropdownMenuItem key={conta.id} asChild>
            <form
              action={trocarSessaoAction.bind(null, conta.id, rotaDe(conta.papeis))}
              className="w-full"
            >
              <button type="submit" className="flex w-full flex-col text-left">
                <span>{conta.nome}</span>
                <span className="text-muted-foreground text-xs">
                  {conta.papeis.map((papel) => rotuloPapel(papel)).join(", ")}
                </span>
              </button>
            </form>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function rotaDe(papeis: Usuario["papeis"]): string {
  if (papeis.includes("administrador")) return "/admin/usuarios";
  if (papeis.some((papel) => papel.startsWith("coordenador"))) return "/coordenacao/estagios";

  return "/documentos";
}
