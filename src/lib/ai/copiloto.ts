import 'server-only';

import { analizarPlazoBoletoEscritura } from '@/lib/plazos/fechasCanonicas';

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

  const mBoleto = allText.match(/(?:boleto|compraventa)[^\d]{1,60}?(\d{4}-\d{2}-\d{2})/i) ||
                  allText.match(/(?:boleto|compraventa)[^\d]{1,60}?(\d{2}\/\d{2}\/\d{4})/i);
  if (mBoleto) {
    const raw = mBoleto[1];
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) fechaBoleto = raw;
    else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [d, m, y] = raw.split('/');
      fechaBoleto = `${y}-${m}-${d}`;
    }
  }

  const mPlazo = allText.match(/(\d{1,3})\s*d[ií]as\s+corridos/i) ||
                 allText.match(/plazo\s+(?:contractual\s+)?(?:de\s+)?(\d{1,3})\s*d[ií]as/i);
  if (mPlazo) {
    const p = parseInt(mPlazo[1], 10);
    if (!Number.isNaN(p) && p > 0) plazoDias = p;
  }

  const mTentativa = allText.match(/(?:tentativa|estimada|escrituraci[oó]n)[^\d]{1,60}?(\d{4}-\d{2}-\d{2})/i) ||
                     allText.match(/(?:tentativa|estimada|escrituraci[oó]n)[^\d]{1,60}?(\d{2}\/\d{2}\/\d{4})/i);
  if (mTentativa) {
    const raw = mTentativa[1];
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) fechaTentativa = raw;
    else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [d, m, y] = raw.split('/');
      fechaTentativa = `${y}-${m}-${d}`;
    }
  }

  return { fechaBoleto, plazoDias, fechaTentativa };
}

export async function generarResumenConIA(input: {
  titulo: string; cliente: string; tipo: string; estado: string;
  industria?: string;
  documentos: DocInput[]; eventos: EventoInput[];
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
      const datosBoleto = detectarDatosBoleto(input.documentos, input.eventos);
      if (datosBoleto.fechaBoleto && datosBoleto.plazoDias && datosBoleto.fechaTentativa) {
        const analisis = analizarPlazoBoletoEscritura(
          datosBoleto.fechaBoleto,
          datosBoleto.plazoDias,
          datosBoleto.fechaTentativa
        );
        if (analisis.excedePlazo && analisis.advertencia) {
          const yaTieneAlerta = riesgosAlertas.some((r) => r.toLowerCase().includes('excede'));
          if (!yaTieneAlerta) {
            riesgosAlertas.unshift(analisis.advertencia);
          }
          if (!resumenGeneral.toLowerCase().includes('excede')) {
            resumenGeneral += ` Se advierte que la fecha tentativa de escrituración (${analisis.fechaTentativaAr}) excede el plazo contractual de ${analisis.plazoDias} días corridos (límite: ${analisis.fechaLimiteAr}) por ${analisis.diasExceso} día${analisis.diasExceso === 1 ? '' : 's'} corridos.`;
          }
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
}): Promise<
  | { ok: false; motivo: 'sin_api_key' | 'sin_datos' | 'error' }
  | { ok: true; cotejo: CotejoNotarial; model: string }
> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, motivo: 'sin_api_key' };
  if (input.documentos.length < 2) return { ok: false, motivo: 'sin_datos' };

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
    return {
      ok: true,
      model: `cotejo-${modelo}`,
      cotejo: {
        veredicto: String(parsed.veredicto ?? ''),
        coincidencias: arr(parsed.coincidencias),
        discrepancias: arr(parsed.discrepancias),
        faltantes: arr(parsed.faltantes),
        alertas_vigencia: arr(parsed.alertas_vigencia),
      },
    };
  } catch (e) {
    console.error('Cotejo parse error:', e);
    return { ok: false, motivo: 'error' };
  }
}

