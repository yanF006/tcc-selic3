import { cn } from "@/lib/utils";

/**
 * Folha de preview de documento (2.5, D6): o conteúdo do documento vive dentro do
 * escopo `.impressao`, onde os tokens semânticos resolvem para fundo claro e
 * texto escuro. Por isso o preview continua claro com a interface no tema
 * escuro, e nenhum componente interno precisa saber em qual tema a página está.
 *
 * O preenchimento da folha em si é dirigido pelo descritor do template (8.5);
 * este componente entrega apenas o isolamento de tokens e a superfície que
 * recebe o conteúdo, para que a troca de renderização não mexa na folha.
 */
export function DocumentPreview({
  titulo,
  className,
  children,
}: {
  /** Nome acessível da folha; também identifica o documento em tela de leitura. */
  titulo: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex justify-center p-4 print:p-0", className)}>
      <article
        role="document"
        aria-label={titulo}
        data-preview-impressao=""
        className={cn(
          "impressao text-foreground w-full max-w-[210mm] rounded-sm border bg-white px-8 py-10 shadow-sm",
          "print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none",
        )}
      >
        {children}
      </article>
    </div>
  );
}
