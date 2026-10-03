import { ShellArea } from "@/components/layout/shell-area";

/** Área da administração: exige o papel `administrador`. */
export default function LayoutAdmin({ children }: LayoutProps<"/">) {
  return (
    <ShellArea papeisExigidos={["administrador"]} destino="/admin/usuarios">
      {children}
    </ShellArea>
  );
}
