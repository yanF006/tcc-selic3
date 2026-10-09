import { ShellArea } from "@/components/layout/shell-area";

/**
 * Área do catálogo de documentos: serve a qualquer usuário autenticado, sem
 * exigir cargo, porque o catálogo do Kit de Estágio é comum a todos. O item
 * continua no grupo principal da navegação e o preenchimento de cada documento
 * é filtrado pelo descritor (D5), não pela guarda da área.
 */
export default function LayoutCatalogo({ children }: LayoutProps<"/">) {
  return (
    <ShellArea
      papeisExigidos={["aluno", "coordenador_estagio", "coordenador_curso", "administrador"]}
      destino="/documentos"
      qualquerPapel
    >
      {children}
    </ShellArea>
  );
}
