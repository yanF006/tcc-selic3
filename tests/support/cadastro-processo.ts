import { concluirCadastro, validarEtapaUm } from "../../src/lib/services/cadastro";
import { carregarCliente } from "../../src/lib/db/prisma";

async function executar() {
  const etapa = process.env.SELIC_CADASTRO_ETAPA;
  const dados = JSON.parse(process.env.SELIC_CADASTRO_DADOS ?? "{}");

  try {
    const resultado =
      etapa === "consulta" ? await validarEtapaUm(dados) : await concluirCadastro(dados);
    process.stdout.write(JSON.stringify(resultado));
  } finally {
    await (await carregarCliente()).prisma.$disconnect();
  }
}

executar().catch(() => {
  process.stderr.write("Falha ao executar a etapa de cadastro no banco isolado.");
  process.exitCode = 1;
});
