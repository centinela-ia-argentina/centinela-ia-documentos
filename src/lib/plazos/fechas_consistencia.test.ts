import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import {
  formatIsoToAr,
  sumarDiasCorridos,
  diferenciaDiasCorridos,
  analizarPlazoBoletoEscritura,
  extraerFechaBoletoUif,
  extraerFechasOperativasLegajo,
  extraerFechasAccionablesLegajo,
} from './fechasCanonicas';
import { clasificarFecha, isActionableDate } from './plazos';
import { sanitizarTerminologiaEscribania } from '@/lib/ai/copiloto';
import {
  aplicarGuardrailOrigenFondos,
  evaluarEvidenciaOrigenFondosFailClosed,
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

  it('elimina y reemplaza la frase literal completa sin conservar simultáneamente afirmación de licitud y dato pendiente', () => {
    const fraseLiteral =
      'La presente operación se realiza con fondos de lícito origen, dando cumplimiento a las disposiciones de la Unidad de Información Financiera (UIF).';
    const borrador: BorradorEscritura = {
      titulo: 'Borrador con frase real',
      cuerpo: `Comparecencia. ${fraseLiteral} Se entrega la posesión.`,
      datos_faltantes: [],
      advertencias: [],
    };

    const resultado = aplicarGuardrailOrigenFondos(borrador, false);

    // 1. Ausencia de afirmación de licitud o cumplimiento positivo UIF
    expect(resultado.cuerpo.toLowerCase()).not.toContain('lícito origen');
    expect(resultado.cuerpo.toLowerCase()).not.toContain('licito origen');
    expect(resultado.cuerpo.toLowerCase()).not.toContain('origen lícito');
    expect(resultado.cuerpo.toLowerCase()).not.toContain('origen licito');
    expect(resultado.cuerpo.toLowerCase()).not.toContain('cumplimiento a las disposiciones');
    expect(resultado.cuerpo.toLowerCase()).not.toContain('cumplimiento de las disposiciones');
    expect(resultado.cuerpo.toLowerCase()).not.toContain('dando cumplimiento');

    // 2. Presencia obligatoria del placeholder
    expect(resultado.cuerpo).toContain(LEYENDA_ORIGEN_FONDOS_FALTANTE);
    expect(resultado.datos_faltantes).toContain(LEYENDA_ORIGEN_FONDOS_FALTANTE);
    expect(resultado.advertencias.length).toBeGreaterThan(0);
  });

  it('cubre variantes de fondos lícitos, origen lícito, disposiciones UIF y justificación positiva no respaldada', () => {
    const variantes = [
      'Los fondos son de lícito origen y se dio cumplimiento a las disposiciones de la UIF.',
      'El adquirente abona con fondos de origen lícito.',
      'Se abona con fondos lícitos acreditando el origen lícito.',
      'Operación efectuada dando cumplimiento estricto a las disposiciones de la Unidad de Información Financiera.',
      'Las partes declaran la justificación positiva de fondos conforme UIF.',
    ];

    for (const v of variantes) {
      const borrador: BorradorEscritura = {
        titulo: 'Borrador variante',
        cuerpo: `Cláusula de pago: ${v}`,
        datos_faltantes: [],
        advertencias: [],
      };
      const res = aplicarGuardrailOrigenFondos(borrador, false);

      expect(res.cuerpo.toLowerCase()).not.toContain('lícito origen');
      expect(res.cuerpo.toLowerCase()).not.toContain('origen lícito');
      expect(res.cuerpo.toLowerCase()).not.toContain('fondos lícitos');
      expect(res.cuerpo).toContain(LEYENDA_ORIGEN_FONDOS_FALTANTE);
    }
  });
});

describe('Evidencia UIF Fail-Closed', () => {
  it('falla cerrado si el resumen contiene "No acredita origen de fondos" y mantiene el placeholder', () => {
    const docAnalisis = {
      document_type: 'origen_fondos',
      file_name: 'origen_fondos.pdf',
      resumen: 'El cliente no acredita origen de fondos ni presenta recibos suficientes.',
      datos_clave: ['fondos', 'ingresos'],
    };

    const tieneEvidencia = evaluarEvidenciaOrigenFondosFailClosed(docAnalisis);
    expect(tieneEvidencia).toBe(false);

    const borrador: BorradorEscritura = {
      titulo: 'Borrador test',
      cuerpo: 'Precio y forma de pago: USD 50.000.',
      datos_faltantes: [],
      advertencias: [],
    };
    const res = aplicarGuardrailOrigenFondos(borrador, tieneEvidencia);
    expect(res.cuerpo).toContain(LEYENDA_ORIGEN_FONDOS_FALTANTE);
  });

  it('rechaza explícitamente términos negativos: sin acreditar, no consta, falta, pendiente, insuficiente, no verificado', () => {
    const frasesNegativas = [
      'Documento sin acreditar origen de fondos',
      'No consta justificación de ingresos ni fondos',
      'Falta documentación respaldatoria de origen de fondos',
      'Trámite de fondos pendiente de verificación',
      'Justificación insuficiente de fondos',
      'Origen de fondos no verificado',
      'No se acredita la licitud',
    ];

    for (const f of frasesNegativas) {
      const doc = {
        document_type: 'uif',
        file_name: 'uif_doc.pdf',
        resumen: f,
        datos_clave: ['declaración', 'ingresos'],
      };
      expect(evaluarEvidenciaOrigenFondosFailClosed(doc)).toBe(false);
    }
  });

  it('solo aprueba si existe acreditación estructurada positiva explícita con documento fuente', () => {
    // 1. Caso afirmativo estructurado
    const docPositivo = {
      document_type: 'origen_fondos',
      file_name: 'certificacion_ingresos.pdf',
      resumen: 'Certificado contable legalizado con manifestación de bienes y fondos.',
      origen_fondos_acreditado: true,
      documento_fuente_uif: 'certificacion_ingresos.pdf',
    };
    expect(evaluarEvidenciaOrigenFondosFailClosed(docPositivo)).toBe(true);

    // 2. Falta campo estructurado -> fail-closed por defecto (false)
    const docSinFlag = {
      document_type: 'origen_fondos',
      file_name: 'fondos_ambiguo.pdf',
      resumen: 'Se adjunta documentación.',
    };
    expect(evaluarEvidenciaOrigenFondosFailClosed(docSinFlag)).toBe(false);

    // 3. Documento null/undefined -> false
    expect(evaluarEvidenciaOrigenFondosFailClosed(null)).toBe(false);
    expect(evaluarEvidenciaOrigenFondosFailClosed(undefined)).toBe(false);
  });
});

describe('Fuente Común para Fechas y Extracción Accionable', () => {
  it('calcula la fecha límite 08/09 a partir del análisis documental cuando no fue copiada a metadata', () => {
    const legajoSinMeta = {
      id: 'leg-sin-meta',
      title: 'Legajo Palermo Cuba Sin Metadata de Límite',
      metadata: {}, // metadata vacía
    };

    const aiOutputs = [
      {
        id: 'out-boleto',
        result_json: {
          fechas_plazos: [
            { descripcion: 'Fecha del boleto de compraventa', fecha: '2026-06-10' },
            { descripcion: 'Fecha tentativa de escrituración', fecha: '2026-09-10' },
          ],
          resumen: 'Boleto firmado el 10/06/2026 con plazo contractual de 90 días corridos para otorgar la escritura.',
        },
      },
    ];

    const fechas = extraerFechasOperativasLegajo(legajoSinMeta, aiOutputs);

    const fLimite = fechas.find((f) => f.tipo === 'Fecha límite contractual');
    expect(fLimite).toBeDefined();
    expect(fLimite?.fecha).toBe('2026-09-08');

    const fTentativa = fechas.find((f) => f.tipo === 'Fecha tentativa de escritura');
    expect(fTentativa).toBeDefined();
    expect(fTentativa?.fecha).toBe('2026-09-10');
  });

  it('extraerFechasAccionablesLegajo excluye la Fecha del boleto para Radar y Observaciones', () => {
    const legajo = {
      id: 'leg-1',
      title: 'Legajo 1',
      metadata: {
        fecha_boleto: '2026-06-10',
        plazo_dias: 90,
        fecha_otorgamiento: '2026-09-10',
      },
    };

    const accionables = extraerFechasAccionablesLegajo(legajo, []);

    // No debe contener 'Fecha del boleto'
    expect(accionables.some((f) => f.tipo.toLowerCase().includes('boleto'))).toBe(false);
    expect(accionables.some((f) => f.fecha === '2026-06-10')).toBe(false);

    // Debe contener Fecha límite contractual y Fecha tentativa de escritura con etiquetas diferenciadas
    const limite = accionables.find((f) => f.fecha === '2026-09-08');
    const tentativa = accionables.find((f) => f.fecha === '2026-09-10');

    expect(limite).toBeDefined();
    expect(limite?.tipo).toBe('Fecha límite contractual');

    expect(tentativa).toBeDefined();
    expect(tentativa?.tipo).toBe('Fecha tentativa de escritura');
    expect(accionables.length).toBeGreaterThanOrEqual(2);
  });
});
