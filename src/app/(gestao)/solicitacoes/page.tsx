import type { Metadata } from "next";

import { PaginaArea } from "@/components/layout/pagina-area";
import { TabelaSolicitacoes } from "@/features/gestao/tabela-solicitacoes";
import { exigirAlgumDosPapeis } from "@/lib/auth/guard";
import { listarSolicitacoes } from "@/lib/services/administracao";

export const metadata: Metadata = {
  title: "Cadastros pendentes",
  description: "Fila de autorizações de cadastro de alunos.",
};

/**
 * Fila de cadastros pendentes (5.6). Serve à coordenação e à administração; a
 * guarda está no layout de `(gestao)`.
 */
export default async function PaginaSolicitacoes() {
  await exigirAlgumDosPapeis(
    ["coordenador_estagio", "coordenador_curso", "administrador"],
    "/solicitacoes",
  );

  const pagina = await listarSolicitacoes({ tamanho: 100 });

  return (
    <PaginaArea
      titulo="Cadastros pendentes"
      descricao="Autorize a matrícula conferida ou recuse o cadastro, sempre com motivo registrado."
    >
      <TabelaSolicitacoes solicitacoes={pagina.itens} />
    </PaginaArea>
  );
}
