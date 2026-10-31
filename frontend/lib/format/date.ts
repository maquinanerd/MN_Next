/** Datas sempre em ISO no dado; formatadas aqui, no fuso de Brasília (docs/04-dados.md). */
const TZ = "America/Sao_Paulo";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function parts(iso: string): { dia: number; mes: number; ano: number; hora: string; minuto: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return {
    dia: Number(p.day),
    mes: Number(p.month) - 1,
    ano: Number(p.year),
    hora: p.hour ?? "00",
    minuto: p.minute ?? "00",
  };
}

/** "12 ago 2026" */
export function dataCurta(iso: string): string {
  const { dia, mes, ano } = parts(iso);
  return `${dia} ${MESES[mes]} ${ano}`;
}

/** "27 de agosto de 2026" */
export function dataLonga(iso: string): string {
  const { dia, mes, ano } = parts(iso);
  return `${dia} de ${MESES_LONGOS[mes]} de ${ano}`;
}

/** "28 de agosto de 2026, 09h12" */
export function dataLongaHora(iso: string): string {
  const { hora, minuto } = parts(iso);
  return `${dataLonga(iso)}, ${hora}h${minuto}`;
}

/** "Agosto 2026" */
export function mesAno(iso: string): string {
  const { mes, ano } = parts(iso);
  const nome = MESES_LONGOS[mes] ?? "";
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${ano}`;
}

/**
 * "24 minutos atrás", "6 horas atrás", "1 dia atrás"; a partir de três dias, a data curta.
 * `agora` é o instante em que o dado foi montado (ver lib/content/adapter.ts).
 */
export function dataRelativa(iso: string, agora: string): string {
  const diff = Math.max(0, Date.parse(agora) - Date.parse(iso));
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora há pouco";
  if (min < 60) return min === 1 ? "1 minuto atrás" : `${min} minutos atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return h === 1 ? "1 hora atrás" : `${h} horas atrás`;
  const d = Math.floor(h / 24);
  if (d < 3) return d === 1 ? "1 dia atrás" : `${d} dias atrás`;
  return dataCurta(iso);
}
