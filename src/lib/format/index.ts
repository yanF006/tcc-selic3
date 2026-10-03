/**
 * Formatação pt-BR com `Intl` (D10): o sistema tem um idioma e um campus,
 * então não há biblioteca de internacionalização.
 */

const FUSO = "America/Sao_Paulo";

const dataCurta = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: FUSO,
});

const dataExtensa = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: FUSO,
});

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: FUSO,
});

const numero = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numeroInteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Converte "aaaa-mm-dd" em data local do fuso de São Paulo. */
export function paraData(valor: string | Date): Date | null {
  if (valor instanceof Date) return valor;

  const somenteData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);

  if (somenteData) {
    return new Date(
      Number(somenteData[1]),
      Number(somenteData[2]) - 1,
      Number(somenteData[3]),
      12,
      0,
      0,
      0,
    );
  }

  const comHora = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(valor);

  if (comHora) {
    return new Date(
      Number(comHora[1]),
      Number(comHora[2]) - 1,
      Number(comHora[3]),
      Number(comHora[4]),
      Number(comHora[5]),
      0,
      0,
    );
  }

  const data = new Date(valor);

  return Number.isNaN(data.getTime()) ? null : data;
}

/** "2026-02-01" → "01/02/2026". */
export function formatarData(valor: string | Date | null | undefined): string {
  if (!valor) return "—";

  const data = paraData(valor);

  return data ? dataCurta.format(data) : "—";
}

export function formatarDataExtensa(valor: string | Date | null | undefined): string {
  if (!valor) return "—";

  const data = paraData(valor);

  return data ? dataExtensa.format(data) : "—";
}

export function formatarDataHora(valor: string | Date | null | undefined): string {
  if (!valor) return "—";

  const data = paraData(valor);

  return data ? dataHora.format(data) : "—";
}

/** 6 → "6,00"; 120 → "120,00". */
export function formatarNumero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";

  return numero.format(valor);
}

export function formatarInteiro(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";

  return numeroInteiro.format(valor);
}

/** 1500 → "R$ 1.500,00". */
export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";

  return moeda.format(valor);
}

/** Total de horas com a unidade, como aparece nas telas. */
export function formatarHoras(valor: number): string {
  return `${formatarNumero(valor)} h`;
}

/** Converte "01/02/2026" ou "2026-02-01" em "2026-02-01", para gravar. */
export function dataParaIso(valor: string): string | null {
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor.trim());

  if (br) return `${br[3]}-${br[2]}-${br[1]}`;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim());

  return iso ? iso[0] : null;
}

/** Rótulo do período letivo a partir do ano e do semestre. */
export function rotuloPeriodo(ano: number, semestre: 1 | 2): string {
  return `${ano}.${semestre}`;
}

/** Diferença em dias entre duas datas ISO. */
export function diasEntre(inicio: string, fim: string): number {
  const a = paraData(inicio);
  const b = paraData(fim);

  if (!a || !b) return 0;

  const milissegundos = b.getTime() - a.getTime();

  return Math.round(milissegundos / 86_400_000);
}

/** Chave de semana no formato "aaaa-mm-dd" da segunda-feira da semana. */
export function chaveSemana(data: string): string {
  const d = paraData(data);

  if (!d) return "";

  const diaDaSemana = (d.getDay() + 6) % 7;
  const inicioSemana = new Date(d);
  inicioSemana.setDate(d.getDate() - diaDaSemana);
  inicioSemana.setHours(12, 0, 0, 0);

  const mes = String(inicioSemana.getMonth() + 1).padStart(2, "0");
  const dia = String(inicioSemana.getDate()).padStart(2, "0");

  return `${inicioSemana.getFullYear()}-${mes}-${dia}`;
}
