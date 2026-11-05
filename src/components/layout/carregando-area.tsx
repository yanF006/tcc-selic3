import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback de carregamento das áreas que dependem de sessão/banco. O texto
 * acessível diferencia espera de lista vazia para leitores de tela e testes.
 */
export function CarregandoArea({ rotulo = "Carregando dados" }: { rotulo?: string }) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10"
    >
      <span className="sr-only">{rotulo}…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </section>
  );
}
