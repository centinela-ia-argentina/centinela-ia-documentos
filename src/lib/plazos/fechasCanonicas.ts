/**
 * Utilidades canónicas para extracción, clasificación y coherencia de fechas
 * en legajos, agenda, observaciones y análisis documental.
 */

import { clasificarFecha, isActionableDate } from './plazos';

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

  // 2.1) Priorizar fecha específica de boleto de compraventa
  const plazoBoleto = fechasPlazos.find((fp: any) => {
    if (!fp?.fecha || typeof fp.fecha !== 'string') return false;
    const d = (fp.descripcion || '').toLowerCase();
    if (d.includes('límite') || d.includes('limite') || d.includes('tentativa') || d.includes('máximo')) return false;
    return d.includes('boleto');
  });
  if (plazoBoleto?.fecha) {
    const f = String(plazoBoleto.fecha).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return formatIsoToAr(f);
  }

  // 2.2) Fecha de otorgamiento / firma / escrituración
  const plazoRelevante = fechasPlazos.find((fp: any) => {
    if (!fp?.fecha || typeof fp.fecha !== 'string') return false;
    const d = (fp.descripcion || '').toLowerCase();
    if (d.includes('límite') || d.includes('limite') || d.includes('plazo máximo')) return false;
    return (
      d.includes('otorgamiento') ||
      d.includes('firma') ||
      d.includes('escrituraci') ||
      d.includes('compraventa')
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
 * Suma días corridos a una fecha ISO (YYYY-MM-DD) de forma determinística en tiempo civil (UTC).
 */
export function sumarDiasCorridos(fechaIso: string, dias: number): string {
  const clean = fechaIso.trim().slice(0, 10);
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return fechaIso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  const resY = dt.getUTCFullYear();
  const resM = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const resD = String(dt.getUTCDate()).padStart(2, '0');
  return `${resY}-${resM}-${resD}`;
}

/**
 * Calcula la diferencia en días corridos entre dos fechas ISO (fechaHasta - fechaDesde).
 */
export function diferenciaDiasCorridos(fechaDesdeIso: string, fechaHastaIso: string): number {
  const cleanDesde = fechaDesdeIso.trim().slice(0, 10);
  const cleanHasta = fechaHastaIso.trim().slice(0, 10);
  const [y1, m1, d1] = cleanDesde.split('-').map(Number);
  const [y2, m2, d2] = cleanHasta.split('-').map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return NaN;
  const dt1 = Date.UTC(y1, m1 - 1, d1);
  const dt2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((dt2 - dt1) / 86_400_000);
}

export interface AnalisisPlazoNotarial {
  fechaBoleto: string; // YYYY-MM-DD
  fechaBoletoAr: string; // DD/MM/YYYY
  plazoDias: number;
  fechaLimite: string; // YYYY-MM-DD
  fechaLimiteAr: string; // DD/MM/YYYY
  fechaTentativa?: string; // YYYY-MM-DD
  fechaTentativaAr?: string; // DD/MM/YYYY
  excedePlazo: boolean;
  diasExceso: number;
  advertencia?: string;
}

/**
 * Analiza el cómputo de plazos corridos de boleto y escrituración notarial.
 * Determina si la fecha tentativa excede el límite contractual y por cuántos días.
 */
export function analizarPlazoBoletoEscritura(
  fechaBoletoIso: string,
  plazoDias: number,
  fechaTentativaIso?: string
): AnalisisPlazoNotarial {
  const fechaLimite = sumarDiasCorridos(fechaBoletoIso, plazoDias);
  const fechaBoletoAr = formatIsoToAr(fechaBoletoIso);
  const fechaLimiteAr = formatIsoToAr(fechaLimite);

  let excedePlazo = false;
  let diasExceso = 0;
  let advertencia: string | undefined;
  let fechaTentativaAr: string | undefined;

  if (fechaTentativaIso && fechaTentativaIso.trim().length >= 10) {
    const cleanTentativa = fechaTentativaIso.trim().slice(0, 10);
    fechaTentativaAr = formatIsoToAr(cleanTentativa);
    const diff = diferenciaDiasCorridos(fechaLimite, cleanTentativa);
    if (diff > 0) {
      excedePlazo = true;
      diasExceso = diff;
      advertencia = `La fecha tentativa de escrituración (${fechaTentativaAr}) excede el plazo contractual de ${plazoDias} días corridos (límite: ${fechaLimiteAr}) por ${diasExceso} día${diasExceso === 1 ? '' : 's'} corridos.`;
    }
  }

  return {
    fechaBoleto: fechaBoletoIso.trim().slice(0, 10),
    fechaBoletoAr,
    plazoDias,
    fechaLimite,
    fechaLimiteAr,
    fechaTentativa: fechaTentativaIso?.trim().slice(0, 10),
    fechaTentativaAr,
    excedePlazo,
    diasExceso,
    advertencia,
  };
}

/**
 * Extrae todas las fechas operativas / clave de un legajo a partir de su metadata
 * y de los análisis documentales de IA asociados.
 */
export function extraerFechasOperativasLegajo(
  c: {
    id: string;
    title: string | null;
    metadata?: Record<string, any> | null;
  },
  aiOutputs?: any[] | null,
  agendaEvents?: any[] | null
): FechaOperativa[] {
  const meta = c.metadata ?? {};
  const items: FechaOperativa[] = [];
  const title = c.title || 'Legajo sin título';
  const agregados = new Set<string>();

  const pushItem = (id: string, fechaIso: string, tipo: string) => {
    const key = `${fechaIso}-${tipo.toLowerCase().trim()}`;
    if (agregados.has(key)) return;
    agregados.add(key);
    items.push({ id, title, fecha: fechaIso, tipo });
  };

  // 1) Fechas en metadata explícita
  const metaCandidates: Array<{ key: string; label: string }> = [
    { key: 'fecha_limite', label: 'Fecha límite contractual' },
    { key: 'fecha_limite_contractual', label: 'Fecha límite contractual' },
    { key: 'fecha_otorgamiento', label: 'Fecha tentativa de escritura' },
    { key: 'fecha_tentativa', label: 'Fecha tentativa de escritura' },
    { key: 'fecha_relevante', label: (meta.tipo_fecha as string) || 'Próximo vencimiento / fecha clave' },
    { key: 'fecha_audiencia', label: 'Audiencia' },
    { key: 'fecha_fin_reserva', label: 'Vencimiento de reserva' },
    { key: 'fecha_vencimiento', label: 'Vencimiento' },
    { key: 'fecha_boleto', label: 'Fecha del boleto' },
  ];

  for (const cand of metaCandidates) {
    const val = meta[cand.key];
    if (typeof val === 'string' && val.trim().length >= 10) {
      const sliceIso = val.trim().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(sliceIso)) {
        pushItem(`${cand.key}-${c.id}`, sliceIso, cand.label);
      }
    }
  }

  // 2) Fechas en aiOutputs vinculados
  if (Array.isArray(aiOutputs)) {
    for (const a of aiOutputs) {
      const rj = a?.result_json as any;
      const fechas = Array.isArray(rj?.fechas_plazos) ? rj.fechas_plazos : [];
      for (const fp of fechas) {
        const f = String(fp?.fecha || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) continue;
        const desc = String(fp?.descripcion || '').trim();
        if (!desc) continue;
        const dLower = desc.toLowerCase();
        let tipo = desc;
        if (dLower.includes('límite') || dLower.includes('limite') || (dLower.includes('plazo') && dLower.includes('contractual'))) {
          tipo = 'Fecha límite contractual';
        } else if (dLower.includes('tentativa') || dLower.includes('estimada')) {
          tipo = 'Fecha tentativa de escritura';
        } else if (dLower.includes('boleto') && !dLower.includes('límite') && !dLower.includes('limite')) {
          tipo = 'Fecha del boleto';
        }
        pushItem(`ai-${a.id || c.id}-${f}-${tipo}`, f, tipo);
      }
    }
  }

  // 3) Fechas en eventos de Agenda vinculados
  if (Array.isArray(agendaEvents)) {
    for (const ev of agendaEvents) {
      const f = String(ev?.fecha || ev?.event_date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) continue;
      const desc = String(ev?.titulo || ev?.title || ev?.tipo || ev?.event_type || 'Evento de agenda').trim();
      let tipo = desc;
      const dLower = desc.toLowerCase();
      if (dLower.includes('límite') || dLower.includes('limite') || (dLower.includes('plazo') && dLower.includes('contractual'))) {
        tipo = 'Fecha límite contractual';
      } else if (dLower.includes('tentativa') || dLower.includes('estimada') || dLower.includes('escrituraci') || dLower.includes('firma')) {
        tipo = 'Fecha tentativa de escritura';
      } else if (dLower.includes('boleto') && !dLower.includes('límite')) {
        tipo = 'Fecha del boleto';
      }
      pushItem(`agenda-${f}-${tipo}`, f, tipo);
    }
  }

  // 4) Cómputo unificado y derivación si falta 'Fecha límite contractual':
  // Si existe fecha_boleto y plazo (en metadata o en aiOutputs), derivar la fecha límite
  if (!items.some((it) => it.tipo === 'Fecha límite contractual')) {
    let fBoleto = meta.fecha_boleto ? String(meta.fecha_boleto).slice(0, 10) : undefined;
    let plazo = meta.plazo_dias ? Number(meta.plazo_dias) : (meta.plazo_escrituracion_dias ? Number(meta.plazo_escrituracion_dias) : undefined);

    if (!fBoleto) {
      const itemBoleto = items.find((it) => it.tipo === 'Fecha del boleto');
      if (itemBoleto) {
        fBoleto = itemBoleto.fecha;
      } else if (Array.isArray(aiOutputs)) {
        for (const a of aiOutputs) {
          const rj = a?.result_json as any;
          const fechas = Array.isArray(rj?.fechas_plazos) ? rj.fechas_plazos : [];
          for (const fp of fechas) {
            const desc = String(fp?.descripcion || '').toLowerCase();
            if (desc.includes('boleto') && fp?.fecha) {
              const f = String(fp.fecha).slice(0, 10);
              if (/^\d{4}-\d{2}-\d{2}$/.test(f)) {
                fBoleto = f;
                break;
              }
            }
          }
          if (fBoleto) break;
        }
      }
    }

    if (!plazo && Array.isArray(aiOutputs)) {
      const dump = JSON.stringify(aiOutputs.map((a) => a?.result_json ?? a?.content ?? ''));
      const mPlazo =
        dump.match(/(\d{1,3})\s*d[ií]as\s+corridos/i) ||
        dump.match(/plazo\s+(?:contractual\s+)?(?:de\s+)?(\d{1,3})\s*d[ií]as/i);
      if (mPlazo) {
        const p = parseInt(mPlazo[1], 10);
        if (Number.isInteger(p) && p > 0) {
          plazo = p;
        }
      }
    }

    if (fBoleto && plazo && Number.isInteger(plazo) && plazo > 0) {
      const fLimite = sumarDiasCorridos(fBoleto, plazo);
      pushItem(`fecha_limite_derivada-${c.id}`, fLimite, 'Fecha límite contractual');
    }
  }

  return items;
}

/**
 * Extrae exclusivamente las fechas accionables (plazos, vencimientos, audiencias, tentativas),
 * excluyendo explícitamente fechas de emisión histórica (como 'Fecha del boleto') para Radar y Observaciones.
 */
export function extraerFechasAccionablesLegajo(
  c: {
    id: string;
    title: string | null;
    metadata?: Record<string, any> | null;
  },
  aiOutputs?: any[] | null,
  agendaEvents?: any[] | null
): FechaOperativa[] {
  const todas = extraerFechasOperativasLegajo(c, aiOutputs, agendaEvents);
  return todas.filter((it) => {
    const tLower = it.tipo.toLowerCase().trim();
    if (tLower.includes('fecha del boleto') || tLower === 'fecha de boleto') {
      return false;
    }
    const clasificacion = clasificarFecha(it.tipo);
    if (clasificacion === 'issue_date' || clasificacion === 'informational' || clasificacion === 'payment_date') {
      return false;
    }
    return isActionableDate(clasificacion, it.tipo);
  });
}
