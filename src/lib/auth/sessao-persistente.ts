import "server-only";

import { obterAutenticacao } from "./autenticacao";
import { carregarCliente, descartarCliente } from "@/lib/db/prisma";
import { paraDominioUsuario } from "@/lib/db/mapeadores/usuarios";
import {
  BancoIndisponivelError,
  registrarFalhaBanco,
  traduzirErroPersistencia,
} from "@/lib/db/erros";

async function consultarContaAtual(id: string) {
  const { prisma } = await carregarCliente();
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  return usuario?.situacao === "ativo" ? paraDominioUsuario(usuario) : null;
}

async function executar<T>(operacao: () => Promise<T>): Promise<T> {
  const inicio = Date.now();
  try {
    return await operacao();
  } catch (causa) {
    const erro = traduzirErroPersistencia(causa);
    if (erro instanceof BancoIndisponivelError) {
      descartarCliente();
      registrarFalhaBanco(causa, Date.now() - inicio);
    }
    throw erro;
  }
}

/** Somente uma sessão validada pelo provedor fornece a identidade da conta. */
export async function consultarUsuarioAutenticado(cabecalhos: Headers) {
  return executar(async () => {
    const auth = await obterAutenticacao();
    const sessao = await auth.api.getSession({
      headers: cabecalhos,
      query: { disableCookieCache: true, disableRefresh: true },
    });
    return sessao ? consultarContaAtual(sessao.user.id) : null;
  });
}

/** A biblioteca confere a senha e propaga seus cookies pela integração Next.js. */
export async function entrarComSenha(email: string, senha: string, cabecalhos: Headers) {
  return executar(async () => {
    const auth = await obterAutenticacao();
    const resultado = await auth.api.signInEmail({
      body: { email: email.trim().toLowerCase(), password: senha },
      headers: cabecalhos,
    });
    const usuario = await consultarContaAtual(resultado.user.id);
    if (!usuario) {
      const { prisma } = await carregarCliente();
      await prisma.authSession.deleteMany({ where: { token: resultado.token } });
      await auth.api.signOut({ headers: cabecalhos });
    }
    return usuario;
  });
}
