import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import { FormularioCadastro } from "@/app/(publico)/cadastro/formulario-cadastro";
import { usuarioDaRequisicao, rotaInicial } from "@/lib/auth/sessao-servidor";
import { listarCursos, listarPeriodos, listarTurmas } from "@/lib/services/catalogo";

export const metadata: Metadata = {
  title: "Criar cadastro",
  description: "Cadastro do aluno no SELic em duas etapas.",
};

/**
 * Cadastro público do aluno (5.2 a 5.5). Os selects de curso, turma e período
 * saem do mesmo serviço da tela de perfil, nunca das fixtures.
 */
export default async function CadastroPage() {
  const usuario = await usuarioDaRequisicao();

  if (usuario) redirect(rotaInicial(usuario));

  const [cursos, turmas, periodos] = await Promise.all([
    listarCursos(),
    listarTurmas(),
    listarPeriodos(),
  ]);

  return (
    <main className="flex min-h-full flex-col items-center gap-6 px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <Logo tamanho="grande" />
        <p className="text-muted-foreground text-sm">
          Sistema de Gestão de Estágio do IFRJ Campus Pinheiral
        </p>
      </div>

      <FormularioCadastro cursos={cursos} turmas={turmas} periodos={periodos} />
    </main>
  );
}
