import { consultarUsuarioAutenticado } from "../../src/lib/auth/sessao-persistente";
import { carregarCliente } from "../../src/lib/db/prisma";
import { carregarUrlAppTeste, validarUrlTeste } from "../integracao/configuracao";

async function executar() {
  // O pai já apontou DATABASE_URL para a URL de testes validada. Revalidar o
  // destino explícito sem confundi-lo com a configuração real da aplicação.
  const url = carregarUrlAppTeste();
  validarUrlTeste(url, { ...process.env, DATABASE_URL: undefined }, "selic_teste_app");
  if (process.env.DATABASE_URL !== url) throw new Error("Destino de sessão não isolado.");
  try {
    const usuario = await consultarUsuarioAutenticado(
      new Headers({ Cookie: process.env.SELIC_COOKIE_TESTE ?? "" }),
    );
    process.stdout.write(
      JSON.stringify(
        usuario ? { id: usuario.id, papel: usuario.papel, cursoId: usuario.cursoId } : null,
      ),
    );
  } finally {
    await (await carregarCliente()).prisma.$disconnect();
  }
}

executar().catch(() => {
  process.stderr.write("Falha ao consultar sessão no banco isolado.");
  process.exitCode = 1;
});
