/**
 * Utilidades canónicas para extracción, clasificación y coherencia de fechas
 * en legajos, agenda, observaciones y análisis documental.
 */

export interface FechaOperativa {
  id: string;
  title: string;
  fecha: string; // YYYY-MM-DD
  tipo: string;
}

/** Formatea una fecha ISO (YYYY-MM-DD) a DD/MM/YYYY */
export function formatIsoToAr(iso: string): string {
  const clean = iso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return iso;
  const [y, m, d] = clean.split('-');
  return `${d}/${m}/${y}`;
}

const MESES_MAP: Record<string, string> = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  setiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12',
};

/**
 * Extrae la fecha respaldada de boleto u otorgamiento para el borrador ROS / UIF.
 * Prioriza fecha en metadata del legajo, luego plazos documentales de IA respaldados,
 * y finalmente menciones textuales verificadas en los análisis.
 */
export function extraerFechaBoletoUif(
  analisisData?: any[],
  resumenData?: any,
  caseRecord?: { metadata?: Record<string, any> | null; case_type?: string | null }
): string | undefined {
  // 1) Metadata explícita del legajo
  const meta = caseRecord?.metadata;
  const metaFecha =
    (typeof meta?.fecha_boleto === 'string' && meta.fecha_boleto.trim()) ||
    (typeof meta?.fecha_otorgamiento === 'string' && meta.fecha_otorgamiento.trim()) ||
    (typeof meta?.fecha_relevante === 'string' && meta.fecha_relevante.trim());

  if (metaFecha && /^\d{4}-\d{2}-\d{2}/.test(metaFecha)) {
    return formatIsoToAr(metaFecha);
  }
  if (metaFecha && /^\d{2}\/\d{2}\/\d{4}$/.test(metaFecha)) {
    return metaFecha;
  }

  // 2) Fechas en analisisData (fechas_plazos de IA)
  const fechasPlazos = (analisisData ?? []).flatMap((a) => (a?.result_json as any)?.fechas_plazos || []);
  const plazoRelevante = fechasPlazos.find((fp: any) => {
    if (!fp?.fecha || typeof fp.fecha !== 'string') return false;
    const d = (fp.descripcion || '').toLowerCase();
    if (d.includes('tentativa') || d.includes('plazo máximo')) return false;
    return (
      d.includes('boleto') ||
      d.includes('compraventa') ||
      d.includes('otorgamiento') ||
      d.includes('firma') ||
      d.includes('escrituraci')
    );
  });

  if (plazoRelevante?.fecha) {
    const f = String(plazoRelevante.fecha).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(f)) {
      return formatIsoToAr(f);
    }
  }

  // 3) Búsqueda en dump textual (evidencia textual)
  const dump =
    JSON.stringify((analisisData ?? []).map((a) => a?.result_json)) +
    JSON.stringify(resumenData?.result_json ?? '');

  // Matcher de fecha en formato texto "10 de septiembre de 2026"
  const textMatch = dump.match(
    /(?:boleto|compraventa|otorgamiento|firma|fecha)[^\d]{1,60}?(\d{1,2})\s+de\s+([a-z]+)\s+del?\s+(\d{4})/i
  );
  if (textMatch) {
    const dia = textMatch[1].padStart(2, '0');
    const mesNom = textMatch[2].toLowerCase();
    const anio = textMatch[3];
    const mesNum = MESES_MAP[mesNom];
    if (mesNum) {
      return `${dia}/${mesNum}/${anio}`;
    }
  }

  // Matcher DD/MM/YYYY
  const dmMatch = dump.match(
    /(?:boleto|compraventa|otorgamiento|firma)[^\d]{1,60}?(\d{2}\/\d{2}\/\d{4})/i
  );
  if (dmMatch) {
    return dmMatch[1];
  }

  // Matcher YYYY-MM-DD
  const isoMatch = dump.match(
    /(?:boleto|compraventa|otorgamiento|firma)[^\d]{1,60}?(\d{4}-\d{2}-\d{2})/i
  );
  if (isoMatch) {
    return formatIsoToAr(isoMatch[1]);
  }

  return undefined;
}

/**
 * Extrae todas las fechas operativas / clave de un legajo a partir de su metadata.
 */
export function extraerFechasOperativasLegajo(c: {
  id: string;
  title: string | null;
  metadata?: Record<string, any> | null;
}): FechaOperativa[] {
  const meta = c.metadata ?? {};
  const items: FechaOperativa[] = [];
  const title = c.title || 'Legajo sin título';

  const candidates: Array<{ key: string; label: string }> = [
    { key: 'fecha_otorgamiento', label: 'Fecha estimada de firma' },
    { key: 'fecha_relevante', label: (meta.tipo_fecha as string) || 'Próximo vencimiento / fecha clave' },
    { key: 'fecha_audiencia', label: 'Audiencia' },
    { key: 'fecha_fin_reserva', label: 'Vencimiento de reserva' },
    { key: 'fecha_vencimiento', label: 'Vencimiento' },
    { key: 'fecha_boleto', label: 'Fecha de boleto' },
  ];

  for (const cand of candidates) {
    const val = meta[cand.key];
    if (typeof val === 'string' && val.trim().length >= 10) {
      const sliceIso = val.trim().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(sliceIso)) {
        items.push({
          id: `${cand.key}-${c.id}`,
          title,
          fecha: sliceIso,
          tipo: cand.label,
        });
      }
    }
  }

  return items;
}
