import type { Metadata } from "next";

import { PaginaArea } from "@/components/layout/pagina-area";
import { ListaExclusoes } from "@/features/admin/exclusoes/lista-exclusoes";
import { exigirPapeis } from "@/lib/auth/guard";
import { listarExclusoesPendentes } from "@/lib/services/estagios";

export const metadata: Metadata = {
  title: "Pedidos de exclusão",
  description: "Autorizar ou recusar pedidos de exclusão de estágio.",
};

export default async function PaginaExclusoes() {
  const usuario = await exigirPapeis(["administrador"], "/admin/exclusoes");
  const pedidos = await listarExclusoesPendentes(usuario);

  return (
    <PaginaArea
      titulo="Pedidos de exclusão"
      descricao="Autorize para excluir o estágio (o histórico é preservado e os dados pessoais vinculados são removidos) ou recuse para mantê-lo."
    >
      <ListaExclusoes pedidos={pedidos} />
    </PaginaArea>
  );
}
