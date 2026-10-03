import { describe, it, expect } from 'vitest';
import { calcularImpuestoSellos } from './sellos';

describe('Calculadora de Sellos Notarial — Mayor valor imponible', () => {
  it('calcula sobre el precio cuando es mayor que la valuación fiscal', () => {
    const res = calcularImpuestoSellos({
      precio: 100_000_000,
      valuacionFiscal: 80_000_000,
      alicuota: 3.6,
      dividirPartes: true,
    });
    expect(res.baseImponible).toBe(100_000_000);
    expect(res.baseUtilizada).toBe('precio');
    expect(res.sellosTotal).toBe(3_600_000);
    expect(res.aCargoCadaParte).toBe(1_800_000);
    expect(res.explicacionBase).toContain('precio');
  });

  it('calcula sobre la valuación fiscal cuando es mayor que el precio', () => {
    const res = calcularImpuestoSellos({
      precio: 60_000_000,
      valuacionFiscal: 75_000_000,
      alicuota: 3.6,
      dividirPartes: true,
    });
    expect(res.baseImponible).toBe(75_000_000);
    expect(res.baseUtilizada).toBe('valuacion_fiscal');
    expect(res.sellosTotal).toBe(2_700_000);
    expect(res.aCargoCadaParte).toBe(1_350_000);
    expect(res.explicacionBase).toContain('valuación fiscal');
  });

  it('identifica igualdad cuando precio y valuación fiscal son idénticos', () => {
    const res = calcularImpuestoSellos({
      precio: 50_000_000,
      valuacionFiscal: 50_000_000,
      alicuota: 3.6,
    });
    expect(res.baseImponible).toBe(50_000_000);
    expect(res.baseUtilizada).toBe('iguales');
    expect(res.sellosTotal).toBe(1_800_000);
  });

  it('maneja valores en cero sin arrojar error', () => {
    const res = calcularImpuestoSellos({
      precio: 0,
      valuacionFiscal: 0,
    });
    expect(res.baseImponible).toBe(0);
    expect(res.sellosTotal).toBe(0);
    expect(res.aCargoCadaParte).toBe(0);
  });

  it('maneja campos vacíos o nulos tratándolos como cero', () => {
    const res = calcularImpuestoSellos({
      precio: '',
      valuacionFiscal: '40000000',
    });
    expect(res.baseImponible).toBe(40_000_000);
    expect(res.baseUtilizada).toBe('valuacion_fiscal');
  });

  it('rechaza montos negativos para precio o valuación fiscal', () => {
    expect(() => calcularImpuestoSellos({ precio: -100, valuacionFiscal: 500 })).toThrow(/no puede ser negativo/);
    expect(() => calcularImpuestoSellos({ precio: 500, valuacionFiscal: -200 })).toThrow(/no puede ser negativo/);
  });

  it('rechaza valores no finitos (Infinity, NaN)', () => {
    expect(() => calcularImpuestoSellos({ precio: Infinity, valuacionFiscal: 100 })).toThrow(/finito válido/);
    expect(() => calcularImpuestoSellos({ precio: 'abc', valuacionFiscal: 100 })).toThrow(/finito válido/);
  });

  it('permite alícuotas editables distintas a la por defecto (3.6%)', () => {
    const res = calcularImpuestoSellos({
      precio: 10_000_000,
      valuacionFiscal: 8_000_000,
      alicuota: 2,
      dividirPartes: false,
    });
    expect(res.sellosTotal).toBe(200_000);
    expect(res.aCargoCadaParte).toBe(200_000);
  });
});
