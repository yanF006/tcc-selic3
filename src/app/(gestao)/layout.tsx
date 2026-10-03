import { ShellArea } from "@/components/layout/shell-area";

/**
 * Área compartilhada da gestão (fila de cadastros pendentes): serve à coordenação
 * e à administração, sem repetir a guarda em cada tela.
 */
export default function LayoutGestao({ children }: LayoutProps<"/">) {
  return (
    <ShellArea
      papeisExigidos={["coordenador_estagio", "coordenador_curso", "administrador"]}
      destino="/solicitacoes"
      qualquerPapel
    >
      {children}
    </ShellArea>
  );
}
