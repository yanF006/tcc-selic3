import type { Metadata } from "next";

import { PaginaArea } from "@/components/layout/pagina-area";
import { ConteudoEstagios } from "@/app/(aluno)/estagio/conteudo-estagios";
import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import {
  consultarEstagios,
  exclusaoPendenteDoEstagio,
  totalHorasDoEstagio,
} from "@/lib/services/estagios";
import { listarUsuarios } from "@/lib/services/administracao";
import {
  classificacaoConvenio,
  listarConvenios,
  listarOrientadores,
  listarSupervisores,
} from "@/lib/services/catalogo";
import {
  descritorDoDocumento,
  documentosDoEstagio,
  listarTemplates,
} from "@/lib/services/documentos";
import { dadosDoPainelFluxo } from "@/lib/services/fluxo-estagio";
import { lancamentosDoEstagioAtuais } from "@/lib/services/lancamentos";

export const metadata: Metadata = {
  title: "Estágios",
  description: "Acompanhar os estágios dos alunos.",
};

export default async function Page({ searchParams }: PageProps<"/coordenacao/estagios">) {
  const usuario = await usuarioDaRequisicaoObrigatorio();
  const { estagio: selecionado } = await searchParams;
  const [pagina, convenios, orientadores, supervisores, templates, usuarios] = await Promise.all([
    consultarEstagios(usuario, { tamanho: 1000 }),
    listarConvenios({ tamanho: 1000 }),
    listarOrientadores(),
    listarSupervisores(),
    listarTemplates(),
    listarUsuarios({ tamanho: 1000 }),
  ]);
  const estagios = pagina.itens;
  const resumosHoras = Object.fromEntries(
    await Promise.all(
      estagios.map(async (estagio) => [
        estagio.id,
        {
          total: await totalHorasDoEstagio(estagio.id),
          lancamentos: await lancamentosDoEstagioAtuais(estagio.id),
        },
      ]),
    ),
  );
  const documentos = (
    await Promise.all(estagios.map((estagio) => documentosDoEstagio(estagio.id)))
  ).flat();
  const dadosFluxo = await dadosDoPainelFluxo(
    usuario,
    estagios.map((estagio) => estagio.id),
  );
  const exclusoesPendentes = (
    await Promise.all(
      estagios.map(async (estagio) =>
        (await exclusaoPendenteDoEstagio(estagio.id)) ? estagio.id : null,
      ),
    )
  ).filter((id): id is string => id !== null);
  const ids = new Set([
    usuario.id,
    ...estagios.flatMap((estagio) => [estagio.alunoId, estagio.editadoPorId]),
  ]);
  const nomesUsuarios = Object.fromEntries(
    usuarios.itens
      .filter((registro) => ids.has(registro.id))
      .map((registro) => [registro.id, registro.nome]),
  );
  return (
    <PaginaArea
      titulo="Estágios"
      descricao={
        usuario.papel === "coordenador_estagio" || usuario.papel === "administrador"
          ? "Estágios do campus."
          : "Estágios dos alunos do seu curso."
      }
    >
      <ConteudoEstagios
        gestao
        rotaBase="/coordenacao/estagios"
        nomesUsuarios={nomesUsuarios}
        estagioInicialId={typeof selecionado === "string" ? selecionado : undefined}
        estagiosIniciais={estagios}
        convenios={convenios.itens.map((convenio) => ({
          ...convenio,
          situacao:
            convenio.situacao === "ativo" && classificacaoConvenio(convenio) === "ativo"
              ? "ativo"
              : "inativo",
        }))}
        orientadores={orientadores}
        supervisores={supervisores}
        templates={templates}
        resumosHoras={resumosHoras}
        documentos={documentos.map((documento) => ({
          ...documento,
          descritor: descritorDoDocumento(documento),
        }))}
        dadosFluxo={dadosFluxo}
        exclusoesPendentes={exclusoesPendentes}
      />
    </PaginaArea>
  );
}
