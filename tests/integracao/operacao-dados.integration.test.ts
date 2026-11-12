import { describe, expect, it } from "vitest";
import { lerConexao } from "../../scripts/backup-banco.mjs";
import { validarDestino } from "../../scripts/restaurar-backup.mjs";
import { sqlTexto, validarRegistro } from "../../scripts/transformar-dados-pessoais.mjs";

const valido = {
  id: "alu-1", cpf: "529.982.247-25", rg: "12345678", dataNascimento: "2000-01-01", telefone: "2433334444",
  celular: "24999994444", endereco: JSON.stringify({ cep: "27197000" }), cursoId: "cur", turmaId: "tur", periodoId: "per",
};

describe("ferramentas operacionais (13.x)", () => {
  it("lê a conexão sem expor senha em texto de comando", () => {
    expect(lerConexao("mysql://usr:s%40nha@db.exemplo:3306/selic_ensaio")).toEqual({
      host: "db.exemplo", port: "3306", user: "usr", password: "s@nha", banco: "selic_ensaio",
    });
    expect(() => lerConexao("mysql://usr:x@db.exemplo:3306/")).toThrow(/banco/);
  });

  it("restauração só aceita destino de ensaio com confirmação idêntica", () => {
    expect(() => validarDestino("selic_restauracao_ensaio", "selic_restauracao_ensaio")).not.toThrow();
    expect(() => validarDestino("selic", "selic")).toThrow(/não é um banco de ensaio/);
    expect(() => validarDestino("selic_restauracao_ensaio", undefined)).toThrow(/Confirmação ausente/);
    expect(() => validarDestino("selic_restauracao_ensaio", "outro_ensaio")).toThrow(/Confirmação ausente/);
  });

  it("aceita registro legado íntegro e normaliza o CPF", () => {
    const resultado = validarRegistro(valido);
    expect(resultado.valor).toMatchObject({ cpf: "52998224725", dataNascimento: "2000-01-01" });
  });

  it("recusa registro incompleto em vez de inventar valor", () => {
    expect(validarRegistro({ ...valido, cpf: "123" })).toEqual({ erro: "cpf_invalido" });
    expect(validarRegistro({ ...valido, cursoId: null })).toEqual({ erro: "cursoId_ausente" });
    expect(validarRegistro({ ...valido, endereco: "[1,2]" })).toEqual({ erro: "endereco_invalido" });
    expect(validarRegistro({ ...valido, dataNascimento: "31/12/2000" })).toEqual({ erro: "data_nascimento_invalida" });
  });

  it("escapa literais SQL para não quebrar a transação de gravação", () => {
    expect(sqlTexto("O'Brien\\x\n")).toBe("'O\\'Brien\\\\x\\n'");
  });
});
