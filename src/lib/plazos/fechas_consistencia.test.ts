import { describe, it, expect } from 'vitest';
import {
  formatIsoToAr,
  extraerFechaBoletoUif,
  extraerFechasOperativasLegajo,
} from './fechasCanonicas';

describe('Fechas Canónicas y Consistencia Multi-superficie', () => {
  it('formatea correctamente ISO YYYY-MM-DD a DD/MM/YYYY', () => {
    expect(formatIsoToAr('2026-09-10')).toBe('10/09/2026');
    expect(formatIsoToAr('2026-06-10')).toBe('10/06/2026');
  });

  it('respeta la fecha documentada del caso Palermo Cuba (10/09/2026) y no la bloquea', () => {
    const caseRecord = {
      id: 'case-palermo-cuba',
      title: 'Compraventa Depto Palermo Cuba',
      metadata: {
        fecha_otorgamiento: '2026-09-10',
        tipo_acto: 'Compraventa',
      },
      case_type: 'Compraventa',
    };

    const fechaExtraida = extraerFechaBoletoUif([], null, caseRecord);
    expect(fechaExtraida).toBe('10/09/2026');
    expect(fechaExtraida).not.toBe('08/09/2026');
  });

  it('extrae fecha desde analisisData con fechas_plazos respaldadas (10 de septiembre de 2026)', () => {
    const analisisData = [
      {
        result_json: {
          fechas_plazos: [
            {
              descripcion: 'Firma de escritura traslativa de dominio',
              fecha: '2026-09-10',
              tipo: 'contractual_deadline',
              confianza: 'alta',
            },
          ],
        },
      },
    ];

    const fechaExtraida = extraerFechaBoletoUif(analisisData, null, undefined);
    expect(fechaExtraida).toBe('10/09/2026');
  });

  it('extrae fecha desde texto literal de boleto en el dump sin inventar fechas inexistentes', () => {
    const resumenData = {
      result_json: {
        resumen: 'Boleto de compraventa suscripto con fecha 10 de septiembre de 2026 en la Ciudad de Buenos Aires.',
      },
    };

    const fecha = extraerFechaBoletoUif([], resumenData, undefined);
    expect(fecha).toBe('10/09/2026');
  });

  it('detecta fecha_otorgamiento en escribanía para Observaciones y Radar', () => {
    const legajo = {
      id: 'leg-123',
      title: 'Escritura Sánchez - Gómez',
      metadata: {
        fecha_otorgamiento: '2026-09-10',
      },
    };

    const fechas = extraerFechasOperativasLegajo(legajo);
    expect(fechas).toHaveLength(1);
    expect(fechas[0].fecha).toBe('2026-09-10');
    expect(fechas[0].tipo).toBe('Fecha estimada de firma');
  });
});
