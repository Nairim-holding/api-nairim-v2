/**
 * Conversão entre "HH:MM" e as colunas `@db.Time` do Postgres.
 *
 * Fixa em UTC de propósito: é hora de parede (ex.: "08:00"), e deixar o fuso
 * do processo Node interferir deslocaria o horário gravado/lido.
 */

/** "HH:MM" → Date ancorado em 1970-01-01 UTC, para gravar em coluna `@db.Time`. */
export function timeStringToDate(value: any): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const [h, m = '0'] = raw.split(':');
  const date = new Date(Date.UTC(1970, 0, 1, Number(h), Number(m), 0));
  return isNaN(date.getTime()) ? null : date;
}

/** Coluna `@db.Time` → "HH:MM", para devolver ao formulário. */
export function timeToString(value: Date | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** "HH:MM" → minutos desde a meia-noite, para comparar intervalos. */
export function timeStringToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

/** Coluna `@db.Time` → minutos desde a meia-noite, direto (sem passar por string). */
export function timeColumnToMinutes(value: Date): number {
  const d = new Date(value);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeString(value: any): boolean {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

/**
 * Dia da semana e minutos desde a meia-noite, na hora de parede de
 * America/Sao_Paulo — independente do fuso em que o processo Node roda.
 *
 * Técnica: formata o instante atual como string no fuso alvo e reconstrói um
 * Date a partir dela. `new Date(string)` interpreta a string no fuso do
 * próprio processo; como lemos de volta com `getDay()`/`getHours()` no mesmo
 * processo, os componentes batem com o fuso alvo em vez do fuso real do
 * processo. Evita dependência externa (date-fns-tz, luxon) só para isto.
 */
export function nowInSaoPaulo(reference: Date = new Date()): { dayOfWeek: number; minutesOfDay: number } {
  const zoned = new Date(
    reference.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  );
  return {
    dayOfWeek: zoned.getDay(), // 0=Domingo ... 6=Sábado, mesma convenção do schema
    minutesOfDay: zoned.getHours() * 60 + zoned.getMinutes(),
  };
}
