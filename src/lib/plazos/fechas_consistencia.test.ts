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
  parsearFechaCualquiera,
  extraerPlazoCanonicoLegajo,
} from './fechasCanonicas';
import { clasificarFecha, isActionableDate } from './plazos';
import { sanitizarTerminologiaEscribania } from '@/lib/ai/copiloto';
import {
  aplicarGuardrailOrigenFondos,
  aplicarGuardrailIti,
  sanearCitasNormativasTributarias,
  evaluarEvidenciaOrigenFondosFailClosed,
  validarOrdinalesNotariales,
  recalcularOrdinalesNotariales,
  LEYENDA_ORIGEN_FONDOS_FALTANTE,
  CLAUSULA_AUTONOMA_UIF,
  LEYENDA_ITI_DEROGADO,
  LEYENDA_ITI_VERIFICAR_FECHA,
  type BorradorEscritura,
} from '@/lib/ai/escrituras';
import { extraerHechosTemporalesLegajo } from './cargarHechosTemporalesLegajo';

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

describe('Fuente Canónica Única de Plazos (extraerPlazoCanonicoLegajo)', () => {
  it('parsea fechas textuales españolas e ISO con parsearFechaCualquiera', () => {
    const p1 = parsearFechaCualquiera('10 de junio de 2026');
    expect(p1).not.toBeNull();
    expect(p1?.iso).toBe('2026-06-10');
    expect(p1?.ar).toBe('10/06/2026');

    const p2 = parsearFechaCualquiera('10 de septiembre de 2026');
    expect(p2).not.toBeNull();
    expect(p2?.iso).toBe('2026-09-10');
    expect(p2?.ar).toBe('10/09/2026');

    const p3 = parsearFechaCualquiera('08/09/2026');
    expect(p3).not.toBeNull();
    expect(p3?.iso).toBe('2026-09-08');
    expect(p3?.ar).toBe('08/09/2026');
  });

  it('extraerPlazoCanonicoLegajo extrae correctamente fechaBoleto, plazoDias, fechaLimite, fechaTentativa y excesoDias', () => {
    const legajo = {
      id: 'palermo-1',
      title: 'Compraventa Depto Palermo Cuba',
      metadata: {
        fecha_boleto: '10 de junio de 2026',
        plazo_dias: 90,
        fecha_otorgamiento: '10 de septiembre de 2026',
      },
    };

    const plazo = extraerPlazoCanonicoLegajo(legajo, [], []);
    expect(plazo).not.toBeNull();
    expect(plazo?.fechaBoleto).toBe('10/06/2026');
    expect(plazo?.plazoDias).toBe(90);
    expect(plazo?.fechaLimite).toBe('08/09/2026');
    expect(plazo?.fechaTentativa).toBe('10/09/2026');
    expect(plazo?.excesoDias).toBe(2);
    expect(plazo?.excedePlazo).toBe(true);
  });
});

describe('Guardrail Jurídico I.T.I. (Ley 27.743) - Matriz Fail-Closed y C.O.T.I.', () => {
  it('acto 2026: reemplaza mención de retención I.T.I. por constancia de derogación legal', () => {
    const borrador: BorradorEscritura = {
      titulo: 'Escritura compraventa 2026',
      cuerpo: 'QUINTO: Se deja constancia de la retención del Impuesto a la Transferencia de Inmuebles (I.T.I.) del 1.5%.\nSEXTO: Posesión.',
      datos_faltantes: [],
      advertencias: [],
    };

    const resultado = aplicarGuardrailIti(borrador, '2026-09-10');
    expect(resultado.cuerpo).not.toContain('retención del Impuesto a la Transferencia de Inmuebles');
    expect(resultado.cuerpo).toContain(LEYENDA_ITI_DEROGADO);
  });

  it('acto anterior al 08/07/2024: no aplica la constancia de derogación posterior', () => {
    const borrador: BorradorEscritura = {
      titulo: 'Escritura histórica mayo 2024',
      cuerpo: 'QUINTO: Se retiene el Impuesto a la Transferencia de Inmuebles (I.T.I.) conforme normativa vigente.\nSEXTO: Posesión.',
      datos_faltantes: [],
      advertencias: [],
    };

    const resultado = aplicarGuardrailIti(borrador, '2024-05-10');
    // No debe aplicar la constancia de derogación de Ley 27.743
    expect(resultado.cuerpo).not.toContain(LEYENDA_ITI_DEROGADO);
    expect(resultado.cuerpo).not.toContain('no aplicable por Ley 27.743');
    expect(resultado.cuerpo).not.toContain('derogado');
    expect(resultado.cuerpo).toContain('Impuesto a la Transferencia de Inmuebles (I.T.I.)');
  });

  it('fecha ausente: neutraliza retención con verificación de régimen tributario y agrega advertencia', () => {
    const borrador: BorradorEscritura = {
      titulo: 'Escritura sin fecha planificada',
      cuerpo: 'QUINTO: Se retiene el I.T.I. correspondiente a la operación.\nSEXTO: Posesión.',
      datos_faltantes: [],
      advertencias: [],
    };

    // Sin fecha de operación
    const resultado = aplicarGuardrailIti(borrador, undefined);
    expect(resultado.cuerpo).not.toContain('Se retiene el I.T.I.');
    expect(resultado.cuerpo).not.toContain(LEYENDA_ITI_DEROGADO);
    expect(resultado.cuerpo).toContain(LEYENDA_ITI_VERIFICAR_FECHA);
    expect(resultado.datos_faltantes).toContain(LEYENDA_ITI_VERIFICAR_FECHA);
    expect(resultado.advertencias.some((a) => a.includes('régimen tributario aplicable'))).toBe(true);
  });

  it('fecha inválida: neutraliza retención con verificación de régimen tributario', () => {
    const borrador: BorradorEscritura = {
      titulo: 'Escritura con fecha corrupta',
      cuerpo: 'QUINTO: Retención de I.T.I. del 1.5% aplicada.\nSEXTO: Posesión.',
      datos_faltantes: [],
      advertencias: [],
    };

    const resultado = aplicarGuardrailIti(borrador, 'fecha-invalida-xyz');
    expect(resultado.cuerpo).toContain(LEYENDA_ITI_VERIFICAR_FECHA);
    expect(resultado.cuerpo).not.toContain(LEYENDA_ITI_DEROGADO);
    expect(resultado.datos_faltantes).toContain(LEYENDA_ITI_VERIFICAR_FECHA);
  });

  it('preservación exacta de C.O.T.I.: no altera el número ni lo confunde con I.T.I. en ninguna condición', () => {
    const borrador: BorradorEscritura = {
      titulo: 'Escritura compraventa',
      cuerpo: 'QUINTO: Se retiene el I.T.I. correspondiente y se adjunta certificado C.O.T.I. N° 98765432 emitido por AFIP.\nSEXTO: Entrega.',
      datos_faltantes: [],
      advertencias: [],
    };

    const resPost = aplicarGuardrailIti(borrador, '2026-09-10');
    expect(resPost.cuerpo).toContain('C.O.T.I. N° 98765432');
    expect(resPost.cuerpo).not.toContain('Se retiene el I.T.I.');

    const resSinFecha = aplicarGuardrailIti(borrador, null);
    expect(resSinFecha.cuerpo).toContain('C.O.T.I. N° 98765432');
    expect(resSinFecha.cuerpo).toContain(LEYENDA_ITI_VERIFICAR_FECHA);
  });
});

describe('Guardrail UIF sin Pérdida de Contenido y Cláusula Autónoma', () => {
  it('inyecta CLAUSULA_AUTONOMA_UIF cuando no existe cláusula y no hay acreditación', () => {
    const borrador: BorradorEscritura = {
      titulo: 'Borrador sin clausula de fondos',
      cuerpo: 'PRIMERO: Partes.\nSEGUNDO: Venta.\nTERCERO: Posesión.',
      datos_faltantes: [],
      advertencias: [],
    };

    const res = aplicarGuardrailOrigenFondos(borrador, false);
    expect(res.cuerpo).toContain(CLAUSULA_AUTONOMA_UIF);
  });

  it('preserva precio, posesión y C.O.T.I. en una sola línea reemplazando únicamente la frase insegura de UIF', () => {
    // Línea única con precio y forma de pago, frase insegura UIF, posesión y C.O.T.I.
    const lineaUnica =
      'PRIMERO: El precio fijado es de USD 150.000 que se abona en dinero en efectivo en este acto. La presente operación se realiza con fondos de lícito origen, dando cumplimiento a las disposiciones de la Unidad de Información Financiera (UIF). La parte vendedora hace entrega de la posesión real y definitiva del inmueble. Consta agregado certificado C.O.T.I. N° 98765432 emitido por AFIP.';

    const borrador: BorradorEscritura = {
      titulo: 'Escritura compleja',
      cuerpo: lineaUnica,
      datos_faltantes: [],
      advertencias: [],
    };

    const res = aplicarGuardrailOrigenFondos(borrador, false);

    // 1. Debe conservar el precio y forma de pago
    expect(res.cuerpo).toContain('El precio fijado es de USD 150.000 que se abona en dinero en efectivo en este acto.');
    // 2. Debe conservar la posesión
    expect(res.cuerpo).toContain('La parte vendedora hace entrega de la posesión real y definitiva del inmueble.');
    // 3. Debe conservar el C.O.T.I.
    expect(res.cuerpo).toContain('Consta agregado certificado C.O.T.I. N° 98765432 emitido por AFIP.');
    // 4. Debe reemplazar únicamente la frase insegura por la cláusula autónoma UIF
    expect(res.cuerpo).toContain(CLAUSULA_AUTONOMA_UIF);
    // 5. No debe conservar afirmación de licitud ni de cumplimiento positivo no respaldado
    expect(res.cuerpo.toLowerCase()).not.toContain('lícito origen');
    expect(res.cuerpo.toLowerCase()).not.toContain('cumplimiento a las disposiciones');
    expect(res.cuerpo.toLowerCase()).not.toContain('cumplimiento de las disposiciones');
  });

  it('barre la frase "los fondos provienen de..." sin afectar el resto de la cláusula', () => {
    const borrador: BorradorEscritura = {
      titulo: 'Borrador con afirmación de origen',
      cuerpo: 'CUARTO: El comprador abona en efectivo la suma convenida. Los fondos provienen de ahorros personales no declarados previamente.',
      datos_faltantes: [],
      advertencias: [],
    };

    const res = aplicarGuardrailOrigenFondos(borrador, false);
    expect(res.cuerpo.toLowerCase()).not.toContain('los fondos provienen de');
    expect(res.cuerpo).toContain('El comprador abona en efectivo la suma convenida');
    expect(res.cuerpo).toContain(LEYENDA_ORIGEN_FONDOS_FALTANTE);
  });
});

describe('Extractor Canónico con Precedencia Semántica y Trazabilidad', () => {
  it('retorna cómputo exacto para Palermo Cuba y excluye antecedentes históricos y certificados de la fecha tentativa', () => {
    const legajo = {
      id: 'leg-palermo-cuba',
      title: 'Compraventa Depto Palermo Cuba',
      metadata: {
        tipo_acto: 'Compraventa',
        fecha_boleto: '2026-06-10',
        plazo_dias: 90,
        fecha_otorgamiento: '2026-09-10',
      },
    };

    const aiOutputs = [
      {
        id: 'out-boleto',
        document_id: 'doc-boleto',
        result_json: {
          fechas_plazos: [
            { descripcion: 'Fecha del boleto', fecha: '2026-06-10', tipo: 'issue_date' },
            { descripcion: 'Fecha tentativa de escritura', fecha: '2026-09-10', tipo: 'contractual_deadline' },
          ],
        },
      },
      {
        id: 'out-antecedente',
        document_id: 'doc-antecedente',
        result_json: {
          fechas_plazos: [
            { descripcion: 'Escritura antecedente', fecha: '2015-03-15', tipo: 'issue_date' },
          ],
        },
      },
      {
        id: 'out-certificados',
        document_id: 'doc-certificados',
        result_json: {
          fechas_plazos: [
            { descripcion: 'Vencimiento Certificado Catastral', fecha: '2026-10-20', tipo: 'document_expiration' },
            { descripcion: 'Vencimiento Certificado Dominio', fecha: '2026-11-01', tipo: 'document_expiration' },
          ],
        },
      },
    ];

    const canonico = extraerPlazoCanonicoLegajo(legajo, aiOutputs, []);
    expect(canonico).not.toBeNull();
    expect(canonico?.fechaBoleto).toBe('10/06/2026');
    expect(canonico?.plazoDias).toBe(90);
    expect(canonico?.fechaLimite).toBe('08/09/2026');
    expect(canonico?.fechaTentativa).toBe('10/09/2026');
    expect(canonico?.excesoDias).toBe(2);
    expect(canonico?.excedePlazo).toBe(true);
    expect(canonico?.fuenteFechaBoleto).toBe('metadata.fecha_boleto');
    expect(canonico?.fuentePlazo).toBe('metadata.plazo_dias');
    expect(canonico?.fuenteFechaTentativa).toBe('metadata.fecha_otorgamiento');

    // Fechas accionables excluyen boleto y antecedentes históricos (2015-03-15)
    const accionables = extraerFechasAccionablesLegajo(legajo, aiOutputs, []);
    expect(accionables.some((a) => a.fecha === '2026-06-10')).toBe(false);
    expect(accionables.some((a) => a.fecha === '2015-03-15')).toBe(false);
    expect(accionables.some((a) => a.fecha === '2026-09-08')).toBe(true);
    expect(accionables.some((a) => a.fecha === '2026-09-10')).toBe(true);
  });

  it('rechaza fecha de otorgamiento si está asociada a una escritura antecedente', () => {
    const legajo = {
      id: 'leg-antecedente-only',
      title: 'Legajo de prueba',
      metadata: {},
    };

    const aiOutputs = [
      {
        id: 'out-1',
        document_id: 'doc-1',
        result_json: {
          fechas_plazos: [
            { descripcion: 'Fecha del boleto firmado', fecha: '2026-06-10' },
            { descripcion: 'Escritura antecedente de otorgamiento', fecha: '2015-03-15' },
          ],
          datos_clave: ['plazo contractual de 90 días corridos'],
        },
      },
    ];

    const canonico = extraerPlazoCanonicoLegajo(legajo, aiOutputs, []);
    expect(canonico).not.toBeNull();
    expect(canonico?.fechaBoleto).toBe('10/06/2026');
    expect(canonico?.plazoDias).toBe(90);
    expect(canonico?.fechaLimite).toBe('08/09/2026');
    // La fecha del 2015-03-15 no debe ser adoptada como fecha tentativa
    expect(canonico?.fechaTentativa).not.toBe('15/03/2015');
    expect(canonico?.fechaTentativa).toBe('');
    expect(canonico?.excedePlazo).toBe(false);
  });
});

describe('Numeración Notarial Determinística', () => {
  it('detecta ordinales duplicados correctamente con validarOrdinalesNotariales', () => {
    const cuerpoDuplicado = [
      'PRIMERO: Comparecencia.',
      'SEGUNDO: Objeto.',
      'TERCERO: Antecedentes.',
      'CUARTO: Precio.',
      'QUINTO: MEDIOS DE PAGO Y ORIGEN DE FONDOS.',
      'QUINTO: Certificados.',
      'SEXTO: Otorgamiento.',
    ].join('\n');

    const validacion = validarOrdinalesNotariales(cuerpoDuplicado);
    expect(validacion.ok).toBe(false);
    expect(validacion.duplicados).toContain('QUINTO');
  });

  it('recalcula secuencialmente los ordinales eliminando duplicados y huecos', () => {
    const cuerpoDesordenado = [
      'PRIMERO: Comparecencia.',
      'SEGUNDO: Objeto.',
      'TERCERO: Antecedentes.',
      'CUARTO: Precio.',
      'CLAUSULA: MEDIOS DE PAGO Y ORIGEN DE FONDOS.',
      'QUINTO: Certificados.',
      'SEXTO: Otorgamiento.',
    ].join('\n');

    const recalculado = recalcularOrdinalesNotariales(cuerpoDesordenado);
    const validacion = validarOrdinalesNotariales(recalculado);

    expect(validacion.ok).toBe(true);
    expect(validacion.duplicados.length).toBe(0);

    expect(recalculado).toContain('PRIMERO: Comparecencia.');
    expect(recalculado).toContain('SEGUNDO: Objeto.');
    expect(recalculado).toContain('TERCERO: Antecedentes.');
    expect(recalculado).toContain('CUARTO: Precio.');
    expect(recalculado).toContain('QUINTO: MEDIOS DE PAGO Y ORIGEN DE FONDOS.');
    expect(recalculado).toContain('SEXTO: Certificados.');
    expect(recalculado).toContain('SÉPTIMO: Otorgamiento.');
  });
});

describe('Subcláusula Única de ITI y Preservación de COTI', () => {
  it('reemplaza la mención de ITI exactamente una vez y no duplica leyendas en el cuerpo', () => {
    const borrador: BorradorEscritura = {
      titulo: 'Borrador compraventa',
      cuerpo: [
        'CUARTO: Se abona el precio.',
        'QUINTO: Se deja constancia de la retención del Impuesto a la Transferencia de Inmuebles (ITI) por el 1.5% y se agrega C.O.T.I. N° 98765432.',
        'SEXTO: Entrega de posesión.',
      ].join('\n'),
      datos_faltantes: [],
      advertencias: [],
    };

    const res = aplicarGuardrailIti(borrador, '2026-09-10');
    expect(res.cuerpo).toContain('C.O.T.I. N° 98765432');
    expect(res.cuerpo).toContain(LEYENDA_ITI_DEROGADO);
    // Verificar que la leyenda aparece exactamente 1 vez
    const conteo = res.cuerpo.split(LEYENDA_ITI_DEROGADO).length - 1;
    expect(conteo).toBe(1);

    // Cero duplicados de ordinales
    const validacion = validarOrdinalesNotariales(res.cuerpo);
    expect(validacion.ok).toBe(true);
  });

  it('reemplaza ITI preservando Impuesto a las Ganancias en ausencia de COTI (10/09/2026)', () => {
    const borrador: BorradorEscritura = {
      titulo: 'Borrador compraventa',
      cuerpo: [
        'PRIMERO: Comparecencia.',
        'SEGUNDO: Objeto.',
        'TERCERO: Antecedentes.',
        'CUARTO: Se abona la suma pactada en concepto de precio de venta.',
        'QUINTO: Se deja constancia de la retención del Impuesto a la Transferencia de Inmuebles (ITI) por el 1.5% y que no corresponde retención de Impuesto a las Ganancias por tratarse de casa habitación.',
        'SEXTO: Se otorga la posesión pacífica del inmueble.',
      ].join('\n'),
      datos_faltantes: [],
      advertencias: [],
    };

    const res = aplicarGuardrailIti(borrador, '2026-09-10');
    expect(res.cuerpo).toContain(LEYENDA_ITI_DEROGADO);
    expect(res.cuerpo).toContain('Impuesto a las Ganancias');
    expect(res.cuerpo).toContain('casa habitación');
    expect(res.cuerpo).not.toContain('retención del Impuesto a la Transferencia de Inmuebles');
    expect(res.cuerpo).toContain('CUARTO: Se abona la suma pactada');
    expect(res.cuerpo).toContain('QUINTO:');
    expect(res.cuerpo).toContain('SEXTO: Se otorga la posesión pacífica del inmueble.');

    const validacion = validarOrdinalesNotariales(res.cuerpo);
    expect(validacion.ok).toBe(true);
  });

  it('reemplaza ITI preservando Impuesto a las Ganancias y C.O.T.I. N° 98765432 en forma simultánea', () => {
    const borrador: BorradorEscritura = {
      titulo: 'Borrador compraventa con COTI e IG',
      cuerpo: [
        'PRIMERO: Comparecencia.',
        'SEGUNDO: Objeto.',
        'TERCERO: Antecedentes.',
        'CUARTO: Precio y forma de pago.',
        'QUINTO: Se deja constancia de la retención del Impuesto a la Transferencia de Inmuebles (ITI) por el 1.5% y se agrega C.O.T.I. N° 98765432, haciéndose constar que no procede Impuesto a las Ganancias.',
        'SEXTO: Otorgamiento.',
      ].join('\n'),
      datos_faltantes: [],
      advertencias: [],
    };

    const res = aplicarGuardrailIti(borrador, '2026-09-10');
    expect(res.cuerpo).toContain(LEYENDA_ITI_DEROGADO);
    expect(res.cuerpo).toContain('C.O.T.I. N° 98765432');
    expect(res.cuerpo).toContain('Impuesto a las Ganancias');
    expect(res.cuerpo).not.toContain('retención del Impuesto a la Transferencia de Inmuebles (ITI)');
    expect(res.cuerpo).toContain('CUARTO: Precio y forma de pago.');
    expect(res.cuerpo).toContain('QUINTO:');
    expect(res.cuerpo).toContain('SEXTO: Otorgamiento.');

    const validacion = validarOrdinalesNotariales(res.cuerpo);
    expect(validacion.ok).toBe(true);
  });

  it('reemplaza la fórmula real autenticada de ITI preservando ordinal, título IMPUESTOS, Ganancias y deberes fiscales (10/09/2026)', () => {
    const borrador: BorradorEscritura = {
      titulo: 'Borrador compraventa fórmula real',
      cuerpo: [
        'PRIMERO: Comparecencia.',
        'SEGUNDO: Objeto.',
        'TERCERO: Antecedentes.',
        'CUARTO: Precio.',
        'QUINTO: Posesión.',
        'SEXTO: Certificados.',
        'SÉPTIMO: IMPUESTOS. Las partes declaran que la presente operación se encuentra alcanzada por el Impuesto a la Transferencia de Inmuebles (I.T.I.) o, en su caso, por el Impuesto a las Ganancias (IG), según corresponda, y se comprometen a cumplir con las obligaciones fiscales pertinentes. [COMPLETAR: Declaración jurada de ITI/IG].',
      ].join('\n'),
      datos_faltantes: ['[COMPLETAR: Declaración jurada de ITI/IG]'],
      advertencias: ['Verificar retención del Impuesto a la Transferencia de Inmuebles (ITI) o Ganancias.'],
    };

    const res = aplicarGuardrailIti(borrador, '2026-09-10');

    // 1. Contener exactamente 1 vez la leyenda de derogación
    expect(res.cuerpo).toContain(LEYENDA_ITI_DEROGADO);
    const conteoLeyenda = res.cuerpo.split(LEYENDA_ITI_DEROGADO).length - 1;
    expect(conteoLeyenda).toBe(1);

    // 2. Conservar Impuesto a las Ganancias (IG) y obligaciones fiscales pertinentes
    expect(res.cuerpo).toContain('Impuesto a las Ganancias (IG)');
    expect(res.cuerpo).toContain('obligaciones fiscales pertinentes');

    // 3. Conservar una referencia profesional pendiente respecto de Ganancias si corresponde
    expect(res.cuerpo).toContain('[COMPLETAR: Declaración jurada de Impuesto a las Ganancias (IG)]');
    expect(res.datos_faltantes.some((d) => d.includes('Impuesto a las Ganancias (IG)'))).toBe(true);

    // 4. Eliminar la retención o aplicación positiva de ITI
    expect(res.cuerpo).not.toContain('se encuentra alcanzada por el Impuesto a la Transferencia de Inmuebles');
    expect(res.cuerpo).not.toContain('retención del Impuesto a la Transferencia de Inmuebles');

    // 5. No producir ITI/IG defectuoso
    expect(res.cuerpo).not.toMatch(/\bITI\/IG\b/);

    // 6. No duplicar placeholders
    const conteoPlaceholder = res.cuerpo.split('[COMPLETAR: Declaración jurada de Impuesto a las Ganancias (IG)]').length - 1;
    expect(conteoPlaceholder).toBe(1);

    // 7. No borrar el ordinal ni el título IMPUESTOS
    expect(res.cuerpo).toMatch(/(?:^|\n)\s*SÉPTIMO:\s*IMPUESTOS\./);

    // 8. Ordinales válidos
    const validacion = validarOrdinalesNotariales(res.cuerpo);
    expect(validacion.ok).toBe(true);
  });

  it('reemplaza variante resulta alcanzada por el I.T.I. preservando íntegramente C.O.T.I. N° 98765432 y Ganancias', () => {
    const borrador: BorradorEscritura = {
      titulo: 'Borrador compraventa con COTI y fórmula resulta alcanzada',
      cuerpo: [
        'PRIMERO: Comparecencia.',
        'SEGUNDO: Objeto.',
        'TERCERO: Antecedentes.',
        'CUARTO: Precio y forma de pago.',
        'QUINTO: Las partes manifiestan que la operación resulta alcanzada por el I.T.I. y se deja constancia de la tramitación del C.O.T.I. N° 98765432, tributando en subsidio Impuesto a las Ganancias.',
        'SEXTO: Otorgamiento.',
      ].join('\n'),
      datos_faltantes: [],
      advertencias: [],
    };

    const res = aplicarGuardrailIti(borrador, '2026-09-10');

    expect(res.cuerpo).toContain(LEYENDA_ITI_DEROGADO);
    expect(res.cuerpo).toContain('C.O.T.I. N° 98765432');
    expect(res.cuerpo).toContain('Impuesto a las Ganancias');
    expect(res.cuerpo).not.toContain('resulta alcanzada por el I.T.I.');

    const validacion = validarOrdinalesNotariales(res.cuerpo);
    expect(validacion.ok).toBe(true);
  });
});

describe('Deduplicación determinística de análisis documental (Último análisis real)', () => {
  it('utiliza exclusivamente el análisis más reciente cuando existen dos document_analysis para el mismo document_id', () => {
    const docId = 'doc-boleto-123';

    // Análisis antiguo con fechas obsoletas
    const analisisAntiguo = {
      id: 'out-old',
      document_id: docId,
      created_at: '2026-05-01T10:00:00Z',
      result_json: {
        tipo_documental_detectado: 'Boleto de compraventa',
        resumen: 'Boleto antiguo preliminar',
        fechas_plazos: [
          { descripcion: 'Fecha del boleto', fecha: '2026-04-01' },
          { descripcion: 'Fecha tentativa de escritura', fecha: '2026-05-30' },
          { descripcion: 'Plazo contractual', fecha: '2026-05-01' },
        ],
      },
    };

    // Análisis nuevo con boleto 10/06, plazo 90 y tentativa 10/09
    const analisisNuevo = {
      id: 'out-new',
      document_id: docId,
      created_at: '2026-06-15T15:00:00Z',
      result_json: {
        tipo_documental_detectado: 'Boleto de compraventa definitivo',
        resumen: 'Boleto final firmado',
        fechas_plazos: [
          { descripcion: 'Fecha del boleto', fecha: '2026-06-10' },
          { descripcion: 'Plazo contractual de 90 días corridos', fecha: '2026-09-08' },
          { descripcion: 'Fecha tentativa de escritura', fecha: '2026-09-10' },
        ],
      },
    };

    // Probamos pasando intencionalmente el antiguo primero o desordenado
    const plazoObtenido = extraerPlazoCanonicoLegajo(
      { id: 'case-test', title: 'Caso Test', metadata: { plazo_dias: 90 } },
      [analisisAntiguo, analisisNuevo],
      []
    );

    expect(plazoObtenido).not.toBeNull();
    expect(plazoObtenido?.fechaBoleto).toBe('10/06/2026');
    expect(plazoObtenido?.fechaLimite).toBe('08/09/2026');
    expect(plazoObtenido?.fechaTentativa).toBe('10/09/2026');
    expect(plazoObtenido?.excesoDias).toBe(2);
    expect(plazoObtenido?.excedePlazo).toBe(true);
  });
});

describe('Filtro no destructivo de discrepancias y alertas en Cotejo', () => {
  it('filtra exclusivamente el conflicto canónico tentativa/límite sin suprimir términos de pago ni vencimientos de certificados', () => {
    const rawTentativa = '2026-09-10';
    const rawLimite = '2026-09-08';
    const fTentativa = formatIsoToAr(rawTentativa);
    const fLimite = formatIsoToAr(rawLimite);
    const dias = 2;
    const diasPlazo = 90;

    const discExacta = `Plazo contractual: la fecha tentativa de escritura (${fTentativa}) supera el límite contractual (${fLimite}) por ${dias} días corridos.`;
    const vigExacta = `La fecha tentativa de escritura (${fTentativa}) excede el plazo máximo de ${diasPlazo} días corridos, cuyo límite es el ${fLimite}.`;

    const discrepanciasOriginales = [
      'Discrepancia en el precio: el boleto indica USD 150.000 y la minuta USD 140.000.',
      'Plazo de pago diferido: el saldo de precio debe integrarse a los 30 días corridos de la firma.',
      'La fecha tentativa de otorgamiento 10/09/2026 excede el plazo contractual límite del 08/09/2026.',
    ];

    const alertasOriginales = [
      'Certificado Catastral con vigencia hasta el 20/10/2026.',
      'Informe de Dominio con vencimiento el 01/11/2026.',
      'Plazo de entrega de la posesión fijado a las 48 horas de la escrituración.',
      'Alerta: la tentativa 10/09/2026 supera el límite contractual establecido.',
    ];

    const parsedTentativa = parsearFechaCualquiera(rawTentativa);
    const parsedLimite = parsearFechaCualquiera(rawLimite);
    const isoTentativa = parsedTentativa?.iso || '';
    const arTentativa = parsedTentativa?.ar || fTentativa;
    const isoLimite = parsedLimite?.iso || '';
    const arLimite = parsedLimite?.ar || fLimite;

    const esMismoConflictoCanonico = (txt: string) => {
      const t = txt.toLowerCase();
      const mencionaTentativa = t.includes('tentativa') || t.includes('estimada') || t.includes('otorgamiento');
      const mencionaLimite =
        t.includes('límite') ||
        t.includes('limite') ||
        t.includes('plazo máximo') ||
        t.includes('plazo maximo') ||
        t.includes('supera') ||
        t.includes('excede');

      const tieneFechaTentativa =
        (arTentativa && t.includes(arTentativa)) ||
        (isoTentativa && t.includes(isoTentativa));

      const tieneFechaLimite =
        (arLimite && t.includes(arLimite)) ||
        (isoLimite && t.includes(isoLimite));

      return mencionaTentativa && mencionaLimite && tieneFechaTentativa && tieneFechaLimite;
    };

    const discFiltradas = discrepanciasOriginales.filter((d) => !esMismoConflictoCanonico(d));
    discFiltradas.unshift(discExacta);

    const vigFiltradas = alertasOriginales.filter((a) => !esMismoConflictoCanonico(a));
    vigFiltradas.unshift(vigExacta);

    // 1. Conflicto canónico estandarizado en primer lugar
    expect(discFiltradas[0]).toBe(discExacta);
    expect(vigFiltradas[0]).toBe(vigExacta);

    // 2. Preservación estricta de plazos de pago y diferencias de precio
    expect(discFiltradas).toContain('Discrepancia en el precio: el boleto indica USD 150.000 y la minuta USD 140.000.');
    expect(discFiltradas).toContain('Plazo de pago diferido: el saldo de precio debe integrarse a los 30 días corridos de la firma.');

    // 3. Preservación estricta de vigencias de certificados y posesión
    expect(vigFiltradas).toContain('Certificado Catastral con vigencia hasta el 20/10/2026.');
    expect(vigFiltradas).toContain('Informe de Dominio con vencimiento el 01/11/2026.');
    expect(vigFiltradas).toContain('Plazo de entrega de la posesión fijado a las 48 horas de la escrituración.');

    // 4. Se eliminó la variante textual informal previa del conflicto canónico (tenía ambas fechas: 10/09 y 08/09)
    expect(discFiltradas).not.toContain('La fecha tentativa de otorgamiento 10/09/2026 excede el plazo contractual límite del 08/09/2026.');
  });

  it('preserva mensajes independientes con fecha no canónica (p. ej. tentativa 10/09 y límite de pago diferido 20/09)', () => {
    const rawTentativa = '2026-09-10';
    const rawLimite = '2026-09-08';
    const parsedTentativa = parsearFechaCualquiera(rawTentativa);
    const parsedLimite = parsearFechaCualquiera(rawLimite);
    const isoTentativa = parsedTentativa?.iso || '';
    const arTentativa = parsedTentativa?.ar || '10/09/2026';
    const isoLimite = parsedLimite?.iso || '';
    const arLimite = parsedLimite?.ar || '08/09/2026';

    const esMismoConflictoCanonico = (txt: string) => {
      const t = txt.toLowerCase();
      const mencionaTentativa = t.includes('tentativa') || t.includes('estimada') || t.includes('otorgamiento');
      const mencionaLimite =
        t.includes('límite') ||
        t.includes('limite') ||
        t.includes('plazo máximo') ||
        t.includes('plazo maximo') ||
        t.includes('supera') ||
        t.includes('excede');

      const tieneFechaTentativa =
        (arTentativa && t.includes(arTentativa)) ||
        (isoTentativa && t.includes(isoTentativa));

      const tieneFechaLimite =
        (arLimite && t.includes(arLimite)) ||
        (isoLimite && t.includes(isoLimite));

      return mencionaTentativa && mencionaLimite && tieneFechaTentativa && tieneFechaLimite;
    };

    const mensajeIndependiente = 'La fecha tentativa de firma es 10/09/2026 y el límite del pago diferido es 20/09/2026.';

    // No debe considerarse duplicado porque 20/09 no es la fecha límite canónica 08/09/2026
    expect(esMismoConflictoCanonico(mensajeIndependiente)).toBe(false);

    const lista = [mensajeIndependiente];
    const filtrada = lista.filter((m) => !esMismoConflictoCanonico(m));
    expect(filtrada).toContain(mensajeIndependiente);
  });
});

describe('Extracción canónica con payload real sin metadata presembrada', () => {
  it('extrae 10/06, 90d, límite 08/09, tentativa 10/09 y exceso 2d desde payload real sin metadata temporal', () => {
    const caseRecord = {
      id: 'case-palermo-real',
      title: 'Compraventa Depto Palermo Cuba',
      metadata: {
        tipo_acto: 'Compraventa',
      },
    };

    const aiOutputs = [
      {
        created_at: '2026-09-06T10:00:00Z',
        document_id: 'doc-boleto-1',
        output_type: 'document_analysis',
        result_json: {
          tipo_documental_detectado: 'Boleto de compraventa',
          datos_clave: [
            'Plazo máximo contractual para escriturar: 90 días corridos.',
            'USD 150.000',
          ],
          fechas_plazos: [
            { descripcion: 'Fecha de emisión del Boleto de Compraventa', fecha: '2026-06-10' },
            { descripcion: 'Fecha tentativa de escritura', fecha: '2026-09-10' },
          ],
        },
      },
    ];

    const plazo = extraerPlazoCanonicoLegajo(caseRecord, aiOutputs, []);
    expect(plazo).not.toBeNull();
    expect(plazo?.fechaBoleto).toBe('10/06/2026');
    expect(plazo?.plazoDias).toBe(90);
    expect(plazo?.fechaLimite).toBe('08/09/2026');
    expect(plazo?.fechaTentativa).toBe('10/09/2026');
    expect(plazo?.excesoDias).toBe(2);
    expect(plazo?.excedePlazo).toBe(true);
  });

  it('reconoce semánticamente todas las variantes válidas de fecha de boleto', () => {
    const variantes = [
      'Fecha de emisión del Boleto de Compraventa',
      'Fecha de emisión del boleto',
      'Fecha de firma del boleto',
      'Fecha de celebración del boleto',
      'Fecha de suscripción del boleto',
      'Fecha del Boleto de Compraventa',
      'Boleto de Compraventa emitido el 10 de junio de 2026',
      'Boleto de Compraventa firmado el 10/06/2026',
    ];

    for (const desc of variantes) {
      const caseRecord = { id: 'c1', metadata: { tipo_acto: 'Compraventa' } };
      const aiOutputs = [
        {
          created_at: '2026-09-06T10:00:00Z',
          document_id: 'doc-var',
          output_type: 'document_analysis',
          result_json: {
            datos_clave: ['90 días corridos'],
            fechas_plazos: [
              { descripcion: desc, fecha: '2026-06-10' },
              { descripcion: 'Fecha tentativa de escritura', fecha: '2026-09-10' },
            ],
          },
        },
      ];
      const plazo = extraerPlazoCanonicoLegajo(caseRecord, aiOutputs, []);
      expect(plazo?.fechaBoleto).toBe('10/06/2026');
      expect(plazo?.fechaLimite).toBe('08/09/2026');
      expect(plazo?.excesoDias).toBe(2);
    }
  });
});

describe('Ordinales notariales femeninos y preservación de encabezados romanos', () => {
  it('detecta estilo femenino, preserva encabezados romanos de comparecientes y asigna ordinal a cláusula UIF', () => {
    const borrador: BorradorEscritura = {
      titulo: 'Borrador femenino',
      cuerpo: [
        'I.- COMPARECIENTES: Don Juan Pérez por una parte y Doña María Gómez por la otra.',
        'II.- INTERVENCIÓN: Actúan en nombre propio.',
        'PRIMERA: ANTECEDENTES DE DOMINIO.',
        'SEGUNDA: OBJETO.',
        'TERCERA: PRECIO Y FORMA DE PAGO. Se abona en efectivo el precio pactado de fondos lícitos declarados.',
        'QUINTA: ESTADO DE OCUPACIÓN Y ENTREGA DE POSESIÓN.',
        'SEXTA: CERTIFICADOS.',
        'SÉPTIMA: GASTOS E IMPUESTOS.',
        'OCTAVA: DECLARACIONES JURADAS.',
      ].join('\n'),
      datos_faltantes: [],
      advertencias: [],
    };

    // Sin evidencia de fondos: debe insertar la cláusula UIF y recalcular ordinales en femenino
    const conUif = aplicarGuardrailOrigenFondos(borrador, false);

    // 1. Debe conservar estilo femenino
    expect(conUif.cuerpo).toContain('PRIMERA: ANTECEDENTES DE DOMINIO.');
    expect(conUif.cuerpo).toContain('SEGUNDA: OBJETO.');
    expect(conUif.cuerpo).toContain('TERCERA: PRECIO Y FORMA DE PAGO.');
    expect(conUif.cuerpo).toMatch(/(?:^|\n)\s*CUARTA:\s*MEDIOS DE PAGO Y ORIGEN DE FONDOS\./);
    expect(conUif.cuerpo).toContain('QUINTA: ESTADO DE OCUPACIÓN Y ENTREGA DE POSESIÓN.');
    expect(conUif.cuerpo).toContain('SEXTA: CERTIFICADOS.');
    expect(conUif.cuerpo).toContain('SÉPTIMA: GASTOS E IMPUESTOS.');
    expect(conUif.cuerpo).toContain('OCTAVA: DECLARACIONES JURADAS.');

    // 2. Encabezados romanos intactos
    expect(conUif.cuerpo).toContain('I.- COMPARECIENTES:');
    expect(conUif.cuerpo).toContain('II.- INTERVENCIÓN:');

    // 3. Ninguna cláusula sin ordinal ni "CLAUSULA:" residual
    expect(conUif.cuerpo).not.toMatch(/\bCLAUSULA:/);

    // 4. Validación estricta sin duplicados
    const validacion = validarOrdinalesNotariales(conUif.cuerpo);
    expect(validacion.ok).toBe(true);
    expect(validacion.duplicados).toHaveLength(0);
  });
});

describe('Sanitización de ITI en placeholders y prueba integral con texto real', () => {
  it('sanea la fórmula real observada en SÉPTIMA: GASTOS E IMPUESTOS con fecha 10/09/2026', () => {
    const cuerpoObservado = [
      'PRIMERA: ANTECEDENTES DE DOMINIO.',
      'SEGUNDA: OBJETO.',
      'TERCERA: PRECIO Y FORMA DE PAGO.',
      'CUARTA: MEDIOS DE PAGO Y ORIGEN DE FONDOS. [COMPLETAR/VERIFICAR: declaración y documentación respaldatoria sobre medios y origen de fondos].',
      'QUINTA: ESTADO DE OCUPACIÓN Y ENTREGA DE POSESIÓN.',
      'SEXTA: CERTIFICADOS.',
      'SÉPTIMA: GASTOS E IMPUESTOS. [COMPLETAR: cláusula de gastos, ej: Los gastos e impuestos que demande la presente escritura, así como los honorarios notariales, serán a cargo de la parte compradora, con excepción del Impuesto a la Transferencia de Inmuebles (ITI) o Impuesto a las Ganancias que corresponda, que será a cargo de la parte vendedora]. [COMPLETAR: Declaración jurada ITI/Impuesto a las Ganancias].',
      'OCTAVA: DECLARACIONES JURADAS.',
    ].join('\n');

    const borrador: BorradorEscritura = {
      titulo: 'Borrador real observado',
      cuerpo: cuerpoObservado,
      datos_faltantes: [
        '[COMPLETAR: Declaración jurada ITI/Impuesto a las Ganancias]',
      ],
      advertencias: [
        'Verificar retención del Impuesto a la Transferencia de Inmuebles (ITI) o Impuesto a las Ganancias.',
      ],
    };

    const res = aplicarGuardrailIti(borrador, '2026-09-10');

    // 1. Conservar SÉPTIMA: GASTOS E IMPUESTOS
    expect(res.cuerpo).toMatch(/(?:^|\n)\s*SÉPTIMA:\s*GASTOS E IMPUESTOS\./);

    // 2. Conservar la asignación de gastos
    expect(res.cuerpo).toContain('Los gastos e impuestos que demande la presente escritura');
    expect(res.cuerpo).toContain('serán a cargo de la parte compradora');
    expect(res.cuerpo).toContain('que será a cargo de la parte vendedora');

    // 3. Conservar Ganancias
    expect(res.cuerpo).toContain('con excepción del Impuesto a las Ganancias que corresponda');
    expect(res.cuerpo).toContain('[COMPLETAR: Declaración jurada de Impuesto a las Ganancias]');

    // 4. Eliminar la alternativa ITI del placeholder y del texto
    expect(res.cuerpo).not.toContain('con excepción del Impuesto a la Transferencia de Inmuebles (ITI)');
    expect(res.cuerpo).not.toContain('Impuesto a la Transferencia de Inmuebles (ITI) o');

    // 5. Producir una única leyenda ITI derogado
    expect(res.cuerpo).toContain(LEYENDA_ITI_DEROGADO);
    const conteoLeyenda = res.cuerpo.split(LEYENDA_ITI_DEROGADO).length - 1;
    expect(conteoLeyenda).toBe(1);

    // 6. No dejar ITI/IG ni fórmulas positivas
    expect(res.cuerpo).not.toMatch(/\bITI\/IG\b/);
    expect(res.cuerpo).not.toMatch(/\bITI\/Impuesto\b/);

    // 7. No duplicar placeholders
    const conteoMarcadorJurada = res.cuerpo.split('[COMPLETAR: Declaración jurada de Impuesto a las Ganancias]').length - 1;
    expect(conteoMarcadorJurada).toBe(1);

    // 8. Validación de ordinales notariales femeninos
    const validacion = validarOrdinalesNotariales(res.cuerpo);
    expect(validacion.ok).toBe(true);
    expect(validacion.duplicados).toHaveLength(0);
  });

  describe('Sanitización Fail-Closed de Citas Normativas Tributarias', () => {
    it('preserva las leyes en allowlist (Ley 27.743 y Ley 25.246)', () => {
      const texto = 'Conforme Ley 27.743 se deroga el ITI y por Ley 25.246 rige UIF.';
      const res = sanearCitasNormativasTributarias(texto);
      expect(res).toBe('Conforme Ley 27.743 se deroga el ITI y por Ley 25.246 rige UIF.');
    });

    it('reemplaza leyes no verificadas como Ley 23.282 y Ley 25.093 por [VERIFICAR: normativa tributaria aplicable]', () => {
      const t1 = 'Las partes declaran tributar conforme Ley 23.282 y Ley 25.093.';
      const r1 = sanearCitasNormativasTributarias(t1);
      expect(r1).not.toContain('23.282');
      expect(r1).not.toContain('25.093');
      expect(r1).toContain('[VERIFICAR: normativa tributaria aplicable]');

      const t2 = 'Retención conforme Ley 23.282 / 25.093 sobre la operación.';
      const r2 = sanearCitasNormativasTributarias(t2);
      expect(r2).not.toContain('23.282');
      expect(r2).not.toContain('25.093');
      expect(r2).toBe('Retención conforme [VERIFICAR: normativa tributaria aplicable] sobre la operación.');
    });

    it('aplicarGuardrailIti sanitiza citas no verificadas e incorpora datos faltantes y advertencia', () => {
      const borrador: BorradorEscritura = {
        titulo: 'Borrador con citas no verificadas',
        cuerpo: 'SÉPTIMA: IMPUESTOS. La presente operación tributa según Ley 23.282 y Ley 25.093.',
        datos_faltantes: [],
        advertencias: [],
      };

      const res = aplicarGuardrailIti(borrador, '2026-09-10');
      expect(res.cuerpo).not.toContain('23.282');
      expect(res.cuerpo).not.toContain('25.093');
      expect(res.cuerpo).toContain('[VERIFICAR: normativa tributaria aplicable]');
      expect(res.datos_faltantes).toContain('[VERIFICAR: normativa tributaria aplicable]');
      expect(res.advertencias.some((a) => a.includes('normativa tributaria aplicable'))).toBe(true);
    });
  });

  describe('Cargador Canónico de Hechos Temporales (extraerHechosTemporalesLegajo)', () => {
    it('extrae hechos temporales completos desde case_summary (Palermo Cuba) con document_analysis vacío', () => {
      const input = {
        caseRecord: {
          id: 'b590d5e1-df13-4c53-8a6c-863d9e806075',
          title: 'QA Escritura Compraventa Palermo Cuba',
          metadata: { tipo_acto: 'Compraventa' },
        },
        aiOutputs: [
          // document_analysis legacy sin fechas_plazos
          {
            output_type: 'document_analysis',
            result_json: { resumen: 'Boleto de compraventa Palermo Cuba' },
          },
          // case_summary con puntos_clave y riesgos_alertas reales
          {
            output_type: 'case_summary',
            result_json: {
              puntos_clave: [
                'Fecha de emisión del Boleto de Compraventa: 10 de junio de 2026.',
                'Plazo máximo contractual para escriturar: 8 de septiembre de 2026.',
                'Fecha tentativa de escritura: 10 de septiembre de 2026.',
              ],
              riesgos_alertas: [
                'La fecha tentativa supera el plazo contractual por 2 días corridos.',
              ],
            },
          },
        ],
      };

      const hechos = extraerHechosTemporalesLegajo(input);

      expect(hechos.fechaBoleto).toBe('10/06/2026');
      expect(hechos.fechaBoletoIso).toBe('2026-06-10');
      expect(hechos.fechaLimite).toBe('08/09/2026');
      expect(hechos.fechaLimiteIso).toBe('2026-09-08');
      expect(hechos.fechaTentativa).toBe('10/09/2026');
      expect(hechos.fechaTentativaIso).toBe('2026-09-10');
      expect(hechos.plazoDias).toBe(90);
      expect(hechos.excedePlazo).toBe(true);
      expect(hechos.excesoDias).toBe(2);
      expect(hechos.fuentes.length).toBeGreaterThan(0);
      expect(hechos.fuentes.some((f) => f.tipo === 'case_summary')).toBe(true);
    });

    it('soporta hechos parciales: tentativa aislada sin boleto ni plazo no devuelve null', () => {
      const input = {
        caseRecord: {
          id: 'caso-parcial',
          title: 'Legajo con solo fecha tentativa',
          metadata: { fecha_tentativa: '2026-09-10' },
        },
        aiOutputs: [],
      };

      const hechos = extraerHechosTemporalesLegajo(input);
      expect(hechos.fechaTentativa).toBe('10/09/2026');
      expect(hechos.fechaTentativaIso).toBe('2026-09-10');
      expect(hechos.fechaBoleto).toBeUndefined();
      expect(hechos.fechaLimite).toBeUndefined();
      expect(hechos.excedePlazo).toBe(false);
    });

    it('detecta conflicto entre fecha límite explícita y calculada con trazabilidad', () => {
      const input = {
        caseRecord: {
          metadata: {
            fecha_boleto: '2026-06-10',
            plazo_dias: 90, // calculada: 2026-09-08
            fecha_limite: '2026-09-15', // explícita contradictoria
          },
        },
        aiOutputs: [],
      };

      const hechos = extraerHechosTemporalesLegajo(input);
      // Prioriza cálculo determinístico
      expect(hechos.fechaLimite).toBe('08/09/2026');
      expect(hechos.conflictos.length).toBe(1);
      expect(hechos.conflictos[0].campo).toBe('fechaLimite');
      expect(hechos.conflictos[0].valorCalculado).toBe('08/09/2026');
      expect(hechos.conflictos[0].valorEncontrado).toBe('15/09/2026');
    });

    it('no inventa plazo de 90 días cuando solo existen fecha límite y fecha tentativa', () => {
      const input = {
        caseRecord: {
          id: 'caso-sin-boleto',
          metadata: {
            fecha_limite: '2026-09-08',
            fecha_tentativa: '2026-09-10',
          },
        },
        aiOutputs: [],
      };

      const hechos = extraerHechosTemporalesLegajo(input);
      expect(hechos.fechaLimite).toBe('08/09/2026');
      expect(hechos.fechaTentativa).toBe('10/09/2026');
      expect(hechos.fechaBoleto).toBeUndefined();
      expect(hechos.plazoDias).toBeUndefined();
      expect(hechos.excedePlazo).toBe(true);
      expect(hechos.excesoDias).toBe(2);
      expect(hechos.advertencia).toBe(
        'La fecha tentativa de escritura (10/09/2026) supera el límite contractual (08/09/2026).'
      );
      expect(hechos.advertencia).not.toContain('90');

      const plazoCanonico = extraerPlazoCanonicoLegajo(input.caseRecord, input.aiOutputs, []);
      expect(plazoCanonico).not.toBeNull();
      expect(plazoCanonico?.plazoDias).toBeUndefined();
      expect(plazoCanonico?.excesoDias).toBe(2);
      expect(plazoCanonico?.advertencia).not.toContain('90');
    });

    it('aplica precedencia y deduplicación: case_summary no desplaza document_analysis y registra conflicto', () => {
      const input = {
        caseRecord: { id: 'caso-dedup', metadata: {} },
        aiOutputs: [
          // case_summary más reciente en timestamp
          {
            output_type: 'case_summary',
            created_at: '2026-09-07T12:00:00Z',
            result_json: {
              puntos_clave: [
                'Fecha de emisión del Boleto de Compraventa: 01 de enero de 2026.',
                'Fecha límite contractual: 01 de abril de 2026.',
              ],
            },
          },
          // document_analysis estructurado (más antiguo que case_summary)
          {
            document_id: 'doc-boleto-1',
            output_type: 'document_analysis',
            created_at: '2026-09-07T10:00:00Z',
            result_json: {
              fechas_plazos: [
                { descripcion: 'Fecha de emisión del Boleto de Compraventa', fecha: '2026-06-10' },
                { descripcion: 'Fecha límite contractual', fecha: '2026-09-08' },
              ],
            },
          },
          // document_analysis anterior del MISMO documento (debe ser ignorado por deduplicación)
          {
            document_id: 'doc-boleto-1',
            output_type: 'document_analysis',
            created_at: '2026-09-07T08:00:00Z',
            result_json: {
              fechas_plazos: [
                { descripcion: 'Fecha de emisión del Boleto de Compraventa', fecha: '2025-01-01' },
              ],
            },
          },
        ],
      };

      const hechos = extraerHechosTemporalesLegajo(input);

      // document_analysis tiene precedencia sobre case_summary
      expect(hechos.fechaBoleto).toBe('10/06/2026');
      expect(hechos.fechaLimite).toBe('08/09/2026');
      expect(hechos.plazoDias).toBe(90); // 10/06 al 08/09 = 90 días

      // Se registra el intento divergente de case_summary en conflictos
      expect(hechos.conflictos.length).toBeGreaterThanOrEqual(1);
      const conflictoBoleto = hechos.conflictos.find((c) => c.campo === 'fechaBoleto');
      expect(conflictoBoleto).toBeDefined();
      expect(conflictoBoleto?.valorCalculado).toBe('10/06/2026');
      expect(conflictoBoleto?.valorEncontrado).toBe('01/01/2026');
    });
  });

  describe('Microfix Preventivo: Guardrail Tributario Restringido a Contexto Tributario', () => {
    it('preserva cláusulas no tributarias con Ley 17.801 y Ley 26.994 de forma intacta', () => {
      const c1 = 'Conforme Ley 17.801 se practica la inscripción registral.';
      expect(sanearCitasNormativasTributarias(c1)).toBe(c1);

      const c2 = 'Conforme Ley 26.994 se aplican las disposiciones civiles correspondientes.';
      expect(sanearCitasNormativasTributarias(c2)).toBe(c2);

      const c3 = 'Se autoriza la protocolización registral según Ley N° 17.801 y Código Civil y Comercial.';
      expect(sanearCitasNormativasTributarias(c3)).toBe(c3);
    });

    it('sanitiza Ley 27.743 fuera del contexto de ITI a [VERIFICAR: normativa aplicable]', () => {
      const c1 = 'La inscripción registral se rige por Ley 27.743.';
      const r1 = sanearCitasNormativasTributarias(c1);
      expect(r1).toBe('La inscripción registral se rige por [VERIFICAR: normativa aplicable].');
      expect(r1).not.toContain('27.743');

      // En contexto ITI se preserva
      const c2 = 'Conforme Ley 27.743 se declara la derogación del Impuesto a la Transferencia de Inmuebles.';
      expect(sanearCitasNormativasTributarias(c2)).toBe(c2);
    });

    it('sanitiza Ley 25.246 invocada para impuestos o fuera de UIF a [VERIFICAR: normativa tributaria aplicable]', () => {
      const c1 = 'La operación tributa conforme Ley 25.246.';
      const r1 = sanearCitasNormativasTributarias(c1);
      expect(r1).toBe('La operación tributa conforme [VERIFICAR: normativa tributaria aplicable].');
      expect(r1).not.toContain('25.246');

      // En contexto UIF se preserva
      const c2 = 'En cumplimiento de la Ley 25.246 y disposiciones de la UIF se deja constancia.';
      expect(sanearCitasNormativasTributarias(c2)).toBe(c2);
    });

    it('procesa párrafos mixtos saneando solo la cláusula tributaria', () => {
      const parrafo =
        'Conforme Ley 17.801 se practica la inscripción registral. En materia de retención fiscal, se aplica la Ley 23.282.';
      const res = sanearCitasNormativasTributarias(parrafo);

      expect(res).toContain('Conforme Ley 17.801 se practica la inscripción registral.');
      expect(res).not.toContain('23.282');
      expect(res).toContain('[VERIFICAR: normativa tributaria aplicable]');
    });
  });
});
