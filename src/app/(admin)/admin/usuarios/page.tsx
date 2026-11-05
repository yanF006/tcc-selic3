import type { Metadata } from "next";

import { PaginaArea } from "@/components/layout/pagina-area";
import { TabelaUsuarios } from "@/features/admin/usuarios/tabela-usuarios";
import { exigirPapeis } from "@/lib/auth/guard";
import { PAPEIS, SITUACOES_USUARIO } from "@/lib/domain/types";
import type { Papel, SituacaoUsuario } from "@/lib/domain/types";
import { contarUsuariosPorSituacao, listarUsuarios } from "@/lib/services/administracao";
import { listarCursos, listarPeriodos, listarTurmas } from "@/lib/services/catalogo";

export const metadata: Metadata = {
  title: "Usuários",
  description: "Cadastrar, editar e inativar usuários do SELic.",
};

export const TAMANHO_PAGINA_USUARIOS = 10;

function texto(valor: string | string[] | undefined): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function ehPapel(valor: string): valor is Papel {
  return (PAPEIS as readonly string[]).includes(valor);
}

function ehSituacao(valor: string): valor is SituacaoUsuario {
  return (SITUACOES_USUARIO as readonly string[]).includes(valor);
}

function numeroDaPagina(valor: string): number {
  const numero = Number(valor);

  return Number.isFinite(numero) && numero >= 1 ? Math.trunc(numero) : 1;
}

/**
 * Gestão de usuários (8.2, 8.3). Busca, filtros e paginação são resolvidos no
 * servidor a partir de `searchParams`, sobre o conjunto completo do serviço —
 * nunca sobre uma página pré-carregada no cliente. A guarda de papel está no
 * layout de `(admin)`.
 */
export default async function PaginaUsuarios({ searchParams }: PageProps<"/admin/usuarios">) {
  await exigirPapeis(["administrador"], "/admin/usuarios");

  const parametros = await searchParams;
  const busca = texto(parametros.busca);
  const papelBruto = texto(parametros.papel);
  const situacaoBruta = texto(parametros.situacao);
  const curso = texto(parametros.curso);
  const papel = ehPapel(papelBruto) ? papelBruto : undefined;
  const situacao = ehSituacao(situacaoBruta) ? situacaoBruta : undefined;
  const paginaSolicitada = numeroDaPagina(texto(parametros.pagina));

  const [pagina, cursos, turmas, periodos, contagem] = await Promise.all([
    listarUsuarios({
      busca,
      papel,
      situacao,
      cursoId: curso || undefined,
      pagina: paginaSolicitada,
      tamanho: TAMANHO_PAGINA_USUARIOS,
    }),
    listarCursos(),
    listarTurmas(),
    listarPeriodos(),
    contarUsuariosPorSituacao(),
  ]);

  const situacoes = (["ativo", "pendente", "inativo"] as const).map((situacaoAtual) => ({
    situacao: situacaoAtual,
    total: contagem[situacaoAtual],
  }));

  return (
    <PaginaArea
      titulo="Usuários"
      descricao="Cadastre, edite e inative usuários, filtre por papel, situação e curso e abra o perfil completo de cada cadastro. Inativar bloqueia o acesso e preserva os registros criados pela pessoa."
    >
      <TabelaUsuarios
        usuarios={pagina.itens}
        total={pagina.total}
        paginaAtual={pagina.pagina}
        tamanhoPagina={pagina.tamanhoPagina}
        filtros={{
          busca,
          papel: papel ?? "todos",
          situacao: situacao ?? "todas",
          curso: curso || "todos",
        }}
        cursos={cursos.map((cursoAtual) => ({ id: cursoAtual.id, nome: cursoAtual.nome }))}
        turmas={turmas.map((turma) => ({ id: turma.id, nome: turma.nome }))}
        periodos={periodos.map((periodo) => ({ id: periodo.id, rotulo: periodo.rotulo }))}
        situacoes={situacoes}
      />
    </PaginaArea>
  );
}
