/**
 * Seleção explícita da fonte de dados da aplicação.
 *
 * O ponto de composição usa esta função para escolher entre o adapter
 * persistente e o simulador. Uma falha de banco nunca altera a escolha: quem
 * selecionou persistência continua em persistência e recebe o erro.
 *
 * `SELIC_PERSISTENCIA` permite fixar o modo. Os testes de integração a definem
 * como `persistente`; os testes unitários continuam em `simulado`, mesmo que
 * um `.env` local tenha `DATABASE_URL`.
 */
export type FonteDados = "persistente" | "simulado";

export const VARIAVEL_FONTE_DADOS = "SELIC_PERSISTENCIA";

type Ambiente = Record<string, string | undefined>;

function normalizar(valor: string | undefined): string | undefined {
  const texto = valor?.trim().toLowerCase();

  return texto || undefined;
}

export function fonteDadosSelecionada(ambiente: Ambiente = process.env): FonteDados {
  const escolha = normalizar(ambiente[VARIAVEL_FONTE_DADOS]);

  if (escolha) {
    if (escolha === "persistente") {
      if (!ambiente.DATABASE_URL?.trim()) {
        throw new Error(`${VARIAVEL_FONTE_DADOS}=persistente exige DATABASE_URL configurada.`);
      }

      return "persistente";
    }

    if (escolha === "simulado") return "simulado";

    throw new Error(
      `${VARIAVEL_FONTE_DADOS} inválida: "${escolha}". Use "persistente" ou "simulado".`,
    );
  }

  // Testes unitários nunca devem apontar para o banco real. A integração
  // seleciona persistência explicitamente acima.
  if (ambiente.NODE_ENV === "test") return "simulado";

  return ambiente.DATABASE_URL?.trim() ? "persistente" : "simulado";
}
