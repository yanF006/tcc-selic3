import "server-only";

import type { MatriculaImportada, Usuario } from "@/lib/domain/types";
import {
  matriculasImportadas as matriculasFixture,
  usuarios as usuariosFixture,
} from "@/lib/fixtures/base";

import { bancoConfigurado, carregarCliente, descartarCliente } from "./prisma";
import { BancoIndisponivelError, registrarFalhaBanco, traduzirErroPersistencia } from "./erros";
import { criarRepositorioMatriculas } from "./repositorios/matriculas";
import { criarRepositorioUsuarios } from "./repositorios/usuarios";
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
      const erro = traduzirErroPersistencia(causa);
      estado.ultimaHidratacaoEm = null;
      if (!(erro instanceof BancoIndisponivelError)) throw erro;

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
  const usuariosRepositorio = criarRepositorioUsuarios(prisma, Prisma);
  const matriculasRepositorio = criarRepositorioMatriculas(prisma);

  const [totalUsuarios, totalMatriculas] = await Promise.all([
    usuariosRepositorio.contar(),
    matriculasRepositorio.contar(),
  ]);

  if (totalUsuarios === 0) {
    await usuariosRepositorio.salvarMuitos(usuariosFixture);
  }

  if (totalMatriculas === 0) {
    await matriculasRepositorio.salvarMuitos(matriculasFixture);
  }

  const [usuarios, matriculas] = await Promise.all([
    usuariosRepositorio.listar(),
    matriculasRepositorio.listar(),
  ]);

  const estadoAtual = obterEstado();

  estadoAtual.usuarios.splice(0, estadoAtual.usuarios.length, ...usuarios);
  estadoAtual.matriculas.splice(0, estadoAtual.matriculas.length, ...matriculas);
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
    const erro = traduzirErroPersistencia(causa);
    if (!(erro instanceof BancoIndisponivelError)) throw erro;

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

/** Cria o usuário no banco. Conflito de ID não atualiza o registro existente. */
export async function criarUsuario(usuario: Usuario): Promise<void> {
  if (!podeEscrever()) return;

  await executarEscrita(async () => {
    const { prisma, Prisma } = await carregarCliente();
    const repositorio = criarRepositorioUsuarios(prisma, Prisma);

    await repositorio.criar(usuario);
  });
}

/** Atualiza um usuário existente. Alvo ausente não cria outro registro. */
export async function atualizarUsuario(usuario: Usuario): Promise<void> {
  if (!podeEscrever()) return;

  await executarEscrita(async () => {
    const { prisma, Prisma } = await carregarCliente();
    await prisma.$transaction(async (tx) => {
      await criarRepositorioUsuarios(tx, Prisma).atualizar(usuario);
      if (usuario.situacao !== "ativo") {
        await tx.authSession.deleteMany({ where: { userId: usuario.id } });
      }
    });
  });
}

/** Remove o usuário do banco (a memória é ajustada por quem chama). */
export async function excluirUsuarioDoBanco(id: string): Promise<void> {
  if (!podeEscrever()) return;

  await executarEscrita(async () => {
    const { prisma, Prisma } = await carregarCliente();
    const repositorio = criarRepositorioUsuarios(prisma, Prisma);

    await repositorio.excluir(id);
  });
}

/** Cria a matrícula no banco. Conflito não atualiza o registro existente. */
export async function criarMatricula(registro: MatriculaImportada): Promise<void> {
  if (!podeEscrever()) return;

  await executarEscrita(async () => {
    const { prisma } = await carregarCliente();
    const repositorio = criarRepositorioMatriculas(prisma);

    await repositorio.criar(registro);
  });
}

/** Atualiza uma matrícula existente. Alvo ausente não cria outro registro. */
export async function atualizarMatricula(registro: MatriculaImportada): Promise<void> {
  if (!podeEscrever()) return;

  await executarEscrita(async () => {
    const { prisma } = await carregarCliente();
    const repositorio = criarRepositorioMatriculas(prisma);

    await repositorio.atualizar(registro);
  });
}
