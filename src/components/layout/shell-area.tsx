import { Navbar, type GrupoNavbar } from "@/components/layout/navbar";
import { SeletorPapel } from "@/components/layout/seletor-papel";
import { exigirArea } from "@/lib/auth/guard";
import { ProvedorSessao } from "@/lib/auth/sessao-contexto";
import type { Papel } from "@/lib/domain/types";
import { gruposPara, ROTULOS_GRUPO } from "@/nav";
import { AvisoCadastroPendente } from "@/features/cadastro/aviso-cadastro-pendente";
import { contasDeDesenvolvimento } from "@/lib/services/sessao";

/**
 * Casca única das áreas autenticadas (D1): resolve a sessão, executa a guarda de
 * papel, monta a navbar a partir de `nav.ts` e, com a flag ligada, exibe o
 * seletor de papel. As três áreas (aluno, coordenação e administração) usam
 * este componente com os papéis exigidos de cada uma.
 */
export async function ShellArea({
  papeisExigidos,
  destino,
  qualquerPapel,
  children,
}: {
  papeisExigidos: Papel[];
  destino: string;
  /** true quando basta um dos papéis (áreas compartilhadas, como a coordenação). */
  qualquerPapel?: boolean;
  children: React.ReactNode;
}) {
  const usuario = await exigirArea({ papeisExigidos, destino, qualquerPapel });
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

  return (
    <div className="flex min-h-full flex-col">
      <Navbar
        usuario={usuario}
        grupos={grupos}
        seletorDePapel={
          mostrarSeletor ? (
            <SeletorPapel
              contas={contasDeDesenvolvimento().map((conta) => ({
                id: conta.id,
                nome: conta.rotulo,
                papeis: conta.papeis,
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
