#!/usr/bin/env node
// Transformação versionada: dados pessoais JSON -> dados_pessoais_alunos (tarefa 13.3).
//
// Uso:
//   DATABASE_URL=... [SELIC_DB_CA_FILE=ca.pem] [SELIC_BACKUP_DIR=dir] node scripts/transformar-dados-pessoais.mjs         # ensaio
//   ... node scripts/transformar-dados-pessoais.mjs --aplicar                                                             # grava
//
// Regras:
//  - Antes de tudo, roda a inspeção (13.1). Qualquer conflito interrompe a
//    transformação: não há escolha automática de conta nem correção por suposição.
//  - Cada aluno com JSON e sem linha relacional é validado: CPF com 11 dígitos,
//    data válida, endereço em objeto, e vínculos de curso, turma e período
//    preenchidos e existentes no catálogo. Qualquer falha vira conflito.
//  - IDs são preservados: a linha relacional usa `dpa-<usuarioId>` e nunca altera
//    usuarios, matrículas ou situações.
//  - A gravação é uma única transação. Se qualquer passo falhar, nada é confirmado.
//  - Depois da gravação, confere contagens e que a pendência chegou a zero.
// Versão da transformação: TRANSFORMACAO_VERSAO (registrada no relatório).

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { lerConexao } from "./backup-banco.mjs";
import { inspecionar } from "./inspecionar-destino.mjs";

export const TRANSFORMACAO_VERSAO = "13.3-dados-pessoais-v1";

function mysql(conexao, ca, env, sql) {
  const args = ["-h", conexao.host, "-P", conexao.port, "-u", conexao.user, "--default-character-set=utf8mb4", "-N", "-B", conexao.banco, "-e", sql];
  if (ca) args.push(`--ssl-ca=${ca}`, "--ssl-mode=VERIFY_CA");
  const resultado = spawnSync("mysql", args, { env, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (resultado.status !== 0) {
    const primeira = (resultado.stderr || "").split("\n").find((linha) => linha.trim()) ?? "";
    throw new Error(`Comando SQL falhou (código ${resultado.status}). ${primeira.replace(/password[^ ]*/gi, "***")}`);
  }
  return resultado.stdout.split("\n").filter(Boolean).map((linha) => linha.split("\t"));
}

function anonimo(valor) {
  return createHash("sha256").update(String(valor)).digest("hex").slice(0, 12);
}

/** Texto seguro para literal SQL: escapa barra invertida, aspas e quebras de linha. */
export function sqlTexto(valor) {
  return `'${String(valor).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\0/g, "\\0").replace(/\n/g, "\\n").replace(/\r/g, "\\r")}'`;
}

/** Valida um registro legado. Devolve os campos normalizados ou o motivo da recusa. */
export function validarRegistro(linha) {
  const cpf = String(linha.cpf ?? "").replace(/\D/g, "");
  if (!/^\d{11}$/.test(cpf)) return { erro: "cpf_invalido" };
  const rg = String(linha.rg ?? "").trim();
  if (!rg || rg.length > 20) return { erro: "rg_invalido" };
  const nascimento = String(linha.dataNascimento ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento) || Number.isNaN(Date.parse(nascimento))) return { erro: "data_nascimento_invalida" };
  const telefone = String(linha.telefone ?? "").trim();
  const celular = String(linha.celular ?? "").trim();
  if (!telefone || telefone.length > 20 || !celular || celular.length > 20) return { erro: "contato_invalido" };
  let endereco;
  try {
    endereco = typeof linha.endereco === "string" ? JSON.parse(linha.endereco) : linha.endereco;
  } catch {
    return { erro: "endereco_invalido" };
  }
  if (!endereco || typeof endereco !== "object" || Array.isArray(endereco)) return { erro: "endereco_invalido" };
  for (const campo of ["cursoId", "turmaId", "periodoId"]) {
    if (!linha[campo]) return { erro: `${campo}_ausente` };
  }
  return { valor: { cpf, rg, dataNascimento: nascimento, telefone, celular, endereco: JSON.stringify(endereco), cursoId: linha.cursoId, turmaId: linha.turmaId, periodoId: linha.periodoId } };
}

/** Checksum da identidade das contas (id, e-mail, cargo, situação, matrícula). Só leitura. */
export function checksumIdentidades(conexao, ca, env) {
  const [[valor]] = mysql(conexao, ca, env, `
    SET SESSION group_concat_max_len = 1000000000;
    SELECT SHA2(COALESCE(GROUP_CONCAT(CONCAT_WS('|', id, email, papel, situacao, COALESCE(matricula, '')) ORDER BY id SEPARATOR '\\n'), ''), 256) FROM usuarios`).slice(-1);
  return valor;
}

function candidatos(conexao, ca, env) {
  // Uma linha por aluno pendente; só leitura.
  return mysql(conexao, ca, env, `
    SELECT u.id,
      JSON_UNQUOTE(JSON_EXTRACT(u.dadosPessoais,'$.cpf')),
      JSON_UNQUOTE(JSON_EXTRACT(u.dadosPessoais,'$.rg')),
      JSON_UNQUOTE(JSON_EXTRACT(u.dadosPessoais,'$.dataNascimento')),
      JSON_UNQUOTE(JSON_EXTRACT(u.dadosPessoais,'$.telefone')),
      JSON_UNQUOTE(JSON_EXTRACT(u.dadosPessoais,'$.celular')),
      JSON_EXTRACT(u.dadosPessoais,'$.endereco'),
      JSON_UNQUOTE(JSON_EXTRACT(u.dadosPessoais,'$.cursoId')),
      JSON_UNQUOTE(JSON_EXTRACT(u.dadosPessoais,'$.turmaId')),
      JSON_UNQUOTE(JSON_EXTRACT(u.dadosPessoais,'$.periodoId'))
    FROM usuarios u
    WHERE u.dadosPessoais IS NOT NULL AND u.papel = 'aluno'
      AND u.id NOT IN (SELECT usuarioId FROM dados_pessoais_alunos)
    ORDER BY u.id`).map(([id, cpf, rg, dataNascimento, telefone, celular, endereco, cursoId, turmaId, periodoId]) => ({
      id, cpf, rg, dataNascimento, telefone, celular, endereco, cursoId, turmaId, periodoId,
    }));
}

function principal() {
  const urlTexto = process.env.DATABASE_URL;
  if (!urlTexto) throw new Error("Defina DATABASE_URL.");
  const aplicar = process.argv.includes("--aplicar");
  const conexao = lerConexao(urlTexto);
  const ca = process.env.SELIC_DB_CA_FILE;
  const env = { ...process.env, MYSQL_PWD: conexao.password };
  const diretorio = resolve(process.env.SELIC_BACKUP_DIR || "backups");

  const inspecao = inspecionar(conexao, ca, env);
  if (inspecao.decisaoNecessaria) {
    process.stderr.write(`Transformação interrompida: ${inspecao.conflitos.length} conflito(s) exigem decisão antes da conversão. Nenhuma alteração foi feita.\n`);
    process.exitCode = 2;
    return;
  }

  const linhas = candidatos(conexao, ca, env);
  const identidadesAntes = checksumIdentidades(conexao, ca, env);
  const aceitos = [];
  const recusados = [];
  for (const linha of linhas) {
    const resultado = validarRegistro(linha);
    if (resultado.erro) recusados.push({ anonimo: anonimo(linha.id), motivo: resultado.erro });
    else aceitos.push({ id: linha.id, ...resultado.valor });
  }

  const relatorio = {
    versao: TRANSFORMACAO_VERSAO,
    modo: aplicar ? "aplicar" : "ensaio",
    banco: conexao.banco,
    pendentesAntes: linhas.length,
    aceitos: aceitos.length,
    recusados,
    checksumEntrada: createHash("sha256").update(JSON.stringify(linhas.map(({ id, cpf, rg, dataNascimento, telefone, celular, endereco, cursoId, turmaId, periodoId }) => [id, cpf, rg, dataNascimento, telefone, celular, endereco, cursoId, turmaId, periodoId]))).digest("hex"),
  };

  if (recusados.length > 0) {
    process.stderr.write(`Transformação interrompida: ${recusados.length} registro(s) incompleto(s) ou inválido(s). Nenhuma alteração foi feita.\n`);
    process.stdout.write(JSON.stringify(relatorio, null, 2) + "\n");
    process.exitCode = 2;
    return;
  }

  if (aplicar && aceitos.length > 0) {
    const insercoes = aceitos.map((registro) =>
      `INSERT INTO dados_pessoais_alunos (id, usuarioId, cpf, rg, dataNascimento, telefone, celular, endereco, cursoId, turmaId, periodoId, criadoEm, atualizadoEm) VALUES (${sqlTexto(`dpa-${registro.id}`)}, ${sqlTexto(registro.id)}, ${sqlTexto(registro.cpf)}, ${sqlTexto(registro.rg)}, ${sqlTexto(registro.dataNascimento)}, ${sqlTexto(registro.telefone)}, ${sqlTexto(registro.celular)}, ${sqlTexto(registro.endereco)}, ${sqlTexto(registro.cursoId)}, ${sqlTexto(registro.turmaId)}, ${sqlTexto(registro.periodoId)}, NOW(3), NOW(3));`,
    );
    // Uma única transação: falha em qualquer INSERT deixa o banco como estava.
    const script = ["START TRANSACTION;", ...insercoes, "COMMIT;"].join("\n");
    const resultado = spawnSync("mysql", ["-h", conexao.host, "-P", conexao.port, "-u", conexao.user, "--default-character-set=utf8mb4", conexao.banco, ...(ca ? [`--ssl-ca=${ca}`, "--ssl-mode=VERIFY_CA"] : [])], { env, input: script, encoding: "utf8" });
    if (resultado.status !== 0) {
      throw new Error(`Gravação revertida (transação não confirmada): código ${resultado.status}.`);
    }
  }

  // Gancho de ensaio: interrompe depois do COMMIT para simular uma implantação
  // que cai no meio. Só vale para bancos de ensaio; em outros destinos é ignorado.
  if (aplicar && process.env.SELIC_ENSAIO_FALHA_APOS_GRAVACAO === "1" && /(_ensaio|_restauracao|_teste)$/.test(conexao.banco)) {
    throw new Error("Interrupção simulada após a gravação (ensaio de implantação).");
  }

  const pendentesDepois = candidatos(conexao, ca, env).length;
  relatorio.pendentesDepois = pendentesDepois;
  relatorio.identidadesPreservadas = checksumIdentidades(conexao, ca, env) === identidadesAntes;
  relatorio.gravados = aplicar ? aceitos.length : 0;
  relatorio.contagemRelacional = Number(mysql(conexao, ca, env, "SELECT COUNT(*) FROM dados_pessoais_alunos")[0][0]);

  mkdirSync(diretorio, { recursive: true });
  const registro = join(diretorio, `transformacao-${TRANSFORMACAO_VERSAO}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(registro, JSON.stringify(relatorio, null, 2) + "\n", { mode: 0o600 });

  process.stdout.write(JSON.stringify({ ...relatorio, relatorio: registro }, null, 2) + "\n");
  if (!relatorio.identidadesPreservadas) {
    throw new Error("Identidades das contas mudaram durante a transformação: revisar antes de seguir.");
  }
  if (aplicar && pendentesDepois !== 0) {
    throw new Error("Pendências remanescentes após a gravação: revisar antes de seguir.");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    principal();
  } catch (erro) {
    process.stderr.write(`${erro.message}\n`);
    process.exitCode = 1;
  }
}
