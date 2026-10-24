import { describe, expect, it } from 'vitest';
import { addRentalMonths, formatRentalDate, parseRentalDate, rentalDateISO, rentalToday } from './calendar';
import { periodoDeFecha } from './calcularAjuste';
const iso = (value: string) => rentalDateISO(parseRentalDate(value));

describe('rental civil date compatibility', () => {
  it.each(['2026-01-31', '2026-01-31T00:00:00.000Z', '2026-01-31T12:00:00Z', '2026-01-31T00:00:00+00:00', '2026-01-31 00:00:00.000000+00:00', '2026-01-31T00:00:00-03:00'])('preserves the registered day: %s', value => {
    expect(iso(value)).toBe('2026-01-31');
    const date = parseRentalDate(value)!;
    expect(date.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    expect(formatRentalDate(date)).toBe('31/1/2026');
    expect(periodoDeFecha(value)).toBe('2026-01');
    expect(periodoDeFecha(date.toISOString())).toBe('2026-01');
    expect(iso(date.toISOString())).toBe('2026-01-31');
  });
  it.each(['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-10', '2026-01-00', '2026-04-31', '0000-01-01', '31/01/2026', '2026-1-31', '2026-01-31T00:00:00', '2026-01-31T24:00:00Z', '2026-01-31T12:60:00Z', '2026-01-31T12:00:60Z', '2026-01-31T12:00:00+99:00', '2026-01-31T00:00:00+03:00', '2026-01-31T23:30:00-03:00', 'bad', ''])('does not reinterpret invalid or ambiguous input: %s', value => {
    expect(parseRentalDate(value)).toBeNull();
    expect(formatRentalDate(parseRentalDate(value))).toBe('-');
  });
  it('handles null and invalid Date without throwing', () => {
    expect(parseRentalDate(null)).toBeNull(); expect(parseRentalDate(undefined)).toBeNull();
    expect(rentalDateISO(new Date(NaN))).toBeNull(); expect(formatRentalDate(new Date(NaN))).toBe('-');
    expect(rentalToday(new Date(NaN))).toBeNull();
  });
  it.each([
    ['2026-10-12T02:59:59.999Z', '2026-10-11'],
    ['2026-10-12T03:00:00.000Z', '2026-10-12'],
    ['2027-01-01T02:59:59Z', '2026-12-31'],
    ['2027-01-01T03:00:00Z', '2027-01-01'],
  ])('uses Buenos Aires midnight from %s', (instant, day) => expect(rentalDateISO(rentalToday(new Date(instant)))).toBe(day));
});

describe('clamped month addition with an immutable civil carrier', () => {
  it.each([
    ['2026-01-31', 1, '2026-02-28'], ['2028-01-31', 1, '2028-02-29'],
    ['2026-01-30', 1, '2026-02-28'], ['2026-01-29', 1, '2026-02-28'],
    ['2026-01-28', 1, '2026-02-28'], ['2026-03-31', 1, '2026-04-30'],
    ['2026-11-30', 3, '2027-02-28'], ['2026-08-31', 6, '2027-02-28'],
    ['2028-02-29', 12, '2029-02-28'], ['2026-12-31', 1, '2027-01-31'],
    ['2026-09-11', 1, '2026-10-11'],
  ] as const)('%s plus %i months becomes %s', (base, months, expected) => {
    const date = parseRentalDate(base)!; const before = date.toISOString();
    const next = addRentalMonths(date, months)!;
    expect(rentalDateISO(next)).toBe(expected); expect(date.toISOString()).toBe(before);
    expect(periodoDeFecha(next.toISOString())).toBe(expected.slice(0, 7));
  });
  it('handles year 0099 as a civil day; existing period formatter limitation remains explicit', () => {
    const date = addRentalMonths(parseRentalDate('0099-01-31')!, 1)!;
    expect(rentalDateISO(date)).toBe('0099-02-28');
    // Existing periodoDeFecha omits leading year zeros; not changed in this scope.
    expect(periodoDeFecha(date.toISOString())).toBe('99-02');
  });
  it('does not invent an original-day anniversary anchor', () => {
    const feb = addRentalMonths(parseRentalDate('2026-01-31')!, 1)!;
    expect(rentalDateISO(addRentalMonths(feb, 1))).toBe('2026-03-28');
  });
  it('keeps period validation separate; finite legacy month arguments still work', () => {
    expect(rentalDateISO(addRentalMonths(parseRentalDate('2026-06-15')!, -1))).toBe('2026-05-15');
    expect(rentalDateISO(addRentalMonths(parseRentalDate('2026-06-15')!, 1.5))).toBe('2026-07-15');
    expect(addRentalMonths(parseRentalDate('2026-06-15')!, Infinity)).toBeNull();
    expect(addRentalMonths(parseRentalDate('9999-12-31')!, 1)).toBeNull();
  });
});
