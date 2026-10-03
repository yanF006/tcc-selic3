import { ShellArea } from "@/components/layout/shell-area";

/** Área do aluno: guarda única exigindo o papel `aluno`. */
export default function LayoutAluno({ children }: LayoutProps<"/">) {
  return (
    <ShellArea papeisExigidos={["aluno"]} destino="/documentos">
      {children}
    </ShellArea>
  );
}
