import type { Metadata } from "next";

import { PaginaArea } from "@/components/layout/pagina-area";
import { FormularioTrocaSenha } from "@/app/(conta)/conta/senha/formulario-troca-senha";

export const metadata: Metadata = {
  title: "Alterar senha",
  description: "Troca da senha do usuário autenticado.",
};

/** Troca de senha autenticada (5.9): exige a senha atual e a confirmação da nova. */
export default function ContaSenhaPage() {
  return (
    <PaginaArea
      titulo="Alterar senha"
      descricao="Informe a senha atual para definir uma nova senha de acesso."
    >
      <FormularioTrocaSenha />
    </PaginaArea>
  );
}
