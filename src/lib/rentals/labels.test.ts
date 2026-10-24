import { describe, expect, it } from 'vitest';
import { calcularProximoAjuste, estadoVencimiento } from './labels';
import { rentalDateISO } from './calendar';
const now = new Date('2026-10-12T03:00:00Z');
describe('rental adjustment helper contract', () => {
  it.each([
    [null, null, 1], ['2026-01-31', null, null], ['2026-01-31', null, 0],
    ['bad', null, 1], ['2026-01-31', 'bad', 1], ['2026-01-31', '2026-01-31T23:00:00-03:00', 1],
  ] as const)('missing/ambiguous base remains unavailable %#', (start, last, months) => expect(calcularProximoAjuste(start, last, months)).toBeNull());
  it('prefers last applied date and keeps the Date|null signature', () => {
    const next = calcularProximoAjuste('2026-01-31', '2026-02-28T00:00:00.000Z', 1);
    expect(next).toBeInstanceOf(Date); expect(rentalDateISO(next)).toBe('2026-03-28');
  });
  it.each([
    ['2026-10-11', 'vencido', -1], ['2026-10-12', 'proximo', 0],
    ['2026-11-11', 'proximo', 30], ['2026-11-12', 'al_dia', 31],
  ] as const)('classifies %s with calendar boundaries', (day, tipo, dias) => {
    const date = new Date(`${day}T00:00:00Z`); const copy = date.getTime();
    expect(estadoVencimiento(date, 'vigente', now)).toMatchObject({ tipo, dias }); expect(date.getTime()).toBe(copy);
  });
  it('labels today consistently before/after BA midnight', () => {
    const date = new Date('2026-10-12T00:00:00Z');
    expect(estadoVencimiento(date, 'vigente', new Date('2026-10-12T02:59:59Z')).dias).toBe(1);
    expect(estadoVencimiento(date, 'vigente', now).label).toBe('Ajusta hoy');
  });
  it.each(['finalizado', null, 'unknown'])('does not make %s vigente', status => expect(estadoVencimiento(new Date('2026-10-12'), status, now)).toEqual({ tipo: 'sin_dato', dias: null, label: '' }));
  it('invalid date or reference instant is unavailable, not a NaN day count', () => {
    for (const date of [null, new Date(NaN)]) expect(estadoVencimiento(date, 'vigente', now).tipo).toBe('sin_dato');
    expect(estadoVencimiento(new Date('2026-10-12'), 'vigente', new Date(NaN)).tipo).toBe('sin_dato');
  });
});
