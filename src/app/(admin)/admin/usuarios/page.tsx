import type { Metadata } from "next";

import { PaginaArea } from "@/components/layout/pagina-area";
import { TabelaUsuarios } from "@/features/admin/usuarios/tabela-usuarios";
import { exigirPapeis } from "@/lib/auth/guard";
import { contarUsuariosPorSituacao, listarUsuarios } from "@/lib/services/administracao";
import { listarCursos, listarPeriodos, listarTurmas } from "@/lib/services/catalogo";

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

  const [pagina, cursos, turmas, periodos, contagem] = await Promise.all([
    listarUsuarios({ tamanho: 50 }),
    listarCursos(),
    listarTurmas(),
    listarPeriodos(),
    contarUsuariosPorSituacao(),
  ]);

  const situacoes = (["ativo", "pendente", "inativo"] as const).map((situacao) => ({
    situacao,
    total: contagem[situacao],
  }));

  return (
    <PaginaArea
      titulo="Usuários"
      descricao="Cadastre, edite e inative usuários, filtre por papel, situação e curso e abra o perfil completo de cada cadastro. Inativar bloqueia o acesso e preserva os registros criados pela pessoa."
    >
      <TabelaUsuarios
        usuarios={pagina.itens}
        total={pagina.total}
        cursos={cursos.map((curso) => ({ id: curso.id, nome: curso.nome }))}
        turmas={turmas.map((turma) => ({ id: turma.id, nome: turma.nome }))}
        periodos={periodos.map((periodo) => ({ id: periodo.id, rotulo: periodo.rotulo }))}
        situacoes={situacoes}
      />
    </PaginaArea>
  );
}
