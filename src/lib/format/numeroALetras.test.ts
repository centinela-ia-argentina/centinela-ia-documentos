import { describe, it, expect } from 'vitest';
import { parseMontoMonetario, montoALetras, enteroALetras } from './numeroALetras';

describe('Montos a Letras — Parser monetario y conversor notarial', () => {
  it('convierte 1234567.89 a "un millón doscientos treinta y cuatro mil quinientos sesenta y siete con 89/100"', () => {
    const res = montoALetras('1234567.89');
    expect(res).toBe('un millón doscientos treinta y cuatro mil quinientos sesenta y siete con 89/100');
  });

  it('soporta coma decimal (1234567,89) produciendo el mismo resultado exacto', () => {
    const res = montoALetras('1234567,89');
    expect(res).toBe('un millón doscientos treinta y cuatro mil quinientos sesenta y siete con 89/100');
  });

  it('soporta separadores de miles con coma o punto (1.234.567,89 y 1,234,567.89)', () => {
    expect(montoALetras('1.234.567,89')).toBe('un millón doscientos treinta y cuatro mil quinientos sesenta y siete con 89/100');
    expect(montoALetras('1,234,567.89')).toBe('un millón doscientos treinta y cuatro mil quinientos sesenta y siete con 89/100');
  });

  it('procesa enteros puros sin centavos (1234567 -> con 00/100)', () => {
    const res = montoALetras('1234567');
    expect(res).toBe('un millón doscientos treinta y cuatro mil quinientos sesenta y siete con 00/100');
  });

  it('procesa centavos puros (0.01 -> cero con 01/100)', () => {
    const res = montoALetras('0.01');
    expect(res).toBe('cero con 01/100');
  });

  it('normaliza 1 solo decimal como decenas de centavos (1.5 -> un con 50/100 o uno con 50/100)', () => {
    const parsed = parseMontoMonetario('1.5');
    expect(parsed.entero).toBe(1);
    expect(parsed.centavos).toBe(50);
    expect(montoALetras('1.5')).toContain('50/100');
  });

  it('admite prefijo de moneda y formato en mayúsculas', () => {
    const res = montoALetras('1234567.89', { moneda: 'PESOS', mayusculas: true });
    expect(res).toBe('PESOS UN MILLÓN DOSCIENTOS TREINTA Y CUATRO MIL QUINIENTOS SESENTA Y SIETE CON 89/100');
  });

  it('rechaza montos negativos', () => {
    expect(() => parseMontoMonetario('-1234567.89')).toThrow('El monto no puede ser negativo.');
    expect(() => montoALetras('-500')).toThrow();
  });

  it('rechaza formatos ambiguos (ej. 3 dígitos con separador único "1.234" o "1,234")', () => {
    expect(() => parseMontoMonetario('1.234')).toThrow(/Formato ambiguo/);
    expect(() => parseMontoMonetario('1,234')).toThrow(/Formato ambiguo/);
  });

  it('rechaza entradas con más de 2 decimales', () => {
    expect(() => parseMontoMonetario('123.4567')).toThrow(/máximo 2 dígitos/);
  });

  it('rechaza números no seguros que exceden MAX_SAFE_INTEGER', () => {
    expect(() => parseMontoMonetario('9999999999999999999999999999.00')).toThrow(/límite de precisión seguro/);
  });

  it('rechaza entradas con caracteres no numéricos o vacías', () => {
    expect(() => parseMontoMonetario('')).toThrow();
    expect(() => parseMontoMonetario('abc')).toThrow();
    expect(() => parseMontoMonetario('100.00 pesos')).toThrow(/caracteres no numéricos/);
  });
});
