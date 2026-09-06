import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import {
  formatIsoToAr,
  sumarDiasCorridos,
  diferenciaDiasCorridos,
  analizarPlazoBoletoEscritura,
  extraerFechaBoletoUif,
  extraerFechasOperativasLegajo,
} from './fechasCanonicas';
import { clasificarFecha, isActionableDate } from './plazos';
import { sanitizarTerminologiaEscribania } from '@/lib/ai/copiloto';
import {
  aplicarGuardrailOrigenFondos,
  LEYENDA_ORIGEN_FONDOS_FALTANTE,
  type BorradorEscritura,
} from '@/lib/ai/escrituras';

describe('Fechas Canónicas y Consistencia Notarial Multi-superficie', () => {
  it('formatea correctamente ISO YYYY-MM-DD a DD/MM/YYYY', () => {
    expect(formatIsoToAr('2026-09-10')).toBe('10/09/2026');
    expect(formatIsoToAr('2026-09-08')).toBe('08/09/2026');
    expect(formatIsoToAr('2026-06-10')).toBe('10/06/2026');
  });

  it('calcula determinísticamente la fecha límite sumando 90 días corridos al 10/06/2026 (08/09/2026)', () => {
    const fechaLimite = sumarDiasCorridos('2026-06-10', 90);
    expect(fechaLimite).toBe('2026-09-08');
    expect(formatIsoToAr(fechaLimite)).toBe('08/09/2026');
  });

  it('calcula que la fecha tentativa de escritura (10/09/2026) excede el plazo contractual en 2 días corridos', () => {
    const diff = diferenciaDiasCorridos('2026-09-08', '2026-09-10');
    expect(diff).toBe(2);

    const analisis = analizarPlazoBoletoEscritura('2026-06-10', 90, '2026-09-10');
    expect(analisis.fechaLimite).toBe('2026-09-08');
    expect(analisis.fechaLimiteAr).toBe('08/09/2026');
    expect(analisis.excedePlazo).toBe(true);
    expect(analisis.diasExceso).toBe(2);
    expect(analisis.advertencia).toContain('excede el plazo contractual de 90 días corridos');
    expect(analisis.advertencia).toContain('08/09/2026');
    expect(analisis.advertencia).toContain('2 días corridos');
  });

  it('diferencia las tres fechas notariales: Fecha del boleto, Fecha límite contractual y Fecha tentativa de escritura', () => {
    // 1. Fecha del boleto: emisión pasada (no accionable para Radar)
    expect(clasificarFecha('Fecha del boleto')).toBe('issue_date');
    expect(isActionableDate(null, 'Fecha del boleto')).toBe(false);

    // 2. Fecha límite contractual: plazo contractual accionable para Radar y Observaciones
    expect(clasificarFecha('Fecha límite contractual')).toBe('contractual_deadline');
    expect(isActionableDate(null, 'Fecha límite contractual')).toBe(true);

    // 3. Fecha tentativa de escritura: fecha operativa accionable para Radar y Observaciones
    expect(clasificarFecha('Fecha tentativa de escritura')).toBe('contractual_deadline');
    expect(isActionableDate(null, 'Fecha tentativa de escritura')).toBe(true);
  });

  it('extrae tanto 08/09/2026 como 10/09/2026 como eventos distintos sin tratar a 08/09 como fecha huérfana', () => {
    const legajo = {
      id: 'leg-palermo-cuba',
      title: 'Compraventa Depto Palermo Cuba',
      metadata: {
        fecha_boleto: '2026-06-10',
        plazo_dias: 90,
        fecha_otorgamiento: '2026-09-10',
      },
    };

    const aiOutputs = [
      {
        id: 'out-1',
        result_json: {
          fechas_plazos: [
            { descripcion: 'Fecha límite contractual de escrituración', fecha: '2026-09-08' },
            { descripcion: 'Fecha tentativa de escritura', fecha: '2026-09-10' },
          ],
        },
      },
    ];

    const fechas = extraerFechasOperativasLegajo(legajo, aiOutputs);

    // Deben existir ambas fechas clave como eventos distintos
    const fLimite = fechas.find((f) => f.fecha === '2026-09-08');
    const fTentativa = fechas.find((f) => f.fecha === '2026-09-10');
    const fBoleto = fechas.find((f) => f.fecha === '2026-06-10');

    expect(fLimite).toBeDefined();
    expect(fLimite?.tipo).toBe('Fecha límite contractual');

    expect(fTentativa).toBeDefined();
    expect(fTentativa?.tipo).toBe('Fecha tentativa de escritura');

    expect(fBoleto).toBeDefined();
    expect(fBoleto?.tipo).toBe('Fecha del boleto');
  });

  it('extrae fecha de boleto para UIF cuando está presente y documentada', () => {
    const caseRecord = {
      id: 'case-palermo',
      title: 'Compraventa Palermo',
      metadata: {
        fecha_boleto: '2026-06-10',
        fecha_otorgamiento: '2026-09-10',
      },
    };

    const fechaUif = extraerFechaBoletoUif([], null, caseRecord);
    expect(fechaUif).toBe('10/06/2026');
  });
});

describe('Terminología Notarial en Copiloto / Resumen', () => {
  it('sanitiza "El presente expediente" reemplazándolo por "El presente legajo" en escribanía', () => {
    const textoOriginal =
      'El presente expediente trata de una compraventa de inmueble. En este expediente se verifica la titularidad y en la etapa procesal actual se esperan certificados.';

    const sanitizado = sanitizarTerminologiaEscribania(textoOriginal);
    expect(sanitizado).not.toContain('El presente expediente');
    expect(sanitizado).not.toContain('este expediente');
    expect(sanitizado).not.toContain('etapa procesal');
    expect(sanitizado).toContain('El presente legajo');
    expect(sanitizado).toContain('este legajo');
    expect(sanitizado).toContain('etapa notarial');
  });
});

describe('Coherencia Borrador — UIF / PLA', () => {
  it('reemplaza afirmación positiva no acreditada por la leyenda obligatoria y registra dato faltante', () => {
    const borradorConAfirmacion: BorradorEscritura = {
      titulo: 'Borrador de escritura',
      cuerpo:
        'Comparecen las partes. Precio y forma de pago: La parte compradora abona la suma de USD 150.000 en dinero en efectivo. Las partes manifiestan bajo juramento que los fondos utilizados provienen de actividades lícitas.',
      datos_faltantes: ['Matrícula del inmueble'],
      advertencias: ['Certificado de dominio próximo a vencer'],
    };

    const resultado = aplicarGuardrailOrigenFondos(borradorConAfirmacion, false);

    expect(resultado.cuerpo).not.toContain('los fondos utilizados provienen de actividades lícitas');
    expect(resultado.cuerpo).toContain(LEYENDA_ORIGEN_FONDOS_FALTANTE);
    expect(resultado.datos_faltantes).toContain(LEYENDA_ORIGEN_FONDOS_FALTANTE);
    expect(resultado.advertencias.some((a) => a.includes('origen y licitud de fondos'))).toBe(true);
    expect(resultado.advertencias.some((a) => a.includes('entorno controlado'))).toBe(true);
  });

  it('permite mantener texto y no inyecta placeholder si existe evidencia documental estructurada', () => {
    const borradorAcreditado: BorradorEscritura = {
      titulo: 'Borrador de escritura con evidencia',
      cuerpo:
        'Precio y forma de pago: La compradora abona con fondos acreditados mediante certificado contable y declaración jurada UIF.',
      datos_faltantes: [],
      advertencias: [],
    };

    const resultado = aplicarGuardrailOrigenFondos(borradorAcreditado, true);

    expect(resultado.cuerpo).toBe(borradorAcreditado.cuerpo);
    expect(resultado.datos_faltantes).toEqual([]);
    expect(resultado.advertencias).toEqual([]);
  });
});
