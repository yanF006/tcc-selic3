import { cn } from "@/lib/utils";

/**
 * Logotipo provisório do SELic: o arquivo oficial do IFRJ ainda não foi
 * fornecido. A variante `invertida` é usada sobre fundo escuro (rodapé,
 * impressão) e a variante padrão sobre fundo claro.
 */
export function Logo({
  className,
  variante = "padrao",
  tamanho = "medio",
}: {
  className?: string;
  variante?: "padrao" | "invertida";
  tamanho?: "pequeno" | "medio" | "grande";
}) {
  const dimensoes = {
    pequeno: "size-6 text-sm",
    medio: "size-8 text-lg",
    grande: "size-10 text-2xl",
  }[tamanho];

  return (
    <span
      className={cn("flex items-center gap-2 font-semibold tracking-tight", dimensoes, className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "text-primary-foreground grid size-full place-items-center rounded-lg",
          variante === "invertida" ? "bg-primary" : "bg-primary",
        )}
      >
        <span className="text-[0.6em] leading-none font-bold">SE</span>
      </span>
      <span
        className={cn(variante === "invertida" ? "text-primary-foreground" : "text-foreground")}
      >
        SELic
      </span>
    </span>
  );
}
