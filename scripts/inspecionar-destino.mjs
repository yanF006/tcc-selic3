#!/usr/bin/env node
// Inspeção somente leitura do banco de destino antes da transformação (tarefa 13.1).
//
// Uso: DATABASE_URL=... [SELIC_DB_CA_FILE=ca.pem] node scripts/inspecionar-destino.mjs
//
// Só executa SELECT. Não escolhe, altera nem exclui contas. O relatório é
// sanitizado: contagens e identificadores anonimizados (hash curto), sem nome,
// e-mail, CPF, matrícula ou conteúdo de documento.
// Saída 0: sem conflitos. Saída 2: há conflitos que exigem decisão explícita antes
// da transformação. Saída 1: falha de conexão ou de leitura.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lerConexao, contagensPorTabela } from "./backup-banco.mjs";

const PAPEIS_VALIDOS = ["aluno", "coordenador_curso", "coordenador_estagio", "administrador"];

function anonimo(valor) {
  return createHash("sha256").update(String(valor)).digest("hex").slice(0, 12);
}

function consultar(conexao, ca, env, sql) {
  const args = ["-h", conexao.host, "-P", conexao.port, "-u", conexao.user, "--default-character-set=utf8mb4", "-N", "-B", conexao.banco, "-e", sql];
  if (ca) args.push(`--ssl-ca=${ca}`, "--ssl-mode=VERIFY_CA");
  const resultado = spawnSync("mysql", args, { env, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (resultado.status !== 0) {
    const primeira = (resultado.stderr || "").split("\n").find((linha) => linha.trim()) ?? "";
    throw new Error(`Leitura falhou (código ${resultado.status}). ${primeira.replace(/password[^ ]*/gi, "***")}`);
  }
  return resultado.stdout.split("\n").filter(Boolean).map((linha) => linha.split("\t"));
}

export function inspecionar(conexao, ca, env) {
  const conflitos = [];
  const contagens = contagensPorTabela(conexao, ca, env);
  const ler = (sql) => consultar(conexao, ca, env, sql);

  // Identificadores anonimizados de linhas que precisam de decisão; nunca os dados em si.
  const ids = (sql) => ler(sql).map(([id]) => anonimo(id));

  // Cargo: a conversão para cargo único só aceita um dos papéis válidos.
  const papeisInvalidos = ids(
    `SELECT id FROM usuarios WHERE papel IS NULL OR papel NOT IN (${PAPEIS_VALIDOS.map((p) => `'${p}'`).join(",")})`,
  );
  if (papeisInvalidos.length) conflitos.push({ tipo: "cargo_invalido_ou_ausente", quantidade: papeisInvalidos.length, anonimos: papeisInvalidos });

  const cursoSemVinculo = ids(
    "SELECT id FROM usuarios WHERE papel = 'coordenador_curso' AND (cursoId IS NULL OR cursoId NOT IN (SELECT id FROM cursos))",
  );
  if (cursoSemVinculo.length) conflitos.push({ tipo: "coordenador_sem_curso_valido", quantidade: cursoSemVinculo.length, anonimos: cursoSemVinculo });

  // Duplicidades depois de normalizar (trim + minúsculas), que a identidade única exige.
  const emailsDuplicados = ler(
    "SELECT COUNT(*) FROM (SELECT LOWER(TRIM(email)) e FROM usuarios GROUP BY e HAVING COUNT(*) > 1) d",
  )[0][0];
  if (Number(emailsDuplicados) > 0) conflitos.push({ tipo: "email_duplicado_normalizado", quantidade: Number(emailsDuplicados) });

  const matriculasDuplicadas = ler(
    "SELECT COUNT(*) FROM (SELECT TRIM(matricula) m FROM usuarios WHERE matricula IS NOT NULL AND TRIM(matricula) <> '' GROUP BY m HAVING COUNT(*) > 1) d",
  )[0][0];
  if (Number(matriculasDuplicadas) > 0) conflitos.push({ tipo: "matricula_duplicada_em_usuarios", quantidade: Number(matriculasDuplicadas) });

  // Referências acadêmicas no JSON legado que não existem no catálogo.
  const refsAusentes = ler(`
    SELECT COUNT(*) FROM usuarios u
    WHERE u.dadosPessoais IS NOT NULL AND (
      (JSON_UNQUOTE(JSON_EXTRACT(u.dadosPessoais,'$.cursoId')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(u.dadosPessoais,'$.cursoId')) NOT IN (SELECT id FROM cursos))
      OR (JSON_UNQUOTE(JSON_EXTRACT(u.dadosPessoais,'$.turmaId')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(u.dadosPessoais,'$.turmaId')) NOT IN (SELECT id FROM turmas))
      OR (JSON_UNQUOTE(JSON_EXTRACT(u.dadosPessoais,'$.periodoId')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(u.dadosPessoais,'$.periodoId')) NOT IN (SELECT id FROM periodos))
    )`)[0][0];
  if (Number(refsAusentes) > 0) conflitos.push({ tipo: "referencia_academica_ausente_no_catalogo", quantidade: Number(refsAusentes) });

  // Alunos com JSON pessoal ainda sem linha relacional: carga pendente da 13.3.
  const cargaPendente = Number(ler(`
    SELECT COUNT(*) FROM usuarios u
    WHERE u.dadosPessoais IS NOT NULL AND u.papel = 'aluno'
      AND u.id NOT IN (SELECT usuarioId FROM dados_pessoais_alunos)`)[0][0]);

  // Conta pendente sem solicitação registrada: só se reconstrói com dados verificáveis
  // e decisão de migração registrada. A inspeção apenas aponta; não cria nada.
  const pendentesSemSolicitacao = ids(
    "SELECT u.id FROM usuarios u WHERE u.situacao = 'pendente' AND u.id NOT IN (SELECT usuarioId FROM solicitacoes_acesso)",
  );
  if (pendentesSemSolicitacao.length) conflitos.push({ tipo: "conta_pendente_sem_solicitacao", quantidade: pendentesSemSolicitacao.length, anonimos: pendentesSemSolicitacao });

  // Documentos sem definição salva não podem ser reabertos com fidelidade.
  const documentosSemDefinicao = Number(ler("SELECT COUNT(*) FROM documentos_preenchidos WHERE definicaoSnapshot IS NULL")[0][0]);
  if (documentosSemDefinicao > 0) conflitos.push({ tipo: "documento_sem_definicao_salva", quantidade: documentosSemDefinicao });

  return {
    banco: conexao.banco,
    tabelas: Object.keys(contagens).length,
    contagens,
    cargaRelacionalPendente: cargaPendente,
    conflitos,
    decisaoNecessaria: conflitos.length > 0,
  };
}

function principal() {
  const urlTexto = process.env.DATABASE_URL;
  if (!urlTexto) throw new Error("Defina DATABASE_URL.");
  const conexao = lerConexao(urlTexto);
  const ca = process.env.SELIC_DB_CA_FILE;
  const env = { ...process.env, MYSQL_PWD: conexao.password };
  const relatorio = inspecionar(conexao, ca, env);
  process.stdout.write(JSON.stringify(relatorio, null, 2) + "\n");
  process.exitCode = relatorio.decisaoNecessaria ? 2 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    principal();
  } catch (erro) {
    process.stderr.write(`${erro.message}\n`);
    process.exitCode = 1;
  }
}
