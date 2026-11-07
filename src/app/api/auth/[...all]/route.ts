import { toNextJsHandler } from "better-auth/next-js";

import { obterAutenticacao } from "@/lib/auth/autenticacao";
import { bancoConfigurado, descartarCliente } from "@/lib/db/prisma";
import {
  BancoIndisponivelError,
  registrarFalhaBanco,
  traduzirErroPersistencia,
} from "@/lib/db/erros";

export const runtime = "nodejs";

async function atender(requisicao: Request): Promise<Response> {
  const inicio = Date.now();
  try {
    if (!bancoConfigurado()) return new Response(null, { status: 404 });
    return await (await obterAutenticacao()).handler(requisicao);
  } catch (causa) {
    const erro = traduzirErroPersistencia(causa);
    const indisponivel = erro instanceof BancoIndisponivelError;
    if (indisponivel) descartarCliente();
    registrarFalhaBanco(causa, Date.now() - inicio);
    return Response.json(
      { erro: "Não foi possível concluir a autenticação." },
      {
        status: indisponivel ? 503 : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

export const { GET, POST } = toNextJsHandler(atender);
