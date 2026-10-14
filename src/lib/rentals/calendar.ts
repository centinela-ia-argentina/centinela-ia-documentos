/** Rental dates are civil days. UTC midnight is only their Date/ISO carrier,
 * not the time of an appointment. Only "today" is derived from an instant in BA.
 */
export const RENTAL_TIME_ZONE = 'America/Argentina/Buenos_Aires';

function civilDate(year: number, month: number, day: number): Date | null {
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

export function rentalDateISO(date: Date | null): string | null {
  if (!date || !Number.isFinite(date.getTime())) return null;
  const year = date.getUTCFullYear();
  if (year < 1 || year > 9999) return null;
  return date.toISOString().slice(0, 10);
}

/** Preserve the civil date already used by date inputs and legacy UTC ISO
 * serialization. Do not guess for locale strings, timezone-less timestamps,
 * or offsets whose textual and UTC days disagree.
 */
export function parseRentalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const text = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2}))?$/.exec(text);
  if (!match) return null;
  const date = civilDate(Number(match[1]), Number(match[2]), Number(match[3]));
  if (!date) return null;
  if (match[4] !== undefined) {
    if (Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6] || 0) > 59) return null;
    const instant = new Date(text.replace(' ', 'T'));
    if (!Number.isFinite(instant.getTime()) || rentalDateISO(instant) !== rentalDateISO(date)) return null;
  }
  return date;
}

export function rentalToday(now: Date = new Date()): Date | null {
  if (!Number.isFinite(now.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RENTAL_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return civilDate(part('year'), part('month'), part('day'));
}

export function addRentalMonths(base: Date, months: number): Date | null {
  if (!Number.isFinite(months) || !rentalDateISO(base)) return null;
  const target = new Date(base);
  target.setUTCDate(1);
  // Keep the existing period/base contract. Period validation is a separate scope.
  target.setUTCMonth(base.getUTCMonth() + months);
  if (!rentalDateISO(target)) return null;
  const end = new Date(target);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  return civilDate(target.getUTCFullYear(), target.getUTCMonth() + 1, Math.min(base.getUTCDate(), end.getUTCDate()));
}

export function formatRentalDate(date: Date | null): string {
  if (!rentalDateISO(date)) return '-';
  return new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC' }).format(date!);
}