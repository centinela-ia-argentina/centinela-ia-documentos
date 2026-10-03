import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { calificarInquilinoConIA } from './preScore';

describe('PreScore Inquilino y Garantías', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
  });

  it('evaluates apto to condicional when gravamenes exist despite high income coverage', async () => {
    // 3.37x coverage (e.g. 1,685,000 / 500,000) with usufructo/embargo -> condicional
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                ingreso_neto_mensual_estimado: 1685000,
                moneda_ingreso: 'ARS',
                observaciones_ingresos: ['Tres recibos de sueldo promediados'],
                garantias: ['Garantía propietaria en CABA'],
                gravamenes_detectados: ['Inscripción de Usufructo vitalicio'],
                senales_alerta: ['Garantía afectada por gravamen'],
                verificaciones_pendientes: ['Pedir informe de dominio actualizado'],
                fundamento: 'Ingresos suficientes pero garantía gravada.',
              }),
            }],
          },
        }],
      }),
    } as any);

    const res = await calificarInquilinoConIA({
      titulo: 'Postulación Alquiler Depto',
      alquilerMensual: 500000,
      moneda: 'ARS',
      documentos: [{
        nombre: 'Recibo_1.pdf',
        tipo: 'Recibo de sueldo',
        resumen: 'Sueldo neto 1.685.000',
        alertas: [],
        datos: ['Neto: 1685000'],
      }],
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.prescore.veces_alquiler).toBe(3.37);
      expect(res.prescore.nivel_calificacion).toBe('condicional');
      expect(res.prescore.gravamenes_detectados).toContain('Inscripción de Usufructo vitalicio');
    }
  });

  it('marks as indeterminado when currencies do not match (ARS vs USD)', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                ingreso_neto_mensual_estimado: 2500,
                moneda_ingreso: 'USD',
                observaciones_ingresos: ['Cobro en USD'],
                garantias: ['Seguro de caución'],
                gravamenes_detectados: [],
                senales_alerta: [],
                verificaciones_pendientes: [],
                fundamento: 'Ingresos en dólares para alquiler en pesos.',
              }),
            }],
          },
        }],
      }),
    } as any);

    const res = await calificarInquilinoConIA({
      titulo: 'Postulación Alquiler Depto',
      alquilerMensual: 450000,
      moneda: 'ARS',
      documentos: [{
        nombre: 'Invoice.pdf',
        tipo: 'Recibo de sueldo',
        resumen: 'Cobro del exterior 2500 USD',
        alertas: [],
        datos: ['Neto: 2500 USD'],
      }],
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.prescore.nivel_calificacion).toBe('indeterminado');
      expect(res.prescore.regla_recomendada).toContain('las monedas no coinciden');
    }
  });
});
