import 'server-only';

export type BorradorInmobiliaria = {
  titulo: string;
  cuerpo: string;
  datos_faltantes: string[];
  advertencias: string[];
};

type DocInput = { nombre: string; tipo: string; resumen: string; alertas: string[]; datos: string[] };

export async function redactarBorradorInmobiliariaConIA(input: {
  titulo: string;
  tipoDocumento: string;
  tipoOperacion: string;
  partes: string;
  valorOperacion: string;
  inmueble: string;
  resumenGeneral: string;
  documentos: DocInput[];
}): Promise<
  | { ok: false; motivo: 'sin_api_key' | 'sin_datos' | 'error' }
  | { ok: true; borrador: BorradorInmobiliaria; model: string }
> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, motivo: 'sin_api_key' };
  if (input.documentos.length === 0 && !input.resumenGeneral.trim()) {
    return { ok: false, motivo: 'sin_datos' };
  }

  const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const docsTexto = input.documentos.map((d, i) =>
    `Documento ${i + 1}: ${d.nombre} (${d.tipo})\nResumen: ${d.resumen}\nDatos clave: ${d.datos.join('; ') || '-'}\nAlertas: ${d.alertas.join('; ') || '-'}`
  ).join('\n\n');

  const prompt = [
    'Sos un asesor inmobiliario argentino con experiencia en la redacción de instrumentos previos a la escritura (boleta de reserva, boleto de compraventa, contrato de locación). En base a los datos de la operación y a los documentos ya analizados, redactá un BORRADOR del documento solicitado, claro y con estructura profesional en español rioplatense.',
    'Estructura sugerida (adaptala al tipo de documento): título, lugar y fecha; individualización de las partes (vendedor/comprador o locador/locatario y garantes); individualización del inmueble (dirección, nomenclatura/matrícula, superficie); precio o valor de la operación, moneda, seña o reserva y forma/plazos de pago; plazo para firmar el boleto o escriturar y entrega de la posesión; obligaciones de las partes; cláusula penal o de seña; y cierre con firmas.',
    'Respondé SOLO un objeto JSON válido (sin texto adicional) con esta forma exacta:',
    '{',
    '  "titulo": "título breve del borrador, ej: Borrador de boleto de compraventa",',
    '  "cuerpo": "el texto completo del borrador, con saltos de línea",',
    '  "datos_faltantes": ["datos que faltan y hay que completar antes de firmar"],',
    '  "advertencias": ["riesgos, faltantes o puntos a revisar con un profesional"]',
    '}',
    'Reglas CRÍTICAS: USÁ EXHAUSTIVAMENTE los datos de los DOCUMENTOS ANALIZADOS y la OPERACIÓN (DNI, CUIT, nombres, fechas, montos, direcciones, etc.) para completar el documento en lugar de dejar espacios en blanco. Si la información ESTÁ en el contexto, LLENALA; NO pongas [COMPLETAR]. SOLO si el dato no figura en ninguna parte del contexto aportado, poné un marcador como [COMPLETAR: dato]. NO inventes datos que no estén. Este es un BORRADOR de trabajo orientativo que un profesional debe revisar y completar; no reemplaza asesoramiento legal ni escritura pública.',
    '',
    `OPERACIÓN: ${input.titulo}`,
    `Documento a redactar: ${input.tipoDocumento || '-'}`,
    `Tipo de operación: ${input.tipoOperacion || '-'}`,
    `Partes (dato de la operación): ${input.partes || '-'}`,
    `Inmueble (dato de la operación): ${input.inmueble || '-'}`,
    `Valor de la operación (dato): ${input.valorOperacion || '-'}`,
    '',
    'RESUMEN DE LA OPERACIÓN:',
    input.resumenGeneral || '(sin resumen)',
    '',
    'DOCUMENTOS ANALIZADOS:',
    docsTexto || '(sin documentos analizados)',
  ].join('\n');

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
        }),
      }
    );
    if (!resp.ok) { console.error('Borrador inmo Gemini error:', resp.status, await resp.text()); return { ok: false, motivo: 'error' }; }
    const data = await resp.json();
    const raw: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    if (!raw.trim()) return { ok: false, motivo: 'error' };
    const parsed = JSON.parse(raw);
    const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);
    return {
      ok: true, model: `borrador-inmo-${modelo}`,
      borrador: {
        titulo: String(parsed.titulo ?? 'Borrador'),
        cuerpo: String(parsed.cuerpo ?? ''),
        datos_faltantes: arr(parsed.datos_faltantes),
        advertencias: arr(parsed.advertencias),
      },
    };
  } catch (e) { console.error('Borrador inmo parse error:', e); return { ok: false, motivo: 'error' }; }
}
