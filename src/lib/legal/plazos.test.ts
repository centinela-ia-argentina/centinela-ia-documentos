import { describe, it, expect } from 'vitest';
import { calcularVencimientoProcesal, sumarDiasCorridos } from './plazos';

describe('Plazos Procesales', () => {
  it('Debe calcular Corrientes 2026 correctamente (03/08/2026 + 15 hábiles)', () => {
    const result = calcularVencimientoProcesal({
      fechaNotificacion: '2026-08-03',
      diasHabiles: 15,
      jurisdiccion: 'corrientes'
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.vencimiento).toBe('2026-08-25');
    }
  });

  it('Debe calcular Corrientes 2026 con ampliación por distancia (450km)', () => {
    const result = calcularVencimientoProcesal({
      fechaNotificacion: '2026-08-03',
      diasHabiles: 15,
      jurisdiccion: 'corrientes',
      kmDistancia: 450
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.vencimiento).toBe('2026-08-27');
    }
  });

  it('Debe bloquear año 2027', () => {
    const result = calcularVencimientoProcesal({
      fechaNotificacion: '2027-08-03',
      diasHabiles: 15,
      jurisdiccion: 'corrientes'
    });
    expect(result.ok).toBe(false);
  });

  it('Debe bloquear jurisdicciones no verificadas (PBA, Nación si no está validada en LEGAL_CALENDARS)', () => {
    expect(calcularVencimientoProcesal({
      fechaNotificacion: '2026-08-03',
      diasHabiles: 15,
      jurisdiccion: 'pba'
    }).ok).toBe(false);

    // Nación está en el sistema, pero asumiendo que no tiene coverage='verified' fallaría.
    // Actualmente si nacion no está verificada, debe fallar.
    expect(calcularVencimientoProcesal({
      fechaNotificacion: '2026-08-03',
      diasHabiles: 15,
      jurisdiccion: 'nacion'
    }).ok).toBe(false);
  });

  it('Debe rechazar fecha inválida', () => {
    expect(calcularVencimientoProcesal({
      fechaNotificacion: '2026-13-45',
      diasHabiles: 15,
      jurisdiccion: 'corrientes'
    }).ok).toBe(false);
  });

  it('Debe rechazar distancia inválida (negativa o NaN), calculando ampliación 0', () => {
    // La función interna diasAmpliacionPorDistancia devuelve 0 para negativos/NaN.
    // Si pasamos distancia negativa, simplemente no amplía.
    const result = calcularVencimientoProcesal({
      fechaNotificacion: '2026-08-03',
      diasHabiles: 15,
      jurisdiccion: 'corrientes',
      kmDistancia: -500
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.diasAmpliacion).toBe(0);
      expect(result.vencimiento).toBe('2026-08-25'); // Igual que el primer test
    }
  });

  it('Días corridos como cálculo aritmético puro', () => {
    const date = new Date('2026-08-03T00:00:00');
    const result = sumarDiasCorridos(date, 5);
    expect(result.toISOString().split('T')[0]).toBe('2026-08-08');
  });
});
