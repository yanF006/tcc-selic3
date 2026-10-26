import type { Metadata } from "next";

import { PaginaArea } from "@/components/layout/pagina-area";
import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import { dadosDoAluno } from "@/lib/services/aluno";
import { listarCursos, listarPeriodos, listarTurmas } from "@/lib/services/catalogo";

import { FormularioPerfil } from "./formulario-perfil";

export const metadata: Metadata = {
  title: "Perfil",
  description: "Dados pessoais, contato e preferências.",
};

export default async function Page() {
  const usuario = await usuarioDaRequisicaoObrigatorio();
  const [dados, cursos, turmas, periodos] = await Promise.all([
    dadosDoAluno(usuario),
    listarCursos(),
    listarTurmas(undefined, true),
    listarPeriodos(true),
  ]);

  return (
    <PaginaArea titulo="Perfil" descricao="Dados pessoais, contato e preferências.">
      <FormularioPerfil
        usuario={usuario}
        dadosIniciais={dados}
        cursos={cursos}
        turmas={turmas}
        periodos={periodos}
      />
    </PaginaArea>
  );
}
