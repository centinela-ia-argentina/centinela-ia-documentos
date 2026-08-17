import 'server-only';

export type ComparableProp = {
  name: string;
  surfaceTotal: number | null;
  rooms: number | null;
  price: number | null;
  currency: string | null;
  sourceType: 'internal' | 'external';
};

export async function tasarPropiedadIA(datos: {
  name: string;
  propertyType: string;
  address: string | null;
  surfaceTotal: number | null;
  surfaceCovered: number | null;
  rooms: number | null;
  currency: string | null;
}, comparables: ComparableProp[]): Promise<{ ok: false; motivo: 'sin_api_key' | 'error' | 'sin_comparables' } | { ok: true; texto: string; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, motivo: 'sin_api_key' };

  const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const formatComp = (c: ComparableProp, i: number) => {
    const origen = c.sourceType === 'internal' ? 'Interno/Propio' : 'Externo/Portal';
    return `[${i + 1}] (${origen}) Nombre: ${c.name}, Superficie: ${c.surfaceTotal || 'S/N'} m2, Ambientes: ${c.rooms || 'S/N'}, Precio: ${c.currency || ''} ${c.price || 'S/N'}`;
  };

  if (comparables.length === 0) {
    return { ok: false, motivo: 'sin_comparables' };
  }

  const compsText = comparables.map((c, i) => formatComp(c, i)).join('\n');

  const prompt = [
    'Sos un tasador inmobiliario argentino experto. Estimá el valor de mercado de la propiedad SUJETO. Usá los COMPARABLES provistos (propiedades similares de la misma cartera o testigos externos) como referencia principal de precio por m². No inventes datos que no te di. Sé conservador. Usá la moneda de la propiedad sujeto.',
    '',
    'PROPIEDAD SUJETO:',
    `Nombre: ${datos.name}`,
    `Tipo: ${datos.propertyType}`,
    `Dirección: ${datos.address || 'Sin especificar'}`,
    `Superficie Total: ${datos.surfaceTotal ? datos.surfaceTotal + ' m2' : 'No especificada'}`,
    `Superficie Cubierta: ${datos.surfaceCovered ? datos.surfaceCovered + ' m2' : 'No especificada'}`,
    `Ambientes: ${datos.rooms ?? 'No especificados'}`,
    `Moneda: ${datos.currency ?? 'USD'}`,
    '',
    'COMPARABLES (Cartera propia y testigos externos):',
    compsText,
    '',
    'Pedí la respuesta en TEXTO PLANO con estas secciones exactas y en este orden:',
    'RANGO SUGERIDO: (mínimo – máximo, misma moneda)',
    'VALOR ESTIMADO: (un valor puntual)',
    'PRECIO POR M² DE REFERENCIA: (si aplica)',
    'FUNDAMENTOS: (3 a 5 puntos breves)',
    'COMPARABLES CONSIDERADOS: (lista breve indicando cuántos internos/propios y cuántos externos se utilizaron, y por qué se descartaron los no utilizados si hubo descartes)',
    'ACLARACIÓN: Beta operativa comercial · estimación orientativa basada en los comparables disponibles. No es una tasación oficial ni certificada y requiere revisión profesional. Las referencias externas provistas son cargadas manualmente y no se verifica su vigencia actual.'
  ].join('\n');

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4 },
        }),
      }
    );
    if (!resp.ok) {
      console.error('Error en API Gemini (tasar):', await resp.text());
      return { ok: false, motivo: 'error' };
    }
    const json = await resp.json();
    const texto = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!texto || typeof texto !== 'string') {
      return { ok: false, motivo: 'error' };
    }
    return { ok: true, texto, model: modelo };
  } catch (error) {
    console.error('Error invocando Gemini (tasar):', error);
    return { ok: false, motivo: 'error' };
  }
}
