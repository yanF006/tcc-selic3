import type { Metadata } from "next";

import { PaginaArea } from "@/components/layout/pagina-area";
import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import { estagiosDoAluno, lancamentosDoEstagio, totalHorasDoEstagio } from "@/lib/services/estagios";
import { listarConvenios, listarOrientadores, listarSupervisores } from "@/lib/services/catalogo";
import { listarTemplates } from "@/lib/services/documentos";
import type { LancamentoHoras } from "@/lib/domain/types";

import { ConteudoEstagios } from "./conteudo-estagios";

export const metadata: Metadata = {
  title: "Estágio",
  description: "Cadastrar o estágio, o convênio e o horário.",
};

export default async function Page() {
  const usuario = await usuarioDaRequisicaoObrigatorio();
  const [estagios, conveniosPagina, orientadores, supervisores, templates] = await Promise.all([
    estagiosDoAluno(usuario.id),
    listarConvenios({ tamanho: 100 }),
    listarOrientadores(),
    listarSupervisores(),
    listarTemplates(),
  ]);

  const resumosHoras: Record<string, { total: number; lancamentos: LancamentoHoras[] }> = {};

  for (const estagio of estagios) {
    resumosHoras[estagio.id] = {
      total: await totalHorasDoEstagio(estagio.id),
      lancamentos: lancamentosDoEstagio(estagio.id),
    };
  }

  return (
    <PaginaArea titulo="Estágio" descricao="Cadastrar o estágio, o convênio e o horário.">
      <ConteudoEstagios
        alunoId={usuario.id}
        estagiosIniciais={estagios}
        convenios={conveniosPagina.itens}
        orientadores={orientadores}
        supervisores={supervisores}
        templates={templates}
        resumosHoras={resumosHoras}
      />
    </PaginaArea>
  );
}
