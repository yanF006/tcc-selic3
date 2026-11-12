import { headers } from "next/headers";
import { APIError } from "better-auth/api";

import { esquemaDadosPessoais } from "@/lib/domain/schemas";
import type { DadosPessoais, Usuario } from "@/lib/domain/types";

import { opcoesSelecao } from "./catalogo";
import { moverCredencial } from "./credenciais";
import { obterEstado } from "./store";
import { atualizarUsuario } from "@/lib/db/persistencia";
import { bancoConfigurado, carregarCliente } from "@/lib/db/prisma";
import { criarRepositorioUsuarios } from "@/lib/db/repositorios/usuarios";
import { traduzirErroPersistencia } from "@/lib/db/erros";
import { obterAutenticacao } from "@/lib/auth/autenticacao";
import { carregarConfiguracaoAutenticacao } from "@/lib/auth/configuracao";

/**
 * Dados pessoais do aluno (6.6 e 6.7): leitura e edição do próprio cadastro.
 *
 * Regras que a implementação respeita:
 *
 * - o aluno edita **os próprios** dados: a busca parte do usuário da sessão, e
 *   uma alteração não alcança o cadastro de outra pessoa;
 * - a matrícula **não entra** no payload e não é gravada: ela vem do SIGAA no
 *   cadastro e continua imutável, então a tela a mostra apenas para consulta;
 * - o e-mail é validado e único, como no cadastro público, e trocar o e-mail
 *   move a credencial para que a senha já cadastrada siga valendo no login;
 * - as mesmas máscaras e os mesmos esquemas Zod do cadastro valem aqui: quem
 *   grava é `esquemaDadosPessoais`, o mesmo que o cadastro usa.
 */

export type ResultadoDadosPessoais =
  | { ok: true; dados: DadosPessoais; mensagem: string }
  | { ok: false; erro: string; erros: Record<string, string> };

/** Registro do usuário: lido do banco no modo persistente e da memória no simulado. */
async function registroDoUsuario(id: string): Promise<Usuario | undefined> {
  if (bancoConfigurado()) {
    const { prisma, Prisma } = await carregarCliente();
    return (await criarRepositorioUsuarios(prisma, Prisma).buscarPorId(id)) ?? undefined;
  }

  return obterEstado().usuarios.find((item) => item.id === id);
}

/** Dados pessoais do usuário, ou null quando ele ainda não tem cadastro completo. */
export async function dadosDoAluno(usuario: Usuario): Promise<DadosPessoais | null> {
  const registro = await registroDoUsuario(usuario.id);

  if (!registro?.dadosPessoais) return null;

  // `usuarios.email` é a identidade única confirmada pelo provedor; o JSON do
  // perfil só espelha os demais dados e nunca é uma segunda fonte de e-mail.
  return { ...structuredClone(registro.dadosPessoais), email: registro.email };
}

async function solicitarTrocaDeEmail(novoEmail: string, cabecalhos?: Headers): Promise<void> {
  const auth = await obterAutenticacao();
  const configuracao = carregarConfiguracaoAutenticacao();

  await auth.api.changeEmail({
    body: {
      newEmail: novoEmail,
      callbackURL: `${configuracao.origem}/perfil?email=confirmado`,
    },
    headers: cabecalhos ?? (await headers()),
  });
}

/** Erros por campo, no formato que o formulário usa para marcar cada input. */
function errosPorCampo(
  erros: readonly { path: readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  return Object.fromEntries(erros.map((erro) => [erro.path.map(String).join("."), erro.message]));
}

/**
 * Salva os dados pessoais do aluno autenticado.
 *
 * A matrícula é ignorada de propósito: ela não faz parte do tipo do payload, e
 * o serviço ainda recusa qualquer chave de matrícula que chegue.
 */
export async function atualizarDadosPessoais(
  usuario: Usuario,
  dados: DadosPessoais,
  cabecalhos?: Headers,
): Promise<ResultadoDadosPessoais> {
  if (usuario.situacao !== "ativo") {
    return { ok: false, erro: "Cadastro não autorizado para edição.", erros: {} };
  }

  const registro = await registroDoUsuario(usuario.id);

  if (!registro) {
    return { ok: false, erro: "Usuário não encontrado.", erros: {} };
  }

  if (!registro.dadosPessoais) {
    return { ok: false, erro: "Cadastro de dados pessoais não encontrado.", erros: {} };
  }

  const payload = { ...dados } as DadosPessoais & { matricula?: string };
  delete payload.matricula;
  const validado = esquemaDadosPessoais(await opcoesSelecao(registro.dadosPessoais)).safeParse(
    payload,
  );

  if (!validado.success) {
    return {
      ok: false,
      erro: "Confira os campos destacados.",
      erros: errosPorCampo(validado.error.issues),
    };
  }

  const emailAnterior = registro.email;
  const mudouEmail = validado.data.email.toLowerCase() !== emailAnterior.toLowerCase();

  if (bancoConfigurado()) {
    if (mudouEmail) {
      try {
        // A identidade só muda pelo fluxo de confirmação do titular; o perfil
        // nunca grava o novo endereço diretamente.
        await solicitarTrocaDeEmail(validado.data.email, cabecalhos);
      } catch (erro) {
        if (erro instanceof APIError) {
          return {
            ok: false,
            erro: "Não foi possível solicitar a troca de e-mail.",
            erros: { email: "Não foi possível solicitar a confirmação do novo e-mail." },
          };
        }

        throw traduzirErroPersistencia(erro);
      }
    }

    const anterior = structuredClone(registro);
    const dadosPersistidos = { ...validado.data, email: emailAnterior };

    try {
      registro.nome = dadosPersistidos.nomeCompleto;
      registro.dadosPessoais = dadosPersistidos;
      await atualizarUsuario(registro);
    } catch (erro) {
      Object.assign(registro, anterior);
      throw erro;
    }

    const { sincronizarDadosDoPerfil } = await import("./documentos");
    await sincronizarDadosDoPerfil(anterior, registro);

    return {
      ok: true,
      dados: structuredClone(registro.dadosPessoais),
      mensagem: mudouEmail
        ? "Dados atualizados. Se o novo e-mail estiver disponível, enviaremos um link de confirmação; a troca só vale depois da confirmação."
        : "Dados atualizados.",
    };
  }

  const anterior = structuredClone(registro);
  let credencialMovida = false;

  try {
    if (mudouEmail) {
      const emUso = obterEstado().usuarios.some(
        (outro) =>
          outro.id !== registro.id &&
          outro.email.toLowerCase() === validado.data.email.toLowerCase(),
      );

      if (emUso) {
        return {
          ok: false,
          erro: "Confira os campos destacados.",
          erros: { email: "E-mail já utilizado por outro cadastro." },
        };
      }

      await moverCredencial(emailAnterior, validado.data.email);
      credencialMovida = true;
    }

    registro.nome = validado.data.nomeCompleto;
    registro.email = validado.data.email;
    registro.dadosPessoais = validado.data;
  } catch (erro) {
    Object.assign(registro, anterior);

    if (credencialMovida) {
      await moverCredencial(validado.data.email, emailAnterior);
    }

    throw erro;
  }

  const { sincronizarDadosDoPerfil } = await import("./documentos");
  await sincronizarDadosDoPerfil(anterior, registro);

  return {
    ok: true,
    dados: structuredClone(registro.dadosPessoais),
    mensagem: "Dados atualizados.",
  };
}
