/**
 * Cabeçalho comum das telas de produto: título, descrição e o conteúdo real da
 * tela. Evita que cada página repita a estrutura de cabeçalho.
 */
export function PaginaArea({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-6 [&>*]:min-w-0">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        <p className="text-muted-foreground text-sm">{descricao}</p>
      </header>
      {children}
    </section>
  );
}
