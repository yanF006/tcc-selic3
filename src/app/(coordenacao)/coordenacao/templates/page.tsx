import { redirect } from "next/navigation";
import { PaginaArea } from "@/components/layout/pagina-area";
import { GestaoTemplates } from "@/components/gestao/templates";
import { usuarioDaRequisicao } from "@/lib/auth/sessao-servidor";
import { podeAcessarAlgum } from "@/lib/auth/permissions";
import { templatesParaGestao } from "@/lib/services/templates";

export const metadata = { title: "Templates de documentos" };
export default async function Page() {
  const usuario = await usuarioDaRequisicao();
  if (!usuario) redirect("/login");
  if (!podeAcessarAlgum(usuario, ["coordenador_estagio"])) redirect("/nao-autorizado");
  return (
    <PaginaArea
      titulo="Templates de documentos"
      descricao="Arquivos, campos e histórico das versões dos documentos do Kit."
    >
      <GestaoTemplates templates={await templatesParaGestao(usuario)} />
    </PaginaArea>
  );
}
