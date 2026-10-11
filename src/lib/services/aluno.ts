import { esquemaDadosPessoais } from "@/lib/domain/schemas";
import type { DadosPessoais, Usuario } from "@/lib/domain/types";

import { opcoesSelecao } from "./catalogo";
import { moverCredencial } from "./credenciais";
import { obterEstado } from "./store";

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

/** Dados pessoais do usuário, ou null quando ele ainda não tem cadastro completo. */
export async function dadosDoAluno(usuario: Usuario): Promise<DadosPessoais | null> {
  const dados = obterEstado().usuarios.find(
    (registro) => registro.id === usuario.id,
  )?.dadosPessoais;

  return dados ? structuredClone(dados) : null;
}

/** Erros por campo, no formato que o formulário usa para marcar cada input. */
function errosPorCampo(
  erros: { path: (string | number)[]; message: string }[],
): Record<string, string> {
  return Object.fromEntries(erros.map((erro) => [erro.path.join("."), erro.message]));
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
): Promise<ResultadoDadosPessoais> {
  if (usuario.situacao !== "ativo") {
    return { ok: false, erro: "Cadastro não autorizado para edição.", erros: {} };
  }
  const registro = obterEstado().usuarios.find((registro) => registro.id === usuario.id);

  if (!registro) {
    return { ok: false, erro: "Usuário não encontrado.", erros: {} };
  }

  if (!registro.dadosPessoais) {
    return { ok: false, erro: "Cadastro de dados pessoais não encontrado.", erros: {} };
  }

  const payload = { ...dados } as DadosPessoais & { matricula?: string };
  delete payload.matricula;
  const validado = esquemaDadosPessoais(await opcoesSelecao()).safeParse(payload);

  if (!validado.success) {
    return {
      ok: false,
      erro: "Confira os campos destacados.",
      erros: errosPorCampo(validado.error.issues),
    };
  }

  const emailAnterior = registro.dadosPessoais.email;

  if (validado.data.email !== emailAnterior) {
    const emUso = obterEstado().usuarios.some(
      (outro) =>
        outro.id !== registro.id && outro.email.toLowerCase() === validado.data.email.toLowerCase(),
    );

    if (emUso) {
      return {
        ok: false,
        erro: "Confira os campos destacados.",
        erros: { email: "E-mail já utilizado por outro cadastro." },
      };
    }

    await moverCredencial(emailAnterior, validado.data.email);
  }

  registro.nome = validado.data.nomeCompleto;
  registro.email = validado.data.email;
  registro.dadosPessoais = validado.data;

  return {
    ok: true,
    dados: structuredClone(registro.dadosPessoais),
    mensagem: "Dados atualizados.",
  };
}
