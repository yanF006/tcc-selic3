import { ShellArea } from "@/components/layout/shell-area";

/**
 * Área da coordenação: serve ao Coordenador de Estágio e ao Coordenador de Curso.
 * Os itens de navegação são filtrados por `nav.ts`, então cada papel vê apenas a
 * sua parte.
 */
export default function LayoutCoordenacao({ children }: LayoutProps<"/">) {
  return (
    <ShellArea
      papeisExigidos={["coordenador_estagio", "coordenador_curso"]}
      destino="/coordenacao/estagios"
      qualquerPapel
    >
      {children}
    </ShellArea>
  );
}
