import { ShellArea } from "@/components/layout/shell-area";

/**
 * Área da conta: serve a qualquer usuário autenticado, sem exigir papel
 * específico, porque trocar a própria senha é direito de todo mundo que tem
 * cadastro (5.9). A guarda continua sendo a do `ShellArea`, que resolve a
 * sessão pelo cookie antes de renderizar.
 */
export default function LayoutConta({ children }: LayoutProps<"/">) {
  return (
    <ShellArea
      papeisExigidos={["aluno", "coordenador_estagio", "coordenador_curso", "administrador"]}
      destino="/conta/senha"
      qualquerPapel
    >
      {children}
    </ShellArea>
  );
}
