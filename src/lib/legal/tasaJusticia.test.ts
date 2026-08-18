import { describe, it, expect } from 'vitest';
import { calcularTasaJusticia } from './tasaJusticia';

describe('Tasa de Justicia', () => {
  it('Debe calcular el 3% correctamente para Nación / General', () => {
    const result = calcularTasaJusticia({
      monto: 28000000,
      jurisdiccion: 'nacion',
      tipo_proceso: 'general_pecuniary',
      confirmacion: true
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tasa).toBe(840000);
    }
  });

  it('Debe bloquear PBA', () => {
    const result = calcularTasaJusticia({
      monto: 1000,
      jurisdiccion: 'pba',
      tipo_proceso: 'general_pecuniary',
      confirmacion: true
    });
    expect(result.ok).toBe(false);
  });
});
