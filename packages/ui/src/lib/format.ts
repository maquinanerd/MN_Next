/**
 * Date formatting for display. Data is always ISO 8601; the words are made here, in
 * Portuguese and in São Paulo time, whatever the server's own zone is (docs/04).
 */

const TZ = 'America/Sao_Paulo';

const longDate = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
const monthYear = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, month: 'long', year: 'numeric' });
const clock = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

function valid(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "27 de agosto de 2026" */
export function dataLonga(iso: string): string {
  const d = valid(iso);
  return d ? longDate.format(d) : '';
}

/** "28 de agosto de 2026, 09h12" */
export function dataHora(iso: string): string {
  const d = valid(iso);
  if (!d) return '';
  const [h = '00', m = '00'] = clock.format(d).split(':');
  return `${longDate.format(d)}, ${h}h${m}`;
}

/** "12 ago 2026" */
export function dataCurta(iso: string): string {
  const d = valid(iso);
  if (!d) return '';
  return shortDate
    .formatToParts(d)
    .filter((p) => p.type === 'day' || p.type === 'month' || p.type === 'year')
    .map((p) => p.value.replace('.', ''))
    .join(' ');
}

/** "Agosto 2026" */
export function mesAno(iso: string): string {
  const d = valid(iso);
  if (!d) return '';
  const text = monthYear.format(d).replace(' de ', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * "24 minutos atrás", "6 horas atrás", "1 dia atrás"; a week or more reads as a date.
 * `now` is injectable so tests are deterministic.
 */
export function relativa(iso: string, now: Date = new Date()): string {
  const d = valid(iso);
  if (!d) return '';
  const minutes = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return minutes === 1 ? '1 minuto atrás' : `${minutes} minutos atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hora atrás' : `${hours} horas atrás`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? '1 dia atrás' : `${days} dias atrás`;
  return dataCurta(iso);
}

/** "Por Rafael Lima e Carla Menezes" */
export function assinatura(nomes: string[]): string {
  if (nomes.length === 0) return '';
  if (nomes.length === 1) return `Por ${nomes[0]}`;
  return `Por ${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}
