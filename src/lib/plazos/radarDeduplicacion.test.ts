import { describe, it, expect } from 'vitest';
import { deduplicarPlazosRadar, clasificarPlazoSemantico, esPlazoRadarTexto } from './radarDeduplicacion';
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

  it('reconoce "Fecha límite contractual" como término de plazo válido en Radar', () => {
    const items: ItemCronologia[] = [
      {
        fecha: '2026-09-08',
        titulo: 'Fecha límite contractual',
        detalle: 'Plazo contractual de escrituración',
        origen: 'actuacion',
        etiquetaOrigen: 'Boleto',
        esFuturo: true,
      },
    ];

    const result = deduplicarPlazosRadar(items, mockCalcDias);
    expect(result).toHaveLength(1);
    expect(result[0].item.titulo).toBe('Fecha límite contractual');
  });

  it('no fusiona dos vencimientos específicos distintos solo por compartir fecha y categoría general', () => {
    const items: ItemCronologia[] = [
      {
        fecha: '2026-09-15',
        titulo: 'Vencimiento de cláusula resolutoria',
        detalle: 'Cláusula 3 de la reserva',
        origen: 'detectada',
        etiquetaOrigen: 'IA · Contrato',
        esFuturo: true,
      },
      {
        fecha: '2026-09-15',
        titulo: 'Vencimiento plazo de observaciones de títulos',
        detalle: 'Cláusula 7 de la reserva',
        origen: 'detectada',
        etiquetaOrigen: 'IA · Reserva',
        esFuturo: true,
      },
    ];

    const result = deduplicarPlazosRadar(items, mockCalcDias);
    expect(result).toHaveLength(2);
    const titulos = result.map((r) => r.item.titulo);
    expect(titulos).toContain('Vencimiento de cláusula resolutoria');
    expect(titulos).toContain('Vencimiento plazo de observaciones de títulos');
  });

  it('clasificarPlazoSemantico identifica correctamente hechos genéricos vs específicos', () => {
    expect(clasificarPlazoSemantico('Fecha relevante').esGenerico).toBe(true);
    expect(clasificarPlazoSemantico('Próxima fecha clave').esGenerico).toBe(true);
    expect(clasificarPlazoSemantico('Vigencia de la oferta').esGenerico).toBe(false);
    expect(clasificarPlazoSemantico('Vigencia de la oferta').categoria).toBe('oferta_reserva');
    expect(clasificarPlazoSemantico('Visita al inmueble').categoria).toBe('visita');
  });

  it('conserva Fecha límite contractual y Fecha tentativa de escritura como 2 tarjetas distintas y descarta fecha de boleto', () => {
    const items: ItemCronologia[] = [
      {
        fecha: '2026-06-10',
        titulo: 'Fecha de emisión del Boleto de Compraventa',
        detalle: '10 de junio de 2026',
        origen: 'detectada',
        etiquetaOrigen: 'IA',
        esFuturo: true,
      },
      {
        fecha: '2026-09-08',
        titulo: 'Fecha límite contractual',
        detalle: 'Plazo contractual de escrituración',
        origen: 'actuacion',
        etiquetaOrigen: 'Boleto',
        esFuturo: true,
      },
      {
        fecha: '2026-09-10',
        titulo: 'Fecha tentativa de escritura',
        detalle: '10 de septiembre de 2026',
        origen: 'detectada',
        etiquetaOrigen: 'IA',
        esFuturo: true,
      },
    ];

    const result = deduplicarPlazosRadar(items, mockCalcDias);
    expect(result).toHaveLength(2);

    const titulos = result.map((r) => r.item.titulo);
    expect(titulos).toContain('Fecha límite contractual');
    expect(titulos).toContain('Fecha tentativa de escritura');

    const itemLimite = result.find((r) => r.item.titulo === 'Fecha límite contractual');
    const itemTentativa = result.find((r) => r.item.titulo === 'Fecha tentativa de escritura');

    expect(itemLimite?.item.fecha).toBe('2026-09-08');
    expect(itemTentativa?.item.fecha).toBe('2026-09-10');

    // La fecha del boleto 2026-06-10 queda excluida
    const fechas = result.map((r) => r.item.fecha);
    expect(fechas).not.toContain('2026-06-10');
  });

  it('prueba negativa: "Escritura firmada" o "Escritura antecedente" no aparecen como vencimiento por la sola presencia de la palabra escritura', () => {
    const items: ItemCronologia[] = [
      {
        fecha: '2026-09-10',
        titulo: 'Escritura firmada',
        detalle: 'Copia simple archivada',
        origen: 'detectada',
        etiquetaOrigen: 'IA',
        esFuturo: true,
      },
      {
        fecha: '2026-09-12',
        titulo: 'Escritura antecedente',
        detalle: 'Antecedente dominial 2015',
        origen: 'detectada',
        etiquetaOrigen: 'IA',
        esFuturo: true,
      },
    ];

    const result = deduplicarPlazosRadar(items, mockCalcDias);
    expect(result).toHaveLength(0);

    // Verificación individual directa de la función predictora
    expect(esPlazoRadarTexto('Escritura firmada')).toBe(false);
    expect(esPlazoRadarTexto('Escritura antecedente')).toBe(false);
    expect(esPlazoRadarTexto('Fecha tentativa de escritura')).toBe(true);
    expect(esPlazoRadarTexto('Plazo para escritura')).toBe(true);
    expect(esPlazoRadarTexto('Vencimiento de escrituración')).toBe(true);
  });
});
