"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

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
import { ChevronDownIcon, KeyRoundIcon, LogOutIcon, MenuIcon, XIcon } from "lucide-react";

import { rotuloPapel } from "@/lib/domain/status";
import type { Usuario } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

import type { ItemNav as ItemNavGrupo } from "@/nav";

import { sairAction } from "@/app/(publico)/acoes/sessao";

import { iconeGrupoNav, iconeNav, type ChaveIcone } from "./nav-icons";

/** Itens já filtrados por papel no layout; o componente não decide permissão. */
export interface ItemNavbar {
  href: string;
  rotulo: string;
  icone: ChaveIcone;
}

export interface GrupoNavbar {
  grupo: ItemNavGrupo["grupo"];
  rotulo: string;
  itens: ItemNavbar[];
}

/**
 * Navegação das áreas autenticadas.
 *
 * A barra **não** rola na horizontal: no desktop, o grupo principal vira botões
 * com ícone e rótulo e os demais viram menus suspensos; no celular, um único
 * botão abre o painel completo com todos os itens. Cada item mostra ícone e
 * rótulo — o ícone acelera a leitura, o rótulo garante o acesso sem depender
 * do desenho.
 */
export function Navbar({
  usuario,
  grupos,
  seletorDePapel,
}: {
  usuario: Usuario;
  grupos: GrupoNavbar[];
  seletorDePapel?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [painelAberto, setPainelAberto] = React.useState(false);

  const ehAtivo = (href: string) => pathname === href;
  const grupoAtivo = (grupo: GrupoNavbar) => grupo.itens.some((item) => ehAtivo(item.href));

  // No desktop o grupo principal fica visível; os demais, em menus.
  const inline = grupos.filter((grupo) => grupo.grupo === "principal" && grupo.itens.length <= 4);
  const emMenu = grupos.filter((grupo) => !inline.includes(grupo));

  return (
    <header className="border-border bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4">
        <Link href="/" aria-label="Página inicial do SELic" className="shrink-0">
          <Logo tamanho="pequeno" />
        </Link>

        <nav aria-label="Navegação principal" className="hidden min-w-0 flex-1 md:block">
          <ul className="flex items-center gap-1">
            {inline.flatMap((grupo) =>
              grupo.itens.map((item) => {
                const Icone = iconeNav(item.icone);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={ehAtivo(item.href) ? "page" : undefined}
                      className={cn(
                        "hover:bg-accent hover:text-accent-foreground focus-visible:outline-primary flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                        ehAtivo(item.href) && "bg-accent text-accent-foreground",
                      )}
                    >
                      <Icone className="size-4 shrink-0" aria-hidden="true" />
                      {item.rotulo}
                    </Link>
                  </li>
                );
              }),
            )}

            {emMenu.map((grupo) => {
              const IconeGrupo = iconeGrupoNav(grupo.grupo);
              const ativo = grupoAtivo(grupo);

              return (
                <li key={grupo.grupo}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("gap-2", ativo && "bg-accent text-accent-foreground")}
                        aria-label={`${grupo.rotulo}: ${grupo.itens.map((item) => item.rotulo).join(", ")}`}
                      >
                        <IconeGrupo className="size-4" aria-hidden="true" />
                        <span className="hidden lg:inline">{grupo.rotulo}</span>
                        <ChevronDownIcon className="size-3.5 opacity-70" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-60">
                      <DropdownMenuLabel>{grupo.rotulo}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {grupo.itens.map((item) => {
                        const Icone = iconeNav(item.icone);

                        return (
                          <DropdownMenuItem key={item.href} asChild>
                            <Link
                              href={item.href}
                              aria-current={ehAtivo(item.href) ? "page" : undefined}
                              className={cn(
                                "gap-2",
                                ehAtivo(item.href) && "bg-accent text-accent-foreground",
                              )}
                            >
                              <Icone className="size-4 shrink-0" aria-hidden="true" />
                              {item.rotulo}
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          {seletorDePapel}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-expanded={painelAberto}
            aria-controls="painel-navegacao"
            aria-label={painelAberto ? "Fechar o menu" : "Abrir o menu"}
            onClick={() => setPainelAberto((aberto) => !aberto)}
          >
            {painelAberto ? (
              <XIcon className="size-5" aria-hidden="true" />
            ) : (
              <MenuIcon className="size-5" aria-hidden="true" />
            )}
          </Button>

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <span className="bg-primary/10 text-primary flex size-6 items-center justify-center rounded-full text-[0.65rem] font-semibold">
                  {iniciais(usuario.nome)}
                </span>
                <span className="hidden max-w-32 truncate sm:inline">{usuario.nome}</span>
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
                <Link className="flex items-center gap-2" href="/conta/senha">
                  <KeyRoundIcon className="size-4 shrink-0" aria-hidden="true" />
                  Alterar senha
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <form action={sairAction}>
                  <button type="submit" className="flex w-full items-center gap-2 text-left">
                    <LogOutIcon className="size-4 shrink-0" aria-hidden="true" />
                    Sair
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {painelAberto ? (
        <div
          id="painel-navegacao"
          className="border-border bg-background max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b md:hidden"
        >
          <nav aria-label="Navegação principal" className="mx-auto w-full max-w-6xl px-2 py-3">
            {grupos.map((grupo) => (
              <div key={grupo.grupo} className="mb-3 last:mb-0">
                <p className="text-muted-foreground px-3 pb-1 text-xs font-semibold tracking-wide uppercase">
                  {grupo.rotulo}
                </p>
                <ul className="flex flex-col">
                  {grupo.itens.map((item) => {
                    const Icone = iconeNav(item.icone);

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={ehAtivo(item.href) ? "page" : undefined}
                          onClick={() => setPainelAberto(false)}
                          className={cn(
                            "hover:bg-accent hover:text-accent-foreground flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                            ehAtivo(item.href) && "bg-accent text-accent-foreground",
                          )}
                        >
                          <Icone className="size-4 shrink-0" aria-hidden="true" />
                          {item.rotulo}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

/** Iniciais do nome, para o botão de usuário sem depender de imagem. */
function iniciais(nome: string): string {
  const partes = nome
    .trim()
    .split(/\s+/)
    .filter((parte) => parte.length > 2);

  if (partes.length === 0) return nome.slice(0, 2).toUpperCase();

  return `${partes[0][0] ?? ""}${partes[partes.length - 1][0] ?? ""}`.toUpperCase();
}
