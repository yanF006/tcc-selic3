import { Suspense } from "react";

import { CarregandoArea } from "@/components/layout/carregando-area";
import { Navbar, type GrupoNavbar } from "@/components/layout/navbar";
import { SeletorPapel } from "@/components/layout/seletor-papel";
import { TelaIndisponivel } from "@/components/layout/tela-indisponivel";
import { exigirArea } from "@/lib/auth/guard";
import { BancoIndisponivelError } from "@/lib/db/erros";
import { ProvedorSessao } from "@/lib/auth/sessao-contexto";
import type { Papel, Usuario } from "@/lib/domain/types";
import { gruposPara, ROTULOS_GRUPO } from "@/nav";
import { AvisoCadastroPendente } from "@/features/cadastro/aviso-cadastro-pendente";
import { contasDeDesenvolvimento } from "@/lib/services/sessao";
import { documentosParaParecer } from "@/lib/services/documentos";

/**
 * Casca única das áreas autenticadas (D1): resolve a sessão, executa a guarda de
 * papel, monta a navbar a partir de `nav.ts` e, com a flag ligada, exibe o
 * seletor de papel. As três áreas (aluno, coordenação e administração) usam
 * este componente com os papéis exigidos de cada uma.
 */
interface PropsShellArea {
  papeisExigidos: Papel[];
  destino: string;
  /** true quando basta um dos papéis (áreas compartilhadas, como a coordenação). */
  qualquerPapel?: boolean;
  children: React.ReactNode;
}

/**
 * Casca das áreas autenticadas. A espera pela sessão e pelo banco acontece dentro
 * de um Suspense: o layout é enviado de imediato com o carregamento, e a casca
 * completa (ou a tela de indisponibilidade) chega quando a consulta termina.
 */
export function ShellArea(props: PropsShellArea) {
  return (
    <Suspense fallback={<CarregandoArea />}>
      <ShellAreaResolvida {...props} />
    </Suspense>
  );
}

async function ShellAreaResolvida({
  papeisExigidos,
  destino,
  qualquerPapel,
  children,
}: PropsShellArea) {
  let usuario: Usuario;

  try {
    usuario = await exigirArea({ papeisExigidos, destino, qualquerPapel });
  } catch (erro) {
    if (erro instanceof BancoIndisponivelError) return <TelaIndisponivel />;

    throw erro;
  }

  const cadastroPendente = usuario.situacao === "pendente";
  const grupos: GrupoNavbar[] = cadastroPendente
    ? []
    : gruposPara(usuario).map((secao) => ({
        grupo: secao.grupo,
        rotulo: ROTULOS_GRUPO[secao.grupo],
        itens: secao.itens.map((item) => ({
          href: item.href,
          rotulo: item.rotulo,
          icone: item.icone,
        })),
      }));
  const mostrarSeletor = process.env.NEXT_PUBLIC_SELIC_SELADOR_PAPEL === "true";
  const pendenciasParecer = cadastroPendente
    ? 0
    : (await documentosParaParecer("coordenador_curso", usuario)).total +
      (await documentosParaParecer("comissao_estagio", usuario)).total;

  return (
    <div className="flex min-h-full flex-col">
      <Navbar
        usuario={usuario}
        grupos={grupos}
        pendenciasParecer={pendenciasParecer}
        seletorDePapel={
          mostrarSeletor ? (
            <SeletorPapel
              contas={contasDeDesenvolvimento().map((conta) => ({
                id: conta.id,
                nome: conta.rotulo,
                papel: conta.papel,
              }))}
              usuarioAtual={usuario}
            />
          ) : undefined
        }
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <ProvedorSessao usuario={usuario}>
          {cadastroPendente ? <AvisoCadastroPendente nome={usuario.nome} /> : children}
        </ProvedorSessao>
      </main>
    </div>
  );
}
