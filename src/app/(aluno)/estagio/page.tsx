import type { Metadata } from "next";

import { PaginaArea } from "@/components/layout/pagina-area";
import { usuarioDaRequisicaoObrigatorio } from "@/lib/auth/sessao-servidor";
import {
  estagiosDoAluno,
  exclusaoPendenteDoEstagio,
  lancamentosDoEstagio,
  totalHorasDoEstagio,
} from "@/lib/services/estagios";
import {
  classificacaoConvenio,
  listarConvenios,
  listarOrientadores,
  listarSupervisores,
} from "@/lib/services/catalogo";
import { listarTemplates } from "@/lib/services/documentos";
import { documentosDoAluno } from "@/lib/services/documentos";
import type { LancamentoHoras } from "@/lib/domain/types";

import { ConteudoEstagios } from "./conteudo-estagios";
import { dadosDoPainelFluxo } from "@/lib/services/fluxo-estagio";
import { DOCUMENTOS_INICIAIS } from "@/lib/domain/fluxo-estagio";
import { descritorDoDocumento, valoresAutomaticos } from "@/lib/services/documentos";
import { descritorDaVersao } from "@/lib/services/templates";

export const metadata: Metadata = {
  title: "Estágio",
  description: "Cadastrar o estágio, o convênio e o horário.",
};

export default async function Page({ searchParams }: PageProps<"/estagio">) {
  const usuario = await usuarioDaRequisicaoObrigatorio();
  const { estagio: selecionado } = await searchParams;
  const [estagios, conveniosPagina, orientadores, supervisores, templates] = await Promise.all([
    estagiosDoAluno(usuario.id),
    listarConvenios({ tamanho: 100 }),
    listarOrientadores(),
    listarSupervisores(),
    listarTemplates(),
  ]);

  const resumosHoras: Record<string, { total: number; lancamentos: LancamentoHoras[] }> = {};
  const documentos = await documentosDoAluno(usuario.id);
  const dadosFluxo = await dadosDoPainelFluxo(
    usuario,
    estagios.map((estagio) => estagio.id),
  );
  const valoresIniciaisDocumentos = Object.fromEntries(
    await Promise.all(
      DOCUMENTOS_INICIAIS.map(async (id) => [
        id,
        {
          ...(await valoresAutomaticos(id, usuario)),
          telefoneAluno: usuario.dadosPessoais?.telefone ?? "",
          celularAluno: usuario.dadosPessoais?.celular ?? "",
          emailAluno: usuario.email,
        },
      ]),
    ),
  );
  const exclusoesPendentes = (
    await Promise.all(
      estagios.map(async (estagio) =>
        (await exclusaoPendenteDoEstagio(estagio.id)) ? estagio.id : null,
      ),
    )
  ).filter((id): id is string => id !== null);

  for (const estagio of estagios) {
    resumosHoras[estagio.id] = {
      total: await totalHorasDoEstagio(estagio.id),
      lancamentos: lancamentosDoEstagio(estagio.id),
    };
  }

  return (
    <PaginaArea titulo="Estágio" descricao="Cadastrar o estágio, o convênio e o horário.">
      <ConteudoEstagios
        estagioInicialId={typeof selecionado === "string" ? selecionado : undefined}
        estagiosIniciais={estagios}
        convenios={conveniosPagina.itens.map((convenio) => ({
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
        valoresIniciaisDocumentos={valoresIniciaisDocumentos}
        descritoresIniciais={Object.fromEntries(
          DOCUMENTOS_INICIAIS.map((id) => [id, descritorDaVersao(id)]),
        )}
        exclusoesPendentes={exclusoesPendentes}
      />
    </PaginaArea>
  );
}
