import { describe, it, expect } from 'vitest';
import { deduplicarPlazosRadar, clasificarPlazoSemantico } from './radarDeduplicacion';
import type { ItemCronologia } from '@/app/expedientes/[id]/CronologiaExpediente';

describe('Radar Semántico - Deduplicación conservadora (Punto 1)', () => {
  const mockCalcDias = () => 5; // 5 días restantes -> 'urgente'

  it('(A) "Fecha relevante" + "Vigencia de la oferta" en la misma fecha colapsan en 1 tarjeta conservando el título más informativo', () => {
    const items: ItemCronologia[] = [
      {
        fecha: '2026-09-15',
        titulo: 'Fecha relevante',
        detalle: 'Cargada manualmente en metadata',
        origen: 'actuacion',
        etiquetaOrigen: 'Metadata',
        esFuturo: true,
      },
      {
        fecha: '2026-09-15',
        titulo: 'Vigencia de la oferta',
        detalle: 'Oferta de compra vence en fecha estipulada',
        origen: 'detectada',
        etiquetaOrigen: 'IA · Reserva.pdf',
        esFuturo: true,
      },
    ];

    const result = deduplicarPlazosRadar(items, mockCalcDias);

    expect(result).toHaveLength(1);
    expect(result[0].item.titulo).toBe('Vigencia de la oferta');
    expect(result[0].item.etiquetaOrigen).toContain('Metadata');
    expect(result[0].item.etiquetaOrigen).toContain('IA · Reserva.pdf');
  });

  it('(B) "Vigencia de la oferta" + "Visita al inmueble" en la misma fecha producen 2 tarjetas separadas', () => {
    const items: ItemCronologia[] = [
      {
        fecha: '2026-09-20',
        titulo: 'Vigencia de la oferta',
        detalle: 'Vencimiento de aceptación de reserva',
        origen: 'detectada',
        etiquetaOrigen: 'IA · Reserva.pdf',
        esFuturo: true,
      },
      {
        fecha: '2026-09-20',
        titulo: 'Visita al inmueble',
        detalle: 'Coordinación con tasador',
        origen: 'actuacion',
        etiquetaOrigen: 'Agenda',
        esFuturo: true,
      },
    ];

    const result = deduplicarPlazosRadar(items, mockCalcDias);

    expect(result).toHaveLength(2);
    const titulos = result.map((r) => r.item.titulo);
    expect(titulos).toContain('Vigencia de la oferta');
    expect(titulos).toContain('Visita al inmueble');
  });

  it('(C) Dos vencimientos contractuales distintos en la misma fecha se conservan como 2 tarjetas', () => {
    const items: ItemCronologia[] = [
      {
        fecha: '2026-09-25',
        titulo: 'Vencimiento entrega de posesión',
        detalle: 'Cláusula 5 del boleto',
        origen: 'detectada',
        etiquetaOrigen: 'IA · Boleto.pdf',
        esFuturo: true,
      },
      {
        fecha: '2026-09-25',
        titulo: 'Vencimiento de escrituración',
        detalle: 'Designación de escribanía',
        origen: 'detectada',
        etiquetaOrigen: 'IA · Reserva.pdf',
        esFuturo: true,
      },
    ];

    const result = deduplicarPlazosRadar(items, mockCalcDias);

    expect(result).toHaveLength(2);
    const titulos = result.map((r) => r.item.titulo);
    expect(titulos).toContain('Vencimiento entrega de posesión');
    expect(titulos).toContain('Vencimiento de escrituración');
  });

  it('(D) Fechas de emisión, boleto o recibos de pago no se confunden con plazos ni aparecen como vencimientos', () => {
    const items: ItemCronologia[] = [
      {
        fecha: '2026-09-10',
        titulo: 'Fecha de emisión del comprobante',
        detalle: 'Comprobante de pago de seña',
        origen: 'detectada',
        etiquetaOrigen: 'IA',
        esFuturo: true,
      },
      {
        fecha: '2026-09-10',
        titulo: 'Fecha del boleto',
        detalle: 'Firma de boleto',
        origen: 'detectada',
        etiquetaOrigen: 'IA',
        esFuturo: true,
      },
      {
        fecha: '2026-09-10',
        titulo: 'Recibo de sueldo',
        detalle: 'Emisión recibo',
        origen: 'detectada',
        etiquetaOrigen: 'IA',
        esFuturo: true,
      },
      {
        fecha: '2026-09-10',
        titulo: 'Vencimiento de la reserva',
        detalle: 'Plazo perentorio',
        origen: 'detectada',
        etiquetaOrigen: 'IA',
        esFuturo: true,
      },
    ];

    const result = deduplicarPlazosRadar(items, mockCalcDias);

    expect(result).toHaveLength(1);
    expect(result[0].item.titulo).toBe('Vencimiento de la reserva');
  });

  it('clasificarPlazoSemantico identifica correctamente hechos genéricos vs específicos', () => {
    expect(clasificarPlazoSemantico('Fecha relevante').esGenerico).toBe(true);
    expect(clasificarPlazoSemantico('Próxima fecha clave').esGenerico).toBe(true);
    expect(clasificarPlazoSemantico('Vigencia de la oferta').esGenerico).toBe(false);
    expect(clasificarPlazoSemantico('Vigencia de la oferta').categoria).toBe('oferta_reserva');
    expect(clasificarPlazoSemantico('Visita al inmueble').categoria).toBe('visita');
  });
});
