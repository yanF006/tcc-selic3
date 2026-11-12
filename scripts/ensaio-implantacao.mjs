#!/usr/bin/env node
// Ensaio de implantação interrompida, retomada e recuperação (tarefa 13.5).
//
// Roda o procedimento de implantação de dados contra um banco de ENSAIO (mesmas
// travas da restauração) e registra cada etapa:
//   1. backup com versão e checksum (13.2);
//   2. inspeção somente leitura (13.1): precisa estar sem conflitos;
//   3. transformação dos dados pessoais, interrompida depois do COMMIT (13.3);
//   4. retomada: nova execução da transformação, que precisa ser idempotente;
//   5. inspeção final;
//   6. caminho alternativo: restauração do backup do passo 1, conferindo contagens.
//
// Uso: DATABASE_URL=<banco de ensaio> SELIC_RESTAURACAO_CONFIRMA=<mesmo nome> \
//      [SELIC_DB_CA_FILE=ca.pem] [SELIC_BACKUP_DIR=dir] node scripts/ensaio-implantacao.mjs
//
// Saída: relatório JSON com o resultado de cada etapa. Sai com código 1 se alguma
// etapa esperada não se comportar como previsto.

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lerConexao } from "./backup-banco.mjs";
import { validarDestino } from "./restaurar-backup.mjs";

const aqui = fileURLToPath(new URL(".", import.meta.url));

function rodar(script, args, env) {
  const resultado = spawnSync(process.execPath, [join(aqui, script), ...args], { env, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return { codigo: resultado.status, saida: resultado.stdout ?? "", erro: (resultado.stderr ?? "").trim() };
}

function maisRecente(diretorio, sufixo) {
  const arquivos = readdirSync(diretorio).filter((nome) => nome.endsWith(sufixo)).sort();
  return arquivos.length ? join(diretorio, arquivos.at(-1)) : null;
}

function principal() {
  const urlTexto = process.env.DATABASE_URL;
  if (!urlTexto) throw new Error("Defina DATABASE_URL apontando ao banco de ensaio.");
  const conexao = lerConexao(urlTexto);
  validarDestino(conexao.banco, process.env.SELIC_RESTAURACAO_CONFIRMA);

  const diretorio = resolve(process.env.SELIC_BACKUP_DIR || "backups");
  const env = { ...process.env };
  const etapas = [];
  const registrar = (etapa, ok, detalhe) => etapas.push({ etapa, ok, detalhe });

  // 1. Backup
  const backup = rodar("backup-banco.mjs", [], { ...env, SELIC_BACKUP_DIR: diretorio });
  const arquivoBackup = backup.codigo === 0 ? maisRecente(diretorio, ".sql") : null;
  registrar("backup", backup.codigo === 0 && !!arquivoBackup, backup.codigo === 0 ? "backup gerado com metadado" : backup.erro);
  if (!arquivoBackup) return etapas;

  // 2. Inspeção inicial: sem conflito para seguir
  const inspecao1 = rodar("inspecionar-destino.mjs", [], env);
  registrar("inspecao_inicial", inspecao1.codigo === 0, inspecao1.codigo === 0 ? "sem conflitos" : `código ${inspecao1.codigo}: decisão necessária`);
  if (inspecao1.codigo !== 0) return etapas;

  // 3. Transformação interrompida após o COMMIT
  const interrompida = rodar("transformar-dados-pessoais.mjs", ["--aplicar"], { ...env, SELIC_ENSAIO_FALHA_APOS_GRAVACAO: "1", SELIC_BACKUP_DIR: diretorio });
  registrar("transformacao_interrompida", interrompida.codigo === 1 && /Interrupção simulada/.test(interrompida.erro), interrompida.codigo === 1 ? "interrompida após gravação, como previsto" : `código inesperado ${interrompida.codigo}`);

  // 4. Retomada: a nova execução precisa ser idempotente e não duplicar linhas
  const retomada = rodar("transformar-dados-pessoais.mjs", ["--aplicar"], { ...env, SELIC_BACKUP_DIR: diretorio });
  const relatorioRetomada = retomada.codigo === 0 ? JSON.parse(retomada.saida) : null;
  registrar(
    "retomada_idempotente",
    retomada.codigo === 0 && relatorioRetomada.gravados === 0 && relatorioRetomada.pendentesDepois === 0,
    relatorioRetomada ? `gravados nesta execução: ${relatorioRetomada.gravados}; pendências: ${relatorioRetomada.pendentesDepois}` : retomada.erro,
  );

  // 5. Inspeção após a retomada
  const inspecao2 = rodar("inspecionar-destino.mjs", [], env);
  const relatorioInspecao2 = inspecao2.codigo === 0 ? JSON.parse(inspecao2.saida) : null;
  registrar(
    "inspecao_final",
    inspecao2.codigo === 0 && relatorioInspecao2.cargaRelacionalPendente === 0,
    relatorioInspecao2 ? `carga relacional pendente: ${relatorioInspecao2.cargaRelacionalPendente}` : `código ${inspecao2.codigo}`,
  );

  // 6. Caminho alternativo: restaurar o backup do passo 1 e conferir contagens
  const restauracao = rodar("restaurar-backup.mjs", ["--arquivo", arquivoBackup, "--limpar"], env);
  registrar("restauracao_do_backup", restauracao.codigo === 0, restauracao.codigo === 0 ? restauracao.saida.trim() : restauracao.erro);

  return etapas;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const etapas = principal();
    process.stdout.write(JSON.stringify({ etapas, concluido: etapas.every((etapa) => etapa.ok) }, null, 2) + "\n");
    process.exitCode = etapas.every((etapa) => etapa.ok) ? 0 : 1;
  } catch (erro) {
    process.stderr.write(`${erro.message}\n`);
    process.exitCode = 1;
  }
}

