import pdf from 'pdf-parse/lib/pdf-parse.js';
import { getPropertyExtractionPrompt } from '../industries/aiConfig';

export interface PropertyExtraction {
  direccion: string | null;
  tipo_propiedad: 'casa' | 'departamento' | 'lote' | 'local' | 'oficina' | 'cochera' | 'otro' | null;
  matricula: string | null;
  superficie_total_m2: number | null;
  superficie_cubierta_m2: number | null;
  ambientes: number | null;
  titulares: string | null;
  gravamenes: string | null;
  observaciones: string | null;
}

export async function extraerDatosPropiedadDeArchivo(
  buffer: Buffer,
  mimeType: string
): Promise<PropertyExtraction | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('No está configurada la API de Gemini (GEMINI_API_KEY).');
  }

  const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const systemPrompt = getPropertyExtractionPrompt();
  let textContent = '';

  if (mimeType === 'application/pdf') {
    try {
      const data = await pdf(buffer);
      textContent = data.text;
    } catch (err) {
      console.warn('Error al extraer texto del PDF (podría ser un escaneo):', err);
    }
  }

  const cleanText = textContent
    .replace(/(\r\n|\n|\r)/gm, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 18000);

  let bodyData: any;

  if (cleanText.trim().length >= 200) {
    bodyData = {
      contents: [{ parts: [{ text: `${systemPrompt}\n\nDocumento:\n${cleanText}` }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    };
  } else {
    if (buffer.length > 15 * 1024 * 1024) {
      throw new Error('El archivo es demasiado grande para análisis visual (>15MB).');
    }

    if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
      const base64Data = buffer.toString('base64');
      bodyData = {
        contents: [
          {
            parts: [
              { text: systemPrompt },
              {
                inline_data: {
                  data: base64Data,
                  mime_type: mimeType,
                },
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      };
    } else {
      throw new Error('Tipo de archivo no soportado para análisis multimodal.');
    }
  }

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      }
    );

    if (!resp.ok) {
      console.error('Error en extraerDatosPropiedadDeArchivo:', resp.status, await resp.text());
      return null;
    }

    const data = await resp.json();
    const raw: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('') ?? '';

    if (!raw.trim()) return null;

    const parsed = JSON.parse(raw);
    return {
      direccion: typeof parsed.direccion === 'string' && parsed.direccion ? parsed.direccion : null,
      tipo_propiedad: typeof parsed.tipo_propiedad === 'string' && parsed.tipo_propiedad ? parsed.tipo_propiedad as any : null,
      matricula: typeof parsed.matricula === 'string' && parsed.matricula ? parsed.matricula : null,
      superficie_total_m2: typeof parsed.superficie_total_m2 === 'number' ? parsed.superficie_total_m2 : null,
      superficie_cubierta_m2: typeof parsed.superficie_cubierta_m2 === 'number' ? parsed.superficie_cubierta_m2 : null,
      ambientes: typeof parsed.ambientes === 'number' ? parsed.ambientes : null,
      titulares: typeof parsed.titulares === 'string' && parsed.titulares ? parsed.titulares : null,
      gravamenes: typeof parsed.gravamenes === 'string' && parsed.gravamenes ? parsed.gravamenes : null,
      observaciones: typeof parsed.observaciones === 'string' && parsed.observaciones ? parsed.observaciones : null,
    };
  } catch (e) {
    console.error('Error parseando JSON devuelto por IA:', e);
    return null;
  }
}
