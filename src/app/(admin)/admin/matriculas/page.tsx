import type { Metadata } from "next";

import { PaginaArea } from "@/components/layout/pagina-area";
import { TabelaMatriculas } from "@/features/admin/matriculas/tabela-matriculas";
import { exigirPapeis } from "@/lib/auth/guard";
import { listarMatriculas, totalMatriculasImportadas } from "@/lib/services/administracao";
import { listarCursos } from "@/lib/services/catalogo";

export const metadata: Metadata = {
  title: "Matrículas",
  description: "Lançar matrículas válidas e consultar as matrículas registradas.",
};

/**
 * Matrículas (8.4). A tela mostra o lançamento manual de matrícula válida e a
 * consulta das matrículas registradas com a origem de cada uma; a guarda de
 * papel está no layout de `(admin)`.
 */
export default async function PaginaMatriculas() {
  await exigirPapeis(["administrador"], "/admin/matriculas");

  const [pagina, total, cursos] = await Promise.all([
    listarMatriculas({ tamanho: 100 }),
    totalMatriculasImportadas(),
    listarCursos("ativo"),
  ]);

  return (
    <PaginaArea
      titulo="Matrículas"
      descricao="Registre a matrícula que passa a valer no sistema e consulte as matrículas já registradas."
    >
      <TabelaMatriculas matriculas={pagina.itens} total={total} cursos={cursos} />
    </PaginaArea>
  );
}
