import { redirect } from "next/navigation";
import { PaginaArea } from "@/components/layout/pagina-area";
import { Cadastros } from "@/components/gestao/cadastros";
import { usuarioDaRequisicao } from "@/lib/auth/sessao-servidor";
import { podeAcessarAlgum } from "@/lib/auth/permissions";
import { consultarCadastros } from "@/lib/services/cadastros";

export const metadata = { title: "Cadastros de apoio" };

export default async function Page() {
  const usuario = await usuarioDaRequisicao();
  if (!usuario) redirect("/login");
  if (!podeAcessarAlgum(usuario, ["coordenador_estagio"])) redirect("/nao-autorizado");
  return (
    <PaginaArea
      titulo="Cadastros de apoio"
      descricao="Convênios, cursos, turmas, períodos, orientadores e supervisores do campus."
    >
      <Cadastros dados={await consultarCadastros(usuario)} />
    </PaginaArea>
  );
}
