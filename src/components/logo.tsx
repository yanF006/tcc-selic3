import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Logotipo do SELic. A marca é o arquivo oficial (`Assets/selic-logo.svg`,
 * servido de `public/`) e tem cor fixa, funcionando nos dois temas; o nome ao
 * lado é o que acompanha o tema, pelo token `--logo-texto`.
 *
 * O tamanho vai na marca, nunca na linha inteira: fixar a largura da linha
 * deixava o nome estourar a caixa e cobrir os itens da navegação.
 */
export function Logo({
  className,
  tamanho = "medio",
}: {
  className?: string;
  tamanho?: "pequeno" | "medio" | "grande";
}) {
  const dimensoes = {
    pequeno: { marca: "h-6", nome: "text-sm" },
    medio: { marca: "h-8", nome: "text-lg" },
    grande: { marca: "h-12", nome: "text-3xl" },
  }[tamanho];

  return (
    <span
      data-parte-logo="marca"
      className={cn("flex shrink-0 items-center gap-2 font-semibold tracking-tight", className)}
    >
      <Image
        src="/selic-logo.svg"
        alt=""
        aria-hidden="true"
        width={375}
        height={480}
        className={cn("w-auto", dimensoes.marca)}
      />
      <span data-parte-logo="nome" className={cn("text-logo-texto", dimensoes.nome)}>
        SELic
      </span>
    </span>
  );
}
