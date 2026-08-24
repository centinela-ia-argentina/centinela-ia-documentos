import { describe, it, expect } from 'vitest';
import { calcularTasaJusticia } from './tasaJusticia';

describe('Tasa de Justicia', () => {
  it('Debe calcular el 3% correctamente para Nación / General con confirmación', () => {
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

  it('Debe bloquear si falta confirmación', () => {
    const result = calcularTasaJusticia({
      monto: 1000,
      jurisdiccion: 'nacion',
      tipo_proceso: 'general_pecuniary',
      confirmacion: false
    });
    expect(result.ok).toBe(false);
  });

  it('Debe bloquear jurisdicciones no habilitadas (Corrientes, PBA)', () => {
    expect(calcularTasaJusticia({
      monto: 1000,
      jurisdiccion: 'pba',
      tipo_proceso: 'general_pecuniary',
      confirmacion: true
    }).ok).toBe(false);

    expect(calcularTasaJusticia({
      monto: 1000,
      jurisdiccion: 'corrientes',
      tipo_proceso: 'general_pecuniary',
      confirmacion: true
    }).ok).toBe(false);
  });

  it('Debe bloquear regímenes especiales', () => {
    expect(calcularTasaJusticia({
      monto: 1000,
      jurisdiccion: 'nacion',
      tipo_proceso: 'succession',
      confirmacion: true
    }).ok).toBe(false);
  });

  it('Debe rechazar montos cero o negativos', () => {
    expect(calcularTasaJusticia({
      monto: 0,
      jurisdiccion: 'nacion',
      tipo_proceso: 'general_pecuniary',
      confirmacion: true
    }).ok).toBe(false);

    expect(calcularTasaJusticia({
      monto: -5000,
      jurisdiccion: 'nacion',
      tipo_proceso: 'general_pecuniary',
      confirmacion: true
    }).ok).toBe(false);
  });

  it('Debe fallar si se omite el monto (NaN) equivalente a USD en un parser', () => {
    expect(calcularTasaJusticia({
      monto: NaN,
      jurisdiccion: 'nacion',
      tipo_proceso: 'general_pecuniary',
      confirmacion: true
    }).ok).toBe(false);
  });
});
