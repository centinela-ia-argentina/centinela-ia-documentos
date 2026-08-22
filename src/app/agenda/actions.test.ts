import { describe, it, expect } from 'vitest';
import { normalizeDateLocal, normalizeTitle, validateTime } from './helpers';

describe('Agenda Actions Helpers', () => {
  it('Debe normalizar títulos correctamente', () => {
    expect(normalizeTitle('  Audiencia   PENAL  ')).toBe('audiencia penal');
    expect(normalizeTitle('Alegatos  \n  finales')).toBe('alegatos finales');
  });

  it('Debe validar horas HH:MM correctamente', () => {
    expect(validateTime('09:30')).toBe('09:30');
    expect(validateTime('23:59')).toBe('23:59');
    expect(validateTime('00:00')).toBe('00:00');
    expect(validateTime(null)).toBe(null);
    expect(validateTime('  14:05  ')).toBe('14:05');
  });

  it('Debe rechazar horas inválidas', () => {
    expect(() => validateTime('24:00')).toThrow();
    expect(() => validateTime('09:60')).toThrow();
    expect(() => validateTime('9:30')).toThrow(); // Requiere 0 padding
    expect(() => validateTime('abc')).toThrow();
  });

  it('Debe normalizar fechas locales', () => {
    expect(normalizeDateLocal('2026-08-18')).toBe('2026-08-18');
    expect(normalizeDateLocal(' 2026-08-18 ')).toBe('2026-08-18');
    expect(normalizeDateLocal(undefined)).toBe(null);
  });
});
