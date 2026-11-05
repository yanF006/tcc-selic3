import type { Metadata } from "next";

import { PaginaArea } from "@/components/layout/pagina-area";
import { TabelaMatriculas } from "@/features/admin/matriculas/tabela-matriculas";
import { exigirPapeis } from "@/lib/auth/guard";
import type { MatriculaImportada } from "@/lib/domain/types";
import { listarMatriculas } from "@/lib/services/administracao";
import { listarCursos } from "@/lib/services/catalogo";

export const metadata: Metadata = {
  title: "Matrículas",
  description: "Lançar matrículas válidas e consultar as matrículas registradas.",
};

export const TAMANHO_PAGINA_MATRICULAS = 10;

function texto(valor: string | string[] | undefined): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function ehOrigem(valor: string): valor is MatriculaImportada["origem"] {
  return valor === "importacao" || valor === "cadastro_administrador";
}

function numeroDaPagina(valor: string): number {
  const numero = Number(valor);

  return Number.isFinite(numero) && numero >= 1 ? Math.trunc(numero) : 1;
}

/**
 * Matrículas (8.4). Busca, origem e paginação consultam todo o conjunto
 * persistido no servidor; a tela não recebe um recorte fixo nem filtra apenas o
 * que já está na primeira página. A guarda de papel está no layout de `(admin)`.
 */
export default async function PaginaMatriculas({ searchParams }: PageProps<"/admin/matriculas">) {
  await exigirPapeis(["administrador"], "/admin/matriculas");

  const parametros = await searchParams;
  const busca = texto(parametros.busca);
  const origemBruta = texto(parametros.origem);
  const origem = ehOrigem(origemBruta) ? origemBruta : undefined;
  const paginaSolicitada = numeroDaPagina(texto(parametros.pagina));

  const [pagina, cursos] = await Promise.all([
    listarMatriculas({
      busca,
      origem,
      pagina: paginaSolicitada,
      tamanho: TAMANHO_PAGINA_MATRICULAS,
    }),
    listarCursos("ativo"),
  ]);

  return (
    <PaginaArea
      titulo="Matrículas"
      descricao="Registre a matrícula que passa a valer no sistema e consulte as matrículas já registradas."
    >
      <TabelaMatriculas
        matriculas={pagina.itens}
        total={pagina.total}
        paginaAtual={pagina.pagina}
        tamanhoPagina={pagina.tamanhoPagina}
        filtros={{ busca, origem: origem ?? "todas" }}
        cursos={cursos}
      />
    </PaginaArea>
  );
}
