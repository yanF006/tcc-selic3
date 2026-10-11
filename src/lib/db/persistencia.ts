import type {
  Campus,
  DadosPessoais,
  MatriculaImportada,
  Papel,
  SituacaoUsuario,
  Usuario,
} from "@/lib/domain/types";
import type { Prisma } from "@/generated/prisma/client";
import { matriculasImportadas as matriculasFixture, usuarios as usuariosFixture } from "@/lib/fixtures/base";

import { bancoConfigurado, carregarCliente } from "./prisma";
import { obterEstado } from "@/lib/services/store";

/**
 * Ponte entre o simulador em memória (D4) e o MySQL do Aiven.
 *
 * Estratégia (escopo "usuários + matrículas"):
 *
 * - **Hidratação:** na primeira leitura, o banco passa a ser a fonte da verdade
 *   de `estado.usuarios` e `estado.matriculas`. Um banco vazio é semeado com as
 *   fixtures, para o login de demonstração continuar funcionando. O restante do
 *   estado (estágios, documentos, pareceres...) segue nas fixtures.
 * - **Escrita contínua:** toda mutação atualiza a memória (como antes) e é
 *   gravada no banco. Assim os demais serviços, que leem a memória de forma
 *   síncrona, continuam funcionando sem mudanças e os dados sobrevivem ao
 *   reinício do processo.
 *
 * Sem `DATABASE_URL` — e sempre sob testes — nada disto é ativado: o simulador
 * se comporta exatamente como antes.
 */

let hidratacao: Promise<void> | null = null;

/**
 * `null` = ainda não tentou; `true` = banco usado; `false` = inacessível.
 *
 * Depois de uma falha de conexão, o processo segue em memória até reiniciar:
 * insistir traria um `pool timeout` de ~10 s em cada leitura e derrubaria as
 * telas. É o mesmo comportamento sem `DATABASE_URL`, só que registrado no log.
 */
let disponivel: boolean | null = null;

/** true quando existe banco configurado e a conexão já se mostrou utilizável. */
function podeGravar(): boolean {
  return bancoConfigurado() && disponivel !== false;
}

/** Garante que `estado.usuarios`/`estado.matriculas` refletem o banco. */
export function garantirHidratacao(): Promise<void> {
  if (!bancoConfigurado() || disponivel === false) return Promise.resolve();

  if (!hidratacao) {
    hidratacao = hidratar()
      .then(() => {
        disponivel = true;
      })
      .catch((erro) => {
        disponivel = false;
        hidratacao = null;
        console.warn(
          "[persistencia] Banco indisponível; seguindo em memória até reiniciar o processo.",
          erro instanceof Error ? erro.message : erro,
        );
      });
  }

  return hidratacao;
}

async function hidratar(): Promise<void> {
  const { prisma, Prisma } = await carregarCliente();

  const [totalUsuarios, totalMatriculas] = await Promise.all([
    prisma.usuario.count(),
    prisma.matriculaImportada.count(),
  ]);

  if (totalUsuarios === 0) {
    await prisma.usuario.createMany({
      data: usuariosFixture.map((usuario) => paraBancoUsuario(Prisma, usuario)) as Prisma.UsuarioCreateManyInput[],
    });
  }

  if (totalMatriculas === 0) {
    await prisma.matriculaImportada.createMany({
      data: matriculasFixture.map(paraBancoMatricula),
    });
  }

  const [usuarios, matriculas] = await Promise.all([
    prisma.usuario.findMany({ orderBy: { criadoEm: "asc" } }),
    prisma.matriculaImportada.findMany({ orderBy: { importadaEm: "asc" } }),
  ]);

  const estado = obterEstado();

  estado.usuarios.splice(0, estado.usuarios.length, ...usuarios.map(paraDominioUsuario));
  estado.matriculas.splice(0, estado.matriculas.length, ...matriculas.map(paraDominioMatricula));
}

/** Cria ou atualiza o usuário no banco. No-op sem banco configurado. */
export async function gravarUsuario(usuario: Usuario): Promise<void> {
  if (!podeGravar()) return;

  const { prisma, Prisma } = await carregarCliente();
  const dados = paraBancoUsuario(Prisma, usuario);

  const atualizado = await prisma.usuario.updateMany({
    where: { id: usuario.id },
    data: dados as Prisma.UsuarioUpdateManyMutationInput,
  });

  if (atualizado.count === 0) {
    await prisma.usuario.create({ data: dados as Prisma.UsuarioCreateInput });
  }
}

/** Remove o usuário do banco (a memória é ajustada por quem chama). */
export async function excluirUsuarioDoBanco(id: string): Promise<void> {
  if (!podeGravar()) return;

  const { prisma } = await carregarCliente();

  await prisma.usuario.deleteMany({ where: { id } });
}

/** Cria ou atualiza a matrícula no banco. No-op sem banco configurado. */
export async function gravarMatricula(registro: MatriculaImportada): Promise<void> {
  if (!podeGravar()) return;

  const { prisma } = await carregarCliente();
  const dados = paraBancoMatricula(registro);

  const atualizado = await prisma.matriculaImportada.updateMany({
    where: { id: registro.id },
    data: dados,
  });

  if (atualizado.count === 0) {
    await prisma.matriculaImportada.create({ data: dados });
  }
}

function paraBancoUsuario(P: typeof Prisma, usuario: Usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papeis: usuario.papeis,
    situacao: usuario.situacao,
    campus: usuario.campus,
    matricula: usuario.matricula ?? null,
    cursoId: usuario.cursoId ?? null,
    membroComissaoEstagio: usuario.membroComissaoEstagio ?? false,
    dadosPessoais: usuario.dadosPessoais
      ? (usuario.dadosPessoais as unknown as Prisma.InputJsonValue)
      : P.DbNull,
    criadoEm: new Date(usuario.criadoEm),
  };
}

function paraBancoMatricula(registro: MatriculaImportada) {
  return {
    id: registro.id,
    matricula: registro.matricula,
    nome: registro.nome,
    curso: registro.curso,
    origem: registro.origem,
    importadaEm: new Date(registro.importadaEm),
  };
}

function paraDominioUsuario(linha: {
  id: string;
  nome: string;
  email: string;
  papeis: unknown;
  situacao: string;
  campus: string;
  matricula: string | null;
  cursoId: string | null;
  membroComissaoEstagio: boolean;
  dadosPessoais: unknown;
  criadoEm: Date;
}): Usuario {
  return {
    id: linha.id,
    nome: linha.nome,
    email: linha.email,
    papeis: linha.papeis as Papel[],
    situacao: linha.situacao as SituacaoUsuario,
    campus: linha.campus as Campus,
    matricula: linha.matricula ?? undefined,
    cursoId: linha.cursoId ?? undefined,
    membroComissaoEstagio: linha.membroComissaoEstagio,
    dadosPessoais: (linha.dadosPessoais as DadosPessoais | null) ?? undefined,
    criadoEm: linha.criadoEm.toISOString(),
  };
}

function paraDominioMatricula(linha: {
  id: string;
  matricula: string;
  nome: string;
  curso: string;
  origem: string;
  importadaEm: Date;
}): MatriculaImportada {
  return {
    id: linha.id,
    matricula: linha.matricula,
    nome: linha.nome,
    curso: linha.curso,
    origem: linha.origem as MatriculaImportada["origem"],
    importadaEm: linha.importadaEm.toISOString(),
  };
}
