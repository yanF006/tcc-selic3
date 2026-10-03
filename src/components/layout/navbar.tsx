import Link from "next/link";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserRoundIcon } from "lucide-react";

import { rotuloPapel } from "@/lib/domain/status";
import type { Usuario } from "@/lib/domain/types";

import { sairAction } from "@/app/(publico)/acoes/sessao";

/** Itens já filtrados por papel no layout; o componente não decide permissão. */
export interface ItemNavbar {
  href: string;
  rotulo: string;
}

export function Navbar({
  usuario,
  itens,
  seletorDePapel,
}: {
  usuario: Usuario;
  itens: ItemNavbar[];
  seletorDePapel?: React.ReactNode;
}) {
  return (
    <header className="border-border bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
        <Link href="/" aria-label="Página inicial do SELic">
          <Logo tamanho="pequeno" />
        </Link>

        <nav aria-label="Navegação principal" className="min-w-0 flex-1">
          <ul className="flex items-center gap-1 overflow-x-auto">
            {itens.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-primary rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {item.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1">
          {seletorDePapel}
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <UserRoundIcon className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{usuario.nome}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuLabel>{usuario.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {usuario.papeis.map((papel) => (
                <DropdownMenuItem key={papel} disabled>
                  {rotuloPapel(papel)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <form action={sairAction}>
                  <button type="submit" className="w-full text-left">
                    Sair
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
