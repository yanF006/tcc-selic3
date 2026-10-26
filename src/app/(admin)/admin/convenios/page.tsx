import type { Metadata } from "next";

import { PaginaArea } from "@/components/layout/pagina-area";
import { Cadastros } from "@/components/gestao/cadastros";
import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import { consultarCadastros } from "@/lib/services/cadastros";

export const metadata: Metadata = {
  title: "Convênios",
  description: "Cadastrar convênios e registrar renovações.",
};

export default async function Page() {
  const usuario = await usuarioDaRequisicaoObrigatorio();
  return (
    <PaginaArea titulo="Convênios" descricao="Cadastrar convênios e registrar renovações.">
      <Cadastros dados={await consultarCadastros(usuario)} apenasConvenios />
    </PaginaArea>
  );
}
