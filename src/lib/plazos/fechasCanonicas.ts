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

export const MESES_MAP: Record<string, string> = {
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
 * Parsea una fecha en cualquier formato común (ISO YYYY-MM-DD, argentino DD/MM/YYYY, o textual español como "10 de junio de 2026").
 * Devuelve tanto la representación canónica ISO (YYYY-MM-DD) como la argentina (DD/MM/YYYY).
 */
export function parsearFechaCualquiera(str: unknown): { iso: string; ar: string } | null {
  if (typeof str !== 'string') return null;
  const s = str.trim();
  if (!s) return null;

  // 1) ISO: YYYY-MM-DD
  const isoMatch = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return { iso: `${y}-${m}-${d}`, ar: `${d}/${m}/${y}` };
  }

  // 2) DD/MM/YYYY
  const arMatch = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (arMatch) {
    const [, d, m, y] = arMatch;
    const padD = d.padStart(2, '0');
    const padM = m.padStart(2, '0');
    return { iso: `${y}-${padM}-${padD}`, ar: `${padD}/${padM}/${y}` };
  }

  // 3) Textual en español: "10 de junio de 2026", "10 de junio del 2026", "8 de septiembre de 2026"
  const textMatch = s.match(/\b(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+(?:del?|de)\s+(\d{4})\b/i);
  if (textMatch) {
    const dia = textMatch[1].padStart(2, '0');
    const mesNom = textMatch[2].toLowerCase();
    const anio = textMatch[3];
    const mesNum = MESES_MAP[mesNom];
    if (mesNum) {
      return { iso: `${anio}-${mesNum}-${dia}`, ar: `${dia}/${mesNum}/${anio}` };
    }
  }

  return null;
}

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

export interface PlazoCanonicoLegajo {
  fechaBoleto: string; // DD/MM/YYYY
  fechaBoletoIso: string; // YYYY-MM-DD
  plazoDias: number;
  fechaLimite: string; // DD/MM/YYYY
  fechaLimiteIso: string; // YYYY-MM-DD
  fechaTentativa: string; // DD/MM/YYYY
  fechaTentativaIso: string; // YYYY-MM-DD
  excesoDias: number;
  excedePlazo: boolean;
  advertencia?: string;
  fuenteFechaBoleto?: string;
  fuentePlazo?: string;
  fuenteFechaTentativa?: string;
}

/**
 * Analiza un legajo extrayendo canónicamente fecha de boleto, plazo, fecha límite y fecha tentativa.
 * Utiliza candidatos tipados con precedencia semántica estricta y trazabilidad de origen.
 * Admite formatos ISO, argentino (DD/MM/YYYY) y texto en español ("10 de junio de 2026").
 */
export function extraerPlazoCanonicoLegajo(
  caseRecord?: {
    id?: string;
    title?: string | null;
    metadata?: Record<string, any> | null;
  } | null,
  aiOutputs?: any[] | null,
  eventos?: any[] | null
): PlazoCanonicoLegajo | null {
  const meta = caseRecord?.metadata ?? {};

  // Filtrar aiOutputs para procesar únicamente el análisis más reciente por document_id
  const latestAiOutputs: any[] = [];
  if (Array.isArray(aiOutputs)) {
    const seenDocs = new Set<string>();
    for (const a of aiOutputs) {
      const docId = a?.document_id || a?.id;
      if (docId) {
        if (!seenDocs.has(docId)) {
          seenDocs.add(docId);
          latestAiOutputs.push(a);
        }
      } else {
        latestAiOutputs.push(a);
      }
    }
  }

  // --- 1. Extraer fecha de boleto con precedencia semántica ---
  let fechaBoletoParsed: { iso: string; ar: string } | null = null;
  let fuenteFechaBoleto: string | undefined;

  // Candidato 1: metadata explícita
  if (meta.fecha_boleto) {
    const p = parsearFechaCualquiera(meta.fecha_boleto);
    if (p) {
      fechaBoletoParsed = p;
      fuenteFechaBoleto = 'metadata.fecha_boleto';
    }
  }

  // Candidato 2: descripciones explícitas en análisis documental reciente de IA
  if (!fechaBoletoParsed) {
    for (const a of latestAiOutputs) {
      const rj = a?.result_json as any;
      const fechas = Array.isArray(rj?.fechas_plazos) ? rj.fechas_plazos : [];
      for (const fp of fechas) {
        const desc = String(fp?.descripcion || '').toLowerCase().trim();
        // Excluir límite, tentativa, otorgamiento, escritura antecedente y vencimientos
        if (
          desc.includes('límite') ||
          desc.includes('limite') ||
          desc.includes('tentativa') ||
          desc.includes('otorgamiento') ||
          desc.includes('antecedente') ||
          desc.includes('vencimiento') ||
          desc.includes('certificado')
        ) {
          continue;
        }

        const esBoletoExplicito =
          desc.includes('fecha del boleto') ||
          desc.includes('fecha de boleto') ||
          desc.includes('boleto celebrado') ||
          desc.includes('boleto firmado') ||
          desc.includes('boleto emitido') ||
          desc.startsWith('boleto');

        if (esBoletoExplicito) {
          const p = parsearFechaCualquiera(fp?.fecha) || parsearFechaCualquiera(fp?.evidencia_textual);
          if (p) {
            fechaBoletoParsed = p;
            fuenteFechaBoleto = `ai_output.fechas_plazos:${fp.descripcion}`;
            break;
          }
        }
      }
      if (fechaBoletoParsed) break;
    }
  }

  // Candidato 3: eventos vinculados (Agenda o Actuaciones)
  if (!fechaBoletoParsed && Array.isArray(eventos)) {
    for (const ev of eventos) {
      const text = `${ev?.titulo || ev?.title || ''} ${ev?.detalle || ev?.description || ''} ${ev?.tipo || ev?.event_type || ''}`.toLowerCase();
      if (
        text.includes('límite') ||
        text.includes('limite') ||
        text.includes('tentativa') ||
        text.includes('otorgamiento') ||
        text.includes('antecedente') ||
        text.includes('vencimiento')
      ) {
        continue;
      }
      if (text.includes('boleto')) {
        const p = parsearFechaCualquiera(ev?.fecha || ev?.event_date);
        if (p) {
          fechaBoletoParsed = p;
          fuenteFechaBoleto = `evento:${ev?.titulo || ev?.title || 'boleto'}`;
          break;
        }
      }
    }
  }

  // Fallback textual controlado en análisis
  if (!fechaBoletoParsed) {
    const dump = JSON.stringify([
      latestAiOutputs.map((a) => a?.result_json ?? a?.content ?? ''),
      eventos?.map((e) => `${e?.titulo || e?.title} ${e?.detalle || e?.description}`),
    ]);
    const mBoleto =
      dump.match(/(?:fecha\s+del\s+boleto|boleto\s+firmado|boleto\s+celebrado)[^\d]{1,60}?(\d{1,2}\s+de\s+[a-z]+\s+del?\s+\d{4})/i) ||
      dump.match(/(?:fecha\s+del\s+boleto|boleto\s+firmado|boleto\s+celebrado)[^\d]{1,60}?(\d{2}\/\d{2}\/\d{4})/i) ||
      dump.match(/(?:fecha\s+del\s+boleto|boleto\s+firmado|boleto\s+celebrado)[^\d]{1,60}?(\d{4}-\d{2}-\d{2})/i);
    if (mBoleto) {
      fechaBoletoParsed = parsearFechaCualquiera(mBoleto[1]);
      if (fechaBoletoParsed) {
        fuenteFechaBoleto = 'texto:boleto';
      }
    }
  }

  // --- 2. Extraer plazo en días enteros positivos ---
  let plazoDias: number | undefined;
  let fuentePlazo: string | undefined;

  if (meta.plazo_dias && Number(meta.plazo_dias) > 0) {
    plazoDias = Math.floor(Number(meta.plazo_dias));
    fuentePlazo = 'metadata.plazo_dias';
  } else if (meta.plazo_escrituracion_dias && Number(meta.plazo_escrituracion_dias) > 0) {
    plazoDias = Math.floor(Number(meta.plazo_escrituracion_dias));
    fuentePlazo = 'metadata.plazo_escrituracion_dias';
  }

  if (!plazoDias) {
    const dumpPlazo = JSON.stringify([
      latestAiOutputs.map((a) => a?.result_json ?? a?.content ?? ''),
      eventos?.map((e) => `${e?.titulo || e?.title} ${e?.detalle || e?.description}`),
    ]);
    const mPlazo =
      dumpPlazo.match(/(\d{1,3})\s*d[ií]as\s+corridos/i) ||
      dumpPlazo.match(/plazo\s+(?:contractual\s+)?(?:de\s+)?(\d{1,3})\s*d[ií]as/i);
    if (mPlazo) {
      const p = parseInt(mPlazo[1], 10);
      if (Number.isInteger(p) && p > 0) {
        plazoDias = p;
        fuentePlazo = `texto:${p} dias`;
      }
    }
  }

  // --- 3. Extraer fecha tentativa con precedencia semántica y exclusión de antecedentes ---
  let fechaTentativaParsed: { iso: string; ar: string } | null = null;
  let fuenteFechaTentativa: string | undefined;

  // Prioridad 1: metadata explícita de otorgamiento o tentativa
  if (meta.fecha_otorgamiento || meta.fecha_tentativa) {
    const p = parsearFechaCualquiera(meta.fecha_otorgamiento || meta.fecha_tentativa);
    if (p) {
      fechaTentativaParsed = p;
      fuenteFechaTentativa = meta.fecha_otorgamiento ? 'metadata.fecha_otorgamiento' : 'metadata.fecha_tentativa';
    }
  }

  // Prioridad 2: "Fecha tentativa de escritura" en análisis documental
  if (!fechaTentativaParsed) {
    for (const a of latestAiOutputs) {
      const rj = a?.result_json as any;
      const fechas = Array.isArray(rj?.fechas_plazos) ? rj.fechas_plazos : [];
      for (const fp of fechas) {
        const desc = String(fp?.descripcion || '').toLowerCase().trim();
        // Exclusión estricta de antecedentes y certificados
        if (
          desc.includes('antecedente') ||
          desc.includes('título antecedente') ||
          desc.includes('titulo antecedente') ||
          desc.includes('escritura antecedente') ||
          desc.includes('límite') ||
          desc.includes('limite') ||
          desc.includes('plazo máximo') ||
          desc.includes('certificado')
        ) {
          continue;
        }

        if (desc.includes('fecha tentativa de escritura') || desc.includes('tentativa de escritura')) {
          const p = parsearFechaCualquiera(fp?.fecha) || parsearFechaCualquiera(fp?.evidencia_textual);
          if (p) {
            fechaTentativaParsed = p;
            fuenteFechaTentativa = `ai_output:${fp.descripcion}`;
            break;
          }
        }
      }
      if (fechaTentativaParsed) break;
    }
  }

  // Prioridad 3: "Fecha estimada de escritura" en análisis documental
  if (!fechaTentativaParsed) {
    for (const a of latestAiOutputs) {
      const rj = a?.result_json as any;
      const fechas = Array.isArray(rj?.fechas_plazos) ? rj.fechas_plazos : [];
      for (const fp of fechas) {
        const desc = String(fp?.descripcion || '').toLowerCase().trim();
        if (
          desc.includes('antecedente') ||
          desc.includes('límite') ||
          desc.includes('limite') ||
          desc.includes('certificado')
        ) {
          continue;
        }

        if (desc.includes('fecha estimada de escritura') || desc.includes('estimada de escritura')) {
          const p = parsearFechaCualquiera(fp?.fecha) || parsearFechaCualquiera(fp?.evidencia_textual);
          if (p) {
            fechaTentativaParsed = p;
            fuenteFechaTentativa = `ai_output:${fp.descripcion}`;
            break;
          }
        }
      }
      if (fechaTentativaParsed) break;
    }
  }

  // Prioridad 4: Evento de Agenda explícitamente tentativo
  if (!fechaTentativaParsed && Array.isArray(eventos)) {
    for (const ev of eventos) {
      const text = `${ev?.titulo || ev?.title || ''} ${ev?.detalle || ev?.description || ''} ${ev?.tipo || ev?.categoria || ''}`.toLowerCase();
      if (
        text.includes('antecedente') ||
        text.includes('límite') ||
        text.includes('limite') ||
        text.includes('certificado')
      ) {
        continue;
      }
      if (text.includes('tentativa') || text.includes('estimada') || text.includes('otorgamiento')) {
        const p = parsearFechaCualquiera(ev?.fecha || ev?.event_date);
        if (p) {
          fechaTentativaParsed = p;
          fuenteFechaTentativa = `agenda:${ev?.titulo || ev?.title || 'tentativa'}`;
          break;
        }
      }
    }
  }

  // Fallback genérico excluyendo antecedentes
  if (!fechaTentativaParsed) {
    for (const a of latestAiOutputs) {
      const rj = a?.result_json as any;
      const fechas = Array.isArray(rj?.fechas_plazos) ? rj.fechas_plazos : [];
      for (const fp of fechas) {
        const desc = String(fp?.descripcion || '').toLowerCase().trim();
        if (
          desc.includes('antecedente') ||
          desc.includes('límite') ||
          desc.includes('limite') ||
          desc.includes('boleto') ||
          desc.includes('certificado')
        ) {
          continue;
        }
        if (desc.includes('tentativa') || desc.includes('estimada')) {
          const p = parsearFechaCualquiera(fp?.fecha) || parsearFechaCualquiera(fp?.evidencia_textual);
          if (p) {
            fechaTentativaParsed = p;
            fuenteFechaTentativa = `ai_output:${fp.descripcion}`;
            break;
          }
        }
      }
      if (fechaTentativaParsed) break;
    }
  }

  if (!fechaBoletoParsed || !plazoDias) {
    return null;
  }

  const fechaLimiteIso = sumarDiasCorridos(fechaBoletoParsed.iso, plazoDias);
  const fechaLimiteAr = formatIsoToAr(fechaLimiteIso);

  let excedePlazo = false;
  let excesoDias = 0;
  let advertencia: string | undefined;

  if (fechaTentativaParsed) {
    const diff = diferenciaDiasCorridos(fechaLimiteIso, fechaTentativaParsed.iso);
    if (diff > 0) {
      excedePlazo = true;
      excesoDias = diff;
      advertencia = `La fecha tentativa de escritura (${fechaTentativaParsed.ar}) excede el plazo máximo de ${plazoDias} días corridos, cuyo límite es el ${fechaLimiteAr}.`;
    }
  }

  return {
    fechaBoleto: fechaBoletoParsed.ar,
    fechaBoletoIso: fechaBoletoParsed.iso,
    plazoDias,
    fechaLimite: fechaLimiteAr,
    fechaLimiteIso,
    fechaTentativa: fechaTentativaParsed?.ar || '',
    fechaTentativaIso: fechaTentativaParsed?.iso || '',
    excesoDias,
    excedePlazo,
    advertencia,
    fuenteFechaBoleto,
    fuentePlazo,
    fuenteFechaTentativa,
  };
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
 * Admite entradas en ISO, DD/MM/YYYY o formato textual en español.
 */
export function analizarPlazoBoletoEscritura(
  fechaBoletoInput: string,
  plazoDias: number,
  fechaTentativaInput?: string
): AnalisisPlazoNotarial {
  const boletoParsed = parsearFechaCualquiera(fechaBoletoInput);
  const fechaBoletoIso = boletoParsed ? boletoParsed.iso : fechaBoletoInput.trim().slice(0, 10);
  const fechaLimite = sumarDiasCorridos(fechaBoletoIso, plazoDias);
  const fechaBoletoAr = boletoParsed ? boletoParsed.ar : formatIsoToAr(fechaBoletoIso);
  const fechaLimiteAr = formatIsoToAr(fechaLimite);

  let excedePlazo = false;
  let diasExceso = 0;
  let advertencia: string | undefined;
  let fechaTentativaIso: string | undefined;
  let fechaTentativaAr: string | undefined;

  if (fechaTentativaInput && fechaTentativaInput.trim().length >= 4) {
    const tentativaParsed = parsearFechaCualquiera(fechaTentativaInput);
    if (tentativaParsed) {
      fechaTentativaIso = tentativaParsed.iso;
      fechaTentativaAr = tentativaParsed.ar;
    } else {
      fechaTentativaIso = fechaTentativaInput.trim().slice(0, 10);
      fechaTentativaAr = formatIsoToAr(fechaTentativaIso);
    }
    const diff = diferenciaDiasCorridos(fechaLimite, fechaTentativaIso);
    if (diff > 0) {
      excedePlazo = true;
      diasExceso = diff;
      advertencia = `La fecha tentativa de escrituración (${fechaTentativaAr}) excede el plazo contractual de ${plazoDias} días corridos (límite: ${fechaLimiteAr}) por ${diasExceso} día${diasExceso === 1 ? '' : 's'} corridos.`;
    }
  }

  return {
    fechaBoleto: fechaBoletoIso,
    fechaBoletoAr,
    plazoDias,
    fechaLimite,
    fechaLimiteAr,
    fechaTentativa: fechaTentativaIso,
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

  // 1) Cómputo canónico primario (si existen boleto y plazo)
  const plazoCanonico = extraerPlazoCanonicoLegajo(c, aiOutputs, agendaEvents);
  if (plazoCanonico) {
    pushItem(`limite-${c.id}`, plazoCanonico.fechaLimiteIso, 'Fecha límite contractual');
    if (plazoCanonico.fechaTentativaIso) {
      pushItem(`tentativa-${c.id}`, plazoCanonico.fechaTentativaIso, 'Fecha tentativa de escritura');
    }
    pushItem(`boleto-${c.id}`, plazoCanonico.fechaBoletoIso, 'Fecha del boleto');
  }

  // 2) Fechas en metadata explícita adicional
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
    if (typeof val === 'string' && val.trim().length >= 4) {
      const parsed = parsearFechaCualquiera(val);
      if (parsed) {
        pushItem(`${cand.key}-${c.id}`, parsed.iso, cand.label);
      }
    }
  }

  // 3) Fechas en aiOutputs vinculados
  if (Array.isArray(aiOutputs)) {
    for (const a of aiOutputs) {
      const rj = a?.result_json as any;
      const fechas = Array.isArray(rj?.fechas_plazos) ? rj.fechas_plazos : [];
      for (const fp of fechas) {
        const desc = String(fp?.descripcion || '').trim();
        if (!desc) continue;
        const dLower = desc.toLowerCase();
        // Excluir antecedentes históricos (ej. escrituras antecedentes de 2015)
        if (dLower.includes('antecedente')) continue;

        const parsed = parsearFechaCualquiera(fp?.fecha) || parsearFechaCualquiera(fp?.evidencia_textual);
        if (!parsed) continue;

        let tipo = desc;
        if (dLower.includes('límite') || dLower.includes('limite') || (dLower.includes('plazo') && dLower.includes('contractual'))) {
          tipo = 'Fecha límite contractual';
        } else if (dLower.includes('tentativa') || dLower.includes('estimada')) {
          tipo = 'Fecha tentativa de escritura';
        } else if (dLower.includes('boleto') && !dLower.includes('límite') && !dLower.includes('limite')) {
          tipo = 'Fecha del boleto';
        }
        pushItem(`ai-${a.id || c.id}-${parsed.iso}-${tipo}`, parsed.iso, tipo);
      }
    }
  }

  // 4) Fechas en eventos de Agenda vinculados
  if (Array.isArray(agendaEvents)) {
    for (const ev of agendaEvents) {
      const desc = String(ev?.titulo || ev?.title || ev?.tipo || ev?.event_type || 'Evento de agenda').trim();
      const dLower = desc.toLowerCase();
      if (dLower.includes('antecedente')) continue;

      const parsed = parsearFechaCualquiera(ev?.fecha || ev?.event_date);
      if (!parsed) continue;

      let tipo = desc;
      if (dLower.includes('límite') || dLower.includes('limite') || (dLower.includes('plazo') && dLower.includes('contractual'))) {
        tipo = 'Fecha límite contractual';
      } else if (dLower.includes('tentativa') || dLower.includes('estimada') || dLower.includes('escrituraci') || dLower.includes('firma')) {
        tipo = 'Fecha tentativa de escritura';
      } else if (dLower.includes('boleto') && !dLower.includes('límite')) {
        tipo = 'Fecha del boleto';
      }
      pushItem(`agenda-${parsed.iso}-${tipo}`, parsed.iso, tipo);
    }
  }

  return items;
}

/**
 * Extrae exclusivamente las fechas accionables (plazos, vencimientos, audiencias, tentativas),
 * excluyendo explícitamente fechas de emisión histórica (como 'Fecha del boleto' o antecedentes) para Radar y Observaciones.
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
    if (
      tLower.includes('fecha del boleto') ||
      tLower === 'fecha de boleto' ||
      tLower.includes('antecedente')
    ) {
      return false;
    }
    const clasificacion = clasificarFecha(it.tipo);
    if (clasificacion === 'issue_date' || clasificacion === 'informational' || clasificacion === 'payment_date') {
      return false;
    }
    return isActionableDate(clasificacion, it.tipo);
  });
}
