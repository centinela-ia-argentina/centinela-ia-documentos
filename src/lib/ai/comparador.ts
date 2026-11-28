import 'server-only';

export type DiferenciaComparacion = {
  seccion: string;
  detalle: string;
};

export type ComparacionInstrumentos = {
  resumen: string;
  diferencias: DiferenciaComparacion[];
  coincidencias: string[];
  advertencias: string[];
};

export type ComparacionInput = {
  nombreA: string;
  textoA: string;
  nombreB: string;
  textoB: string;
};

export type ComparacionResult =
  | { ok: false; motivo: 'sin_api_key' | 'sin_datos' | 'error' }
  | { ok: true; comparacion: ComparacionInstrumentos; model: string };

export function comparacionVacia(input: ComparacionInput): boolean {
  return !input.textoA.trim() || !input.textoB.trim();
}

/** Parseo tolerante de la respuesta de la IA: nunca rompe, degrada a arrays vacíos. */
export function parseComparacion(raw: string): ComparacionInstrumentos | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const obj = parsed as Record<string, unknown>;
  if (!obj || typeof obj !== 'object') return null;

  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)).filter((s) => s.trim()) : []);
  const diferencias = Array.isArray(obj.diferencias)
    ? (obj.diferencias as Record<string, unknown>[])
        .map((d) => ({ seccion: String(d?.seccion ?? ''), detalle: String(d?.detalle ?? '') }))
        .filter((d) => d.seccion.trim() && d.detalle.trim())
    : [];

  return {
    resumen: String(obj.resumen ?? ''),
    diferencias,
    coincidencias: arr(obj.coincidencias),
    advertencias: arr(obj.advertencias),
  };
}

export function buildPromptComparacion(input: ComparacionInput): string {
  return [
    'Sos un escribano senior argentino. Compará los DOS INSTRUMENTOS que te paso (por ejemplo, la minuta aprobada y la escritura protocolizada, o dos versiones del mismo instrumento) y devolvé un reporte de cotejo.',
    'Respondé SOLO un objeto JSON válido (sin texto adicional) con esta forma exacta:',
    '{',
    '  "resumen": "2-3 oraciones con la conclusión del cotejo",',
    '  "diferencias": [{"seccion": "cláusula o dato donde difieren", "detalle": "qué dice cada instrumento"}],',
    '  "coincidencias": ["datos que coinciden y dan seguridad al cotejo"],',
    '  "advertencias": ["puntos que el escribano debe verificar antes de otorgar"]',
    '}',
    'Reglas ESTRICTAS:',
    '- Compará solo el contenido de los dos textos aportados; NO inventes datos, montos, fechas, matrículas ni normativa.',
    '- Priorizá las diferencias que importan para la fe pública: partes y personería, inmueble (matrícula / nomenclatura catastral / superficie), precio y moneda, fechas, cláusulas sustantivas, firma.',
    '- NO confundas la matrícula (folio real) con la nomenclatura o designación catastral.',
    '- Si los textos son esencialmente iguales, devolvé "diferencias" vacío y explicalo en "resumen".',
    '- Si un texto está incompleto o ilegible en alguna parte, señalalo en "advertencias".',
    '',
    `INSTRUMENTO A — ${input.nombreA}:`,
    input.textoA,
    '',
    `INSTRUMENTO B — ${input.nombreB}:`,
    input.textoB,
  ].join('\n');
}

export async function compararInstrumentosConIA(
  input: ComparacionInput,
): Promise<ComparacionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, motivo: 'sin_api_key' };
  if (comparacionVacia(input)) return { ok: false, motivo: 'sin_datos' };

  const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const prompt = buildPromptComparacion(input);

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
      console.error('Comparación Gemini error:', resp.status, await resp.text());
      return { ok: false, motivo: 'error' };
    }

    const data = await resp.json();
    const raw: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('') ?? '';
    if (!raw.trim()) return { ok: false, motivo: 'error' };

    const comparacion = parseComparacion(raw);
    if (!comparacion) return { ok: false, motivo: 'error' };

    return { ok: true, comparacion, model: modelo };
  } catch (e) {
    console.error('Comparación parse error:', e);
    return { ok: false, motivo: 'error' };
  }
}
