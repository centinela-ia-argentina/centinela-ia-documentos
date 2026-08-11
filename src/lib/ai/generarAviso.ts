import 'server-only';

export async function generarAvisoPropiedad(datos: {
  name: string;
  property_type: string;
  address: string;
  surface_total_m2: number | null;
  surface_covered_m2: number | null;
  rooms: number | null;
  price: number | null;
  currency: string;
}): Promise<{ ok: false; motivo: 'sin_api_key' | 'error' } | { ok: true; texto: string; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, motivo: 'sin_api_key' };

  const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const prompt = [
    'Sos un redactor publicitario inmobiliario argentino experto. Con los datos REALES de la propiedad de abajo, escribí un aviso atractivo y profesional listo para publicar. Devolvé texto plano con esta estructura:',
    'TÍTULO: (un título corto y vendedor)',
    'DESCRIPCIÓN: (4 a 6 oraciones destacando ubicación, ambientes, superficie y valor)',
    'REDES: (una versión corta con 2-3 emojis y 3 hashtags para Instagram)',
    'Reglas: NO inventes datos, comodidades ni características que no estén en los datos. Si falta algún dato esencial para el aviso, escribí el marcador [COMPLETAR: dato]. No inventes barrio si no está la dirección. Tono profesional y cálido.',
    '',
    'DATOS DE LA PROPIEDAD:',
    `Nombre: ${datos.name}`,
    `Tipo: ${datos.property_type}`,
    `Dirección: ${datos.address || 'Sin especificar'}`,
    `Superficie Total: ${datos.surface_total_m2 ? datos.surface_total_m2 + ' m2' : 'No especificada'}`,
    `Superficie Cubierta: ${datos.surface_covered_m2 ? datos.surface_covered_m2 + ' m2' : 'No especificada'}`,
    `Ambientes: ${datos.rooms ?? 'No especificados'}`,
    `Precio: ${datos.price ? datos.currency + ' ' + datos.price : 'Consultar'}`
  ].join('\n');

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6 },
        }),
      }
    );
    if (!resp.ok) {
      console.error('Error en API Gemini (generar aviso):', await resp.text());
      return { ok: false, motivo: 'error' };
    }
    const json = await resp.json();
    const texto = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!texto || typeof texto !== 'string') {
      return { ok: false, motivo: 'error' };
    }
    return { ok: true, texto, model: modelo };
  } catch (error) {
    console.error('Error invocando Gemini (generar aviso):', error);
    return { ok: false, motivo: 'error' };
  }
}
