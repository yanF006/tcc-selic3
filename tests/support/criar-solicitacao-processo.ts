import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../../src/generated/prisma/client";
import { carregarUrlAppTeste, validarUrlTeste } from "../integracao/configuracao";

async function executar() {
  const configuracao = validarUrlTeste(carregarUrlAppTeste(), process.env, "selic_teste_app");
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb({
      host: configuracao.host,
      port: configuracao.porta,
      user: configuracao.usuario,
      password: configuracao.senha,
      database: configuracao.banco,
      connectionLimit: 1,
      ssl: { rejectUnauthorized: false },
    }),
  });
  const [email, matricula, cursoId, criadoEm] = process.argv.slice(2);
  const usuarioId = `usr-${crypto.randomUUID()}`;
  const solicitacaoId = `sol-${crypto.randomUUID()}`;

  try {
    await prisma.usuario.create({
      data: {
        id: usuarioId,
        nome: "Pendente Entre Processos",
        email,
        matricula,
        papel: "aluno",
        situacao: "pendente",
        dadosPessoais: {
          nomeCompleto: "Pendente Entre Processos",
          cpf: "12345678901",
          rg: "1234567",
          dataNascimento: "2000-01-01",
          email,
          telefone: "24999990000",
          celular: "24999990001",
          endereco: {
            cep: "27100000",
            logradouro: "Rua A",
            numero: "1",
            bairro: "Centro",
            cidade: "Pinheiral",
            estado: "RJ",
          },
          cursoId,
          turmaId: "turma-1",
          periodoId: "periodo-1",
        },
      },
    });
    await prisma.solicitacaoAcesso.create({
      data: {
        id: solicitacaoId,
        usuarioId,
        cursoId,
        situacao: "pendente",
        motivo: "Matrícula não está registrada no sistema.",
        criadoEm: new Date(criadoEm),
      },
    });
    process.stdout.write(JSON.stringify({ usuarioId, solicitacaoId }));
  } finally {
    await prisma.$disconnect();
  }
}

executar().catch((erro) => {
  process.stderr.write(
    `Falha ao criar solicitação no banco isolado de testes: ${erro instanceof Error ? erro.message : String(erro)}`,
  );
  process.exitCode = 1;
});
