import type { Metadata } from "next";

import { PaginaArea } from "@/components/layout/pagina-area";
import { TabelaUsuarios } from "@/features/admin/usuarios/tabela-usuarios";
import { exigirPapeis } from "@/lib/auth/guard";
import { contarUsuariosPorSituacao, listarUsuarios } from "@/lib/services/administracao";
import { listarCursos } from "@/lib/services/catalogo";

export const metadata: Metadata = {
  title: "Usuários",
  description: "Cadastrar, editar e inativar usuários do SELic.",
};

/**
 * Gestão de usuários (8.2, 8.3). A tela consome os serviços de
 * `src/lib/services`; a guarda de papel está no layout de `(admin)`.
 */
export default async function PaginaUsuarios() {
  await exigirPapeis(["administrador"], "/admin/usuarios");

  const [pagina, cursos, contagem] = await Promise.all([
    listarUsuarios({ tamanho: 50 }),
    listarCursos(),
    contarUsuariosPorSituacao(),
  ]);

  const situacoes = (["ativo", "pendente", "inativo"] as const).map((situacao) => ({
    situacao,
    total: contagem[situacao],
  }));

  return (
    <PaginaArea
      titulo="Usuários"
      descricao="Cadastre, edite e inative usuários. Inativar bloqueia o acesso e preserva os registros criados pela pessoa."
    >
      <TabelaUsuarios
        usuarios={pagina.itens}
        total={pagina.total}
        cursos={cursos.map((curso) => ({ id: curso.id, nome: curso.nome }))}
        situacoes={situacoes}
      />
    </PaginaArea>
  );
}