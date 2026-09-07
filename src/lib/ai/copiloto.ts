import 'server-only';

export type ResumenExpediente = {
  resumen_general: string;
  estado_actual: string;
  partes: string[];
  puntos_clave: string[];
  riesgos_alertas: string[];
  proximas_acciones: string[];
};

type DocInput = { nombre: string; tipo: string; resumen: string; alertas: string[]; datos: string[] };
type EventoInput = { fecha: string; tipo: string; titulo: string; descripcion: string };

export function sanitizarTerminologiaEscribania(texto: string): string {
  return texto
    .replace(/^El presente expediente\b/gi, 'El presente legajo')
    .replace(/\bel presente expediente\b/gi, 'el presente legajo')
    .replace(/\beste expediente\b/gi, 'este legajo')
    .replace(/\bdel expediente\b/gi, 'del legajo')
    .replace(/\bal expediente\b/gi, 'al legajo')
    .replace(/\bel expediente\b/gi, 'el legajo')
    .replace(/\ben el expediente\b/gi, 'en el legajo')
    .replace(/\betapa procesal\b/gi, 'etapa notarial')
    .replace(/\briesgo procesal\b/gi, 'observación notarial');
}

import {
  analizarPlazoBoletoEscritura,
  parsearFechaCualquiera,
  formatIsoToAr,
  type PlazoCanonicoLegajo,
} from '@/lib/plazos/fechasCanonicas';

function detectarDatosBoleto(documentos: DocInput[], eventos: EventoInput[]): {
  fechaBoleto?: string;
  plazoDias?: number;
  fechaTentativa?: string;
} {
  const allText = [
    ...documentos.flatMap((d) => [d.nombre, d.tipo, d.resumen, ...d.alertas, ...d.datos]),
    ...eventos.flatMap((e) => [e.fecha, e.tipo, e.titulo, e.descripcion]),
  ].join(' ');

  let fechaBoleto: string | undefined;
  let plazoDias: number | undefined;
  let fechaTentativa: string | undefined;

  const mBoleto =
    allText.match(/(?:boleto|compraventa)[^\d]{1,60}?(\d{1,2}\s+de\s+[a-z]+\s+del?\s+\d{4})/i) ||
    allText.match(/(?:boleto|compraventa)[^\d]{1,60}?(\d{4}-\d{2}-\d{2})/i) ||
    allText.match(/(?:boleto|compraventa)[^\d]{1,60}?(\d{2}\/\d{2}\/\d{4})/i);
  if (mBoleto) {
    const p = parsearFechaCualquiera(mBoleto[1]);
    if (p) fechaBoleto = p.iso;
  }

  const mPlazo =
    allText.match(/(\d{1,3})\s*d[ií]as\s+corridos/i) ||
    allText.match(/plazo\s+(?:contractual\s+)?(?:de\s+)?(\d{1,3})\s*d[ií]as/i);
  if (mPlazo) {
    const p = parseInt(mPlazo[1], 10);
    if (!Number.isNaN(p) && p > 0) plazoDias = p;
  }

  const mTentativa =
    allText.match(/(?:tentativa|estimada|escrituraci[oó]n)[^\d]{1,60}?(\d{1,2}\s+de\s+[a-z]+\s+del?\s+\d{4})/i) ||
    allText.match(/(?:tentativa|estimada|escrituraci[oó]n)[^\d]{1,60}?(\d{4}-\d{2}-\d{2})/i) ||
    allText.match(/(?:tentativa|estimada|escrituraci[oó]n)[^\d]{1,60}?(\d{2}\/\d{2}\/\d{4})/i);
  if (mTentativa) {
    const p = parsearFechaCualquiera(mTentativa[1]);
    if (p) fechaTentativa = p.iso;
  }

  return { fechaBoleto, plazoDias, fechaTentativa };
}

export async function generarResumenConIA(input: {
  titulo: string; cliente: string; tipo: string; estado: string;
  industria?: string;
  documentos: DocInput[]; eventos: EventoInput[];
  plazoCanonico?: PlazoCanonicoLegajo | null;
}): Promise<
  | { ok: false; motivo: 'sin_api_key' | 'sin_datos' | 'error' }
  | { ok: true; resumen: ResumenExpediente; model: string }
> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, motivo: 'sin_api_key' };
  if (input.documentos.length === 0 && input.eventos.length === 0) return { ok: false, motivo: 'sin_datos' };

  const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const docsTexto = input.documentos.map((d, i) =>
    `Documento ${i + 1}: ${d.nombre} (${d.tipo})\nResumen: ${d.resumen}\nDatos clave: ${d.datos.join('; ') || '-'}\nAlertas: ${d.alertas.join('; ') || '-'}`
  ).join('\n\n');

  const eventosTexto = input.eventos.map((e) =>
    `- ${e.fecha} [${e.tipo}] ${e.titulo}${e.descripcion ? ': ' + e.descripcion : ''}`
  ).join('\n');

  const introPorRubro =
    input.industria === 'escribania'
      ? 'Sos un escribano argentino. En base a los documentos ya analizados y las actuaciones de un legajo notarial, redactá un RESUMEN EJECUTIVO del trámite, claro y profesional, para entender su estado de un vistazo. TERMINOLOGÍA: PROHIBIDO utilizar la palabra "expediente". Utilizá "legajo", "acto", "instrumento" u "operación notarial" según el contexto.'
      : input.industria === 'inmobiliaria'
      ? 'Sos un asesor inmobiliario argentino. En base a los documentos ya analizados y los movimientos de una operación (compraventa, alquiler o reserva), redactá un RESUMEN EJECUTIVO de la operación, claro y profesional, para entender su estado de un vistazo.'
      : 'Sos un abogado senior argentino. En base a los documentos ya analizados y las actuaciones de un expediente, redactá un RESUMEN EJECUTIVO del caso completo, claro y profesional, para entender el estado del asunto de un vistazo.';

  const headerPorRubro =
    input.industria === 'escribania'
      ? `LEGAJO NOTARIAL: ${input.titulo}\nCliente / Solicitante: ${input.cliente || '-'} | Tipo de acto: ${input.tipo || '-'} | Estado: ${input.estado || '-'}`
      : input.industria === 'inmobiliaria'
      ? `OPERACIÓN: ${input.titulo}\nCliente: ${input.cliente || '-'} | Tipo: ${input.tipo || '-'} | Estado: ${input.estado || '-'}`
      : `EXPEDIENTE: ${input.titulo}\nCliente: ${input.cliente || '-'} | Tipo: ${input.tipo || '-'} | Estado: ${input.estado || '-'}`;

  const jsonTemplate =
    input.industria === 'escribania'
      ? [
          '{',
          '  "resumen_general": "2-4 oraciones sobre de qué se trata el legajo y su situación (NUNCA comiences con \\"El presente expediente\\"; referite al legajo o al acto)",',
          '  "estado_actual": "una oración sobre en qué etapa notarial se encuentra el trámite",',
          '  "partes": ["cada compareciente/otorgante y su rol notarial"],',
          '  "puntos_clave": ["inmueble, montos, fechas clave de boleto y escrituración"],',
          '  "riesgos_alertas": ["plazos contractuales, vigencia de certificados o inconsistencias a vigilar (si la fecha tentativa de firma excede el plazo contractual de días corridos, señalar los días exactos de exceso)"],',
          '  "proximas_acciones": ["trámites notariales concretos sugeridos para el escribano"]',
          '}',
        ].join('\n')
      : [
          '{',
          '  "resumen_general": "2-4 oraciones sobre de qué se trata el expediente y su situación",',
          '  "estado_actual": "una oración sobre en qué etapa procesal está",',
          '  "partes": ["cada parte y su rol"],',
          '  "puntos_clave": ["hechos, montos, fechas y datos determinantes"],',
          '  "riesgos_alertas": ["riesgos, plazos críticos o inconsistencias a vigilar"],',
          '  "proximas_acciones": ["acciones concretas sugeridas para el profesional a cargo"]',
          '}',
        ].join('\n');

  const prompt = [
    introPorRubro,
    'Respondé SOLO un objeto JSON válido (sin texto adicional) con esta forma exacta:',
    jsonTemplate,
    'Reglas: NO inventes datos, montos, fechas ni artículos. Si algo no surge de la información, devolvé un array vacío. Basate SOLO en lo aportado.',
    '',
    headerPorRubro,
    '',
    'DOCUMENTOS ANALIZADOS:',
    docsTexto || '(sin documentos analizados)',
    '',
    'ACTUACIONES / LÍNEA DE TIEMPO:',
    eventosTexto || '(sin actuaciones registradas)',
  ].join('\n');

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
        }),
      }
    );
    if (!resp.ok) { console.error('Copiloto Gemini error:', resp.status, await resp.text()); return { ok: false, motivo: 'error' }; }
    const data = await resp.json();
    const raw: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    if (!raw.trim()) return { ok: false, motivo: 'error' };
    const parsed = JSON.parse(raw);
    const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);

    let resumenGeneral = String(parsed.resumen_general ?? '');
    let estadoActual = String(parsed.estado_actual ?? '');
    let partes = arr(parsed.partes);
    let puntosClave = arr(parsed.puntos_clave);
    let riesgosAlertas = arr(parsed.riesgos_alertas);
    let proximasAcciones = arr(parsed.proximas_acciones);

    if (input.industria === 'escribania') {
      resumenGeneral = sanitizarTerminologiaEscribania(resumenGeneral);
      estadoActual = sanitizarTerminologiaEscribania(estadoActual);
      partes = partes.map(sanitizarTerminologiaEscribania);
      puntosClave = puntosClave.map(sanitizarTerminologiaEscribania);
      riesgosAlertas = riesgosAlertas.map(sanitizarTerminologiaEscribania);
      proximasAcciones = proximasAcciones.map(sanitizarTerminologiaEscribania);

      // Verificación determinística de plazo contractual de boleto vs fecha tentativa de escritura
      let analisis: any = input.plazoCanonico;
      if (!analisis) {
        const datosBoleto = detectarDatosBoleto(input.documentos, input.eventos);
        if (datosBoleto.fechaBoleto && datosBoleto.plazoDias && datosBoleto.fechaTentativa) {
          analisis = analizarPlazoBoletoEscritura(
            datosBoleto.fechaBoleto,
            datosBoleto.plazoDias,
            datosBoleto.fechaTentativa
          );
        }
      }

      if (analisis && (analisis.excedePlazo || analisis.excesoDias > 0 || analisis.diasExceso > 0)) {
        const fTentativa = analisis.fechaTentativa || analisis.fechaTentativaAr;
        const fLimite = analisis.fechaLimite || analisis.fechaLimiteAr;
        const dias = analisis.excesoDias ?? analisis.diasExceso ?? 2;
        const plazoDias = analisis.plazoDias ?? 90;

        const adv = analisis.advertencia || `La fecha tentativa de escrituración (${fTentativa}) excede el plazo contractual de ${plazoDias} días corridos (límite: ${fLimite}) por ${dias} día${dias === 1 ? '' : 's'} corridos.`;
        const yaTieneAlerta = riesgosAlertas.some((r) => r.toLowerCase().includes('excede'));
        if (!yaTieneAlerta) {
          riesgosAlertas.unshift(adv);
        }
        if (!resumenGeneral.toLowerCase().includes('excede')) {
          resumenGeneral += ` Se advierte que la fecha tentativa de escrituración (${fTentativa}) excede el plazo contractual de ${plazoDias} días corridos (límite: ${fLimite}) por ${dias} día${dias === 1 ? '' : 's'} corridos.`;
        }
      }
    }

    return {
      ok: true, model: `copiloto-${modelo}`,
      resumen: {
        resumen_general: resumenGeneral,
        estado_actual: estadoActual,
        partes,
        puntos_clave: puntosClave,
        riesgos_alertas: riesgosAlertas,
        proximas_acciones: proximasAcciones,
      },
    };
  } catch (e) { console.error('Copiloto parse error:', e); return { ok: false, motivo: 'error' }; }
}

export type CotejoNotarial = {
  veredicto: string;
  coincidencias: string[];
  discrepancias: string[];
  faltantes: string[];
  alertas_vigencia: string[];
};

export async function cotejarDocumentosConIA(input: {
  titulo: string;
  tipo: string;
  industria?: string;
  documentos: DocInput[];
  plazoCanonico?: PlazoCanonicoLegajo | null;
}): Promise<
  | { ok: false; motivo: 'sin_api_key' | 'sin_datos' | 'error' }
  | { ok: true; cotejo: CotejoNotarial; model: string }
> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, motivo: 'sin_api_key' };
  if (input.documentos.length < 1) return { ok: false, motivo: 'sin_datos' };

  const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const docsTexto = input.documentos
    .map(
      (d, i) =>
        `Documento ${i + 1}: ${d.nombre} (${d.tipo})\nResumen: ${d.resumen}\nDatos clave: ${d.datos.join('; ') || '-'}\nAlertas: ${d.alertas.join('; ') || '-'}`
    )
    .join('\n\n');

  const esLegal = input.industria === 'legal';

  const promptNotarial = [
    'Sos un escribano argentino experto en estudio de títulos y control de documentación registral. Vas a COTEJAR (cruzar) los documentos ya analizados de un mismo legajo para verificar si son coherentes entre sí antes de otorgar un acto.',
    'Compará especialmente: identidad y datos de las partes/comparecientes (nombres, DNI/CUIT), datos del inmueble (nomenclatura catastral, matrícula, superficie, ubicación), montos y precios, y vigencia de certificados (dominio, inhibiciones, libre deuda). Evaluá rigurosamente la validez temporal usando las fechas de vencimiento aportadas ("Vencimiento registrado en sistema") y las fechas extraídas. Recordá que certificados de dominio/inhibiciones suelen vencer a los 15, 30 o 90 días (según jurisdicción).',
    'Respondé SOLO un objeto JSON válido (sin texto adicional) con esta forma exacta:',
    '{',
    ' "veredicto": "1-2 oraciones con el estado general del cotejo (coherente / con observaciones / con discrepancias serias)",',
    ' "coincidencias": ["datos que coinciden correctamente entre documentos"],',
    ' "discrepancias": ["diferencias o contradicciones entre documentos, indicando qué documento y qué dato"],',
    ' "faltantes": ["documentos o datos que faltarían para completar el acto"],',
    ' "alertas_vigencia": ["certificados vencidos, próximos a vencer o vigentes (incluyendo SIEMPRE explícitamente la vigencia de inhibiciones, dominio y catastral con su fecha exacta, ej: 01/11/2026)"]',
    '}',
    'Reglas: NO inventes datos. Si algo no surge de la información aportada, devolvé un array vacío. Basate SOLO en lo aportado. Respondé en español rioplatense.',
    '',
    `LEGAJO: ${input.titulo}`,
    `Tipo de acto: ${input.tipo || '-'}`,
    '',
    'DOCUMENTOS ANALIZADOS A COTEJAR:',
    docsTexto || '(sin documentos analizados)',
  ].join('\n');

  const promptLegal = [
    'Sos un abogado litigante argentino experto en derecho procesal. Vas a COTEJAR los escritos y documentos ya analizados de un mismo expediente judicial (típicamente la demanda frente a su contestación) para determinar cómo quedó trabada la litis: qué hechos quedaron reconocidos, cuáles controvertidos, qué prueba hace falta y qué defensas o plazos vigilar.',
    'Analizá: hechos admitidos por ambas partes; hechos negados o con versiones enfrentadas; defensas y excepciones opuestas (por ejemplo prescripción, falta de legitimación, culpa de la víctima); rubros y montos impugnados; y la prueba ofrecida o pendiente de producir.',
    'Respondé SOLO un objeto JSON válido (sin texto adicional) con esta forma exacta:',
    '{',
    ' "veredicto": "1-2 oraciones sobre cómo quedó trabada la litis y el eje del conflicto",',
    ' "coincidencias": ["hechos reconocidos o no controvertidos, admitidos por ambas partes"],',
    ' "discrepancias": ["puntos controvertidos: hechos negados o versiones enfrentadas, indicando qué escrito sostiene qué"],',
    ' "faltantes": ["prueba pendiente de producir u ofrecer y medidas necesarias para acreditar los hechos controvertidos"],',
    ' "alertas_vigencia": ["alertas procesales: excepciones o defensas opuestas (prescripción, etc.), plazos de prueba y riesgos a vigilar, con la fecha si surge"]',
    '}',
    'Reglas: NO inventes datos, montos, fechas ni artículos. Si algo no surge de la información aportada, devolvé un array vacío. Basate SOLO en lo aportado. Respondé en español rioplatense.',
    '',
    `EXPEDIENTE: ${input.titulo}`,
    `Tipo de caso: ${input.tipo || '-'}`,
    '',
    'ESCRITOS Y DOCUMENTOS ANALIZADOS A COTEJAR:',
    docsTexto || '(sin documentos analizados)',
  ].join('\n');

  const promptInmobiliaria = [
    'Sos un asesor inmobiliario argentino experto en coordinar operaciones de compraventa, alquiler y reserva. Vas a COTEJAR (cruzar) los documentos ya analizados de una misma operación para verificar que sean coherentes entre sí antes de avanzar (reservar, firmar el boleto o escriturar).',
    'Compará especialmente: identidad y datos de las partes (comprador/vendedor, locador/inquilino, garantes: nombres, DNI/CUIT); datos del inmueble (dirección, nomenclatura/matrícula, superficie, tipo); precio o valor de la operación, moneda, seña/reserva y forma de pago; y plazos comprometidos (fecha de escrituración, entrega de posesión, vigencia de la reserva).',
    'Respondé SOLO un objeto JSON válido (sin texto adicional) con esta forma exacta:',
    '{',
    ' "veredicto": "1-2 oraciones con el estado general del cotejo (coherente / con observaciones / con discrepancias serias)",',
    ' "coincidencias": ["datos que coinciden correctamente entre documentos"],',
    ' "discrepancias": ["diferencias o contradicciones entre documentos, indicando qué documento y qué dato"],',
    ' "faltantes": ["documentos o datos que faltarían para avanzar la operación (informe de dominio, boleto firmado, comprobante de seña, etc.)"],',
    ' "alertas_vigencia": ["alertas de la operación: reservas o certificados próximos a vencer y plazos comprometidos, con la fecha si surge"]',
    '}',
    'Reglas: NO inventes datos. Si algo no surge de la información aportada, devolvé un array vacío. Basate SOLO en lo aportado. Respondé en español rioplatense.',
    '',
    `OPERACIÓN: ${input.titulo}`,
    `Tipo de operación: ${input.tipo || '-'}`,
    '',
    'DOCUMENTOS ANALIZADOS A COTEJAR:',
    docsTexto || '(sin documentos analizados)',
  ].join('\n');

  const prompt = esLegal
    ? promptLegal
    : input.industria === 'inmobiliaria'
    ? promptInmobiliaria
    : promptNotarial;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
        }),
      }
    );
    if (!resp.ok) {
      console.error('Cotejo Gemini error:', resp.status, await resp.text());
      return { ok: false, motivo: 'error' };
    }
    const data = await resp.json();
    const raw: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('') ?? '';
    if (!raw.trim()) return { ok: false, motivo: 'error' };
    const parsed = JSON.parse(raw);
    const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);
    const veredicto = String(parsed.veredicto ?? '');
    const coincidencias = arr(parsed.coincidencias);
    let discrepancias = arr(parsed.discrepancias);
    const faltantes = arr(parsed.faltantes);
    let alertas_vigencia = arr(parsed.alertas_vigencia);

    if (input.industria === 'escribania') {
      let plazo: any = input.plazoCanonico;
      if (!plazo) {
        const datosBoleto = detectarDatosBoleto(input.documentos, []);
        if (datosBoleto.fechaBoleto && datosBoleto.plazoDias && datosBoleto.fechaTentativa) {
          plazo = analizarPlazoBoletoEscritura(
            datosBoleto.fechaBoleto,
            datosBoleto.plazoDias,
            datosBoleto.fechaTentativa
          );
        }
      }

      if (plazo && (plazo.excedePlazo || plazo.excesoDias > 0 || plazo.diasExceso > 0)) {
        const rawTentativa = plazo.fechaTentativa || plazo.fechaTentativaAr || '';
        const rawLimite = plazo.fechaLimite || plazo.fechaLimiteAr || '';
        const fTentativa = formatIsoToAr(rawTentativa);
        const fLimite = formatIsoToAr(rawLimite);
        const dias = plazo.excesoDias ?? plazo.diasExceso ?? 2;
        const diasPlazo = plazo.plazoDias ?? 90;

        const discExacta = `Plazo contractual: la fecha tentativa de escritura (${fTentativa}) supera el límite contractual (${fLimite}) por ${dias} días corridos.`;
        const vigExacta = `La fecha tentativa de escritura (${fTentativa}) excede el plazo máximo de ${diasPlazo} días corridos, cuyo límite es el ${fLimite}.`;

        // Prevenir que el prompt o el modelo omitan o alteren estos textos exactos
        discrepancias = discrepancias.filter(
          (d: string) => !d.toLowerCase().includes('plazo') && !d.toLowerCase().includes('supera el límite') && !d.includes(fLimite)
        );
        discrepancias.unshift(discExacta);

        alertas_vigencia = alertas_vigencia.filter(
          (a: string) => !a.toLowerCase().includes('plazo') && !a.toLowerCase().includes('excede') && !a.includes(fLimite)
        );
        alertas_vigencia.unshift(vigExacta);
      }
    }

    return {
      ok: true,
      model: `cotejo-${modelo}`,
      cotejo: {
        veredicto,
        coincidencias,
        discrepancias,
        faltantes,
        alertas_vigencia,
      },
    };
  } catch (e) {
    console.error('Cotejo parse error:', e);
    return { ok: false, motivo: 'error' };
  }
}

