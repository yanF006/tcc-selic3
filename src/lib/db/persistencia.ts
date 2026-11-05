import type {
  Campus,
  DadosPessoais,
  MatriculaImportada,
  Papel,
  SituacaoUsuario,
  Usuario,
} from "@/lib/domain/types";
import type { Prisma } from "@/generated/prisma/client";
import {
  matriculasImportadas as matriculasFixture,
  usuarios as usuariosFixture,
} from "@/lib/fixtures/base";

import { bancoConfigurado, carregarCliente, descartarCliente } from "./prisma";
import { BancoIndisponivelError, registrarFalhaBanco } from "./erros";
import { obterEstado } from "@/lib/services/store";

/**
 * Ponte entre o simulador em memória (D4) e o MySQL do Aiven.
 *
 * Estratégia (escopo "usuários + matrículas"):
 *
 * - **Hidratação:** o banco é a fonte da verdade de `estado.usuarios` e
 *   `estado.matriculas`. Um banco vazio é semeado com as fixtures, para o login
 *   de demonstração continuar funcionando. O restante do estado (estágios,
 *   documentos, pareceres...) segue nas fixtures.
 * - **Escrita contínua:** toda mutação atualiza a memória (como antes) e é
 *   gravada no banco. Assim os demais serviços, que leem a memória de forma
 *   síncrona, continuam funcionando sem mudanças e os dados sobrevivem ao
 *   reinício do processo.
 *
 * Com `DATABASE_URL` configurada, uma falha **não** vira sucesso com fixtures:
 * `garantirHidratacao()` rejeita com `BancoIndisponivelError` e a tela mostra
 * indisponibilidade. O snapshot tem validade curta (2 s por padrão) e a falha
 * tem cooldown curto, permitindo nova tentativa na requisição seguinte.
 *
 * Sem `DATABASE_URL` — e sempre sob testes unitários sem mock — nada disto é
 * ativado: o simulador se comporta exatamente como antes.
 */

export type ModoPersistencia = "simulado" | "pronto" | "falha";

interface EstadoPersistencia {
  modo: ModoPersistencia;
  hidratacao: Promise<void> | null;
  ultimaHidratacaoEm: number | null;
  proximaTentativaEm: number;
  ultimoErro: BancoIndisponivelError | null;
}

const TTL_SNAPSHOT_PADRAO_MS = 2_000;
const COOLDOWN_RETRY_PADRAO_MS = 1_000;

function numeroDoAmbiente(chave: string, padrao: number): number {
  const bruto = process.env[chave];
  const numero = bruto ? Number(bruto) : NaN;

  return Number.isFinite(numero) && numero >= 0 ? Math.trunc(numero) : padrao;
}

function ttlSnapshotMs(): number {
  return numeroDoAmbiente("SELIC_DB_SNAPSHOT_TTL_MS", TTL_SNAPSHOT_PADRAO_MS);
}

function cooldownRetryMs(): number {
  return numeroDoAmbiente("SELIC_DB_RETRY_COOLDOWN_MS", COOLDOWN_RETRY_PADRAO_MS);
}

/**
 * Com banco configurado, o estado inicial é `falha` sem tentativa registrada:
 * `proximaTentativaEm = 0` libera a primeira leitura. Assim não existe um
 * quarto estado para "ainda não tentei".
 */
function estadoInicial(): EstadoPersistencia {
  return {
    modo: bancoConfigurado() ? "falha" : "simulado",
    hidratacao: null,
    ultimaHidratacaoEm: null,
    proximaTentativaEm: 0,
    ultimoErro: null,
  };
}

let estado = estadoInicial();

/** Visão somente leitura do estado, usada nos testes e no diagnóstico. */
export function estadoDaPersistencia(): {
  modo: ModoPersistencia;
  ultimaHidratacaoEm: number | null;
  proximaTentativaEm: number;
} {
  return {
    modo: bancoConfigurado() ? estado.modo : "simulado",
    ultimaHidratacaoEm: estado.ultimaHidratacaoEm,
    proximaTentativaEm: estado.proximaTentativaEm,
  };
}

/** Reinicia a máquina de estados entre testes. */
export function reiniciarPersistenciaParaTestes(): void {
  estado = estadoInicial();
}

function erroAtual(): BancoIndisponivelError {
  return estado.ultimoErro ?? new BancoIndisponivelError();
}

function snapshotValido(): boolean {
  return (
    estado.modo === "pronto" &&
    estado.ultimaHidratacaoEm !== null &&
    Date.now() - estado.ultimaHidratacaoEm < ttlSnapshotMs()
  );
}

/**
 * Garante que `estado.usuarios`/`estado.matriculas` refletem o banco.
 *
 * - simulado: resolve imediatamente;
 * - pronto dentro do TTL: reutiliza o snapshot;
 * - pronto expirado ou falha após o cooldown: dispara uma única hidratação;
 * - falha dentro do cooldown: rejeita imediatamente com o último erro.
 */
export function garantirHidratacao(): Promise<void> {
  if (!bancoConfigurado()) {
    estado.modo = "simulado";

    return Promise.resolve();
  }

  if (snapshotValido()) return Promise.resolve();

  if (estado.hidratacao) return estado.hidratacao;

  if (estado.modo === "falha" && Date.now() < estado.proximaTentativaEm) {
    return Promise.reject(erroAtual());
  }

  const inicio = Date.now();
  const tentativa = hidratar()
    .then(() => {
      estado.modo = "pronto";
      estado.ultimaHidratacaoEm = Date.now();
      estado.proximaTentativaEm = 0;
      estado.ultimoErro = null;
    })
    .catch((causa) => {
      const erro =
        causa instanceof BancoIndisponivelError ? causa : new BancoIndisponivelError(causa);

      estado.modo = "falha";
      estado.ultimaHidratacaoEm = null;
      estado.proximaTentativaEm = Date.now() + cooldownRetryMs();
      estado.ultimoErro = erro;
      descartarCliente();
      registrarFalhaBanco(causa, Date.now() - inicio);

      throw erro;
    })
    .finally(() => {
      estado.hidratacao = null;
    });

  estado.hidratacao = tentativa;

  return tentativa;
}

async function hidratar(): Promise<void> {
  const { prisma, Prisma } = await carregarCliente();

  const [totalUsuarios, totalMatriculas] = await Promise.all([
    prisma.usuario.count(),
    prisma.matriculaImportada.count(),
  ]);

  if (totalUsuarios === 0) {
    await prisma.usuario.createMany({
      data: usuariosFixture.map((usuario) =>
        paraBancoUsuario(Prisma, usuario),
      ) as Prisma.UsuarioCreateManyInput[],
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

  const estadoAtual = obterEstado();

  estadoAtual.usuarios.splice(0, estadoAtual.usuarios.length, ...usuarios.map(paraDominioUsuario));
  estadoAtual.matriculas.splice(
    0,
    estadoAtual.matriculas.length,
    ...matriculas.map(paraDominioMatricula),
  );
}

/**
 * Executa uma escrita e renova o snapshot em caso de sucesso. Se a conexão
 * falhar, invalida o snapshot e transforma a falha em `BancoIndisponivelError`,
 * para a próxima leitura reidratar em vez de servir memória possivelmente parcial.
 */
async function executarEscrita<T>(operacao: () => Promise<T>): Promise<T> {
  const inicio = Date.now();

  try {
    const resultado = await operacao();

    renovarSnapshot();

    return resultado;
  } catch (causa) {
    const erro =
      causa instanceof BancoIndisponivelError ? causa : new BancoIndisponivelError(causa);

    estado.modo = "falha";
    estado.ultimaHidratacaoEm = null;
    estado.proximaTentativaEm = Date.now() + cooldownRetryMs();
    estado.ultimoErro = erro;
    descartarCliente();
    registrarFalhaBanco(causa, Date.now() - inicio);

    throw erro;
  }
}

/**
 * Renova a validade do snapshot depois de uma mutação bem-sucedida. Só vale
 * quando o estado já estava `pronto`; uma escrita isolada não deve promover
 * memória não hidratada a fonte de verdade.
 */
function renovarSnapshot(): void {
  if (!bancoConfigurado()) return;

  if (estado.modo === "pronto") {
    estado.ultimaHidratacaoEm = Date.now();
  }
}

function podeEscrever(): boolean {
  if (!bancoConfigurado()) return false;

  if (estado.modo === "falha") throw erroAtual();

  return true;
}

/** Cria ou atualiza o usuário no banco. No-op sem banco configurado. */
export async function gravarUsuario(usuario: Usuario): Promise<void> {
  if (!podeEscrever()) return;

  await executarEscrita(async () => {
    const { prisma, Prisma } = await carregarCliente();
    const dados = paraBancoUsuario(Prisma, usuario);

    const atualizado = await prisma.usuario.updateMany({
      where: { id: usuario.id },
      data: dados as Prisma.UsuarioUpdateManyMutationInput,
    });

    if (atualizado.count === 0) {
      await prisma.usuario.create({ data: dados as Prisma.UsuarioCreateInput });
    }
  });
}

/** Remove o usuário do banco (a memória é ajustada por quem chama). */
export async function excluirUsuarioDoBanco(id: string): Promise<void> {
  if (!podeEscrever()) return;

  await executarEscrita(async () => {
    const { prisma } = await carregarCliente();

    await prisma.usuario.deleteMany({ where: { id } });
  });
}

/** Cria ou atualiza a matrícula no banco. No-op sem banco configurado. */
export async function gravarMatricula(registro: MatriculaImportada): Promise<void> {
  if (!podeEscrever()) return;

  await executarEscrita(async () => {
    const { prisma } = await carregarCliente();
    const dados = paraBancoMatricula(registro);

    const atualizado = await prisma.matriculaImportada.updateMany({
      where: { id: registro.id },
      data: dados,
    });

    if (atualizado.count === 0) {
      await prisma.matriculaImportada.create({ data: dados });
    }
  });
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
