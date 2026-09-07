/**
 * Cargador canónico unificado de hechos temporales de un legajo.
 *
 * Consolida determinísticamente todas las fuentes de información temporal:
 * 1. Metadata explícita del legajo
 * 2. Análisis documental de IA (document_analysis)
 * 3. Resumen general y puntos clave de IA (case_summary)
 * 4. Eventos del legajo (case_events) y Agenda (agenda_plazos)
 *
 * Aplica reglas de reconciliación determinísticas con trazabilidad y detección de conflictos.
 */

import {
  sumarDiasCorridos,
  diferenciaDiasCorridos,
  parsearFechaCualquiera,
  formatIsoToAr,
} from './fechasCanonicas';
import type { SupabaseClient } from '@supabase/supabase-js';

export type FuenteTemporalTipo =
  | 'metadata'
  | 'document_analysis'
  | 'case_summary'
  | 'agenda'
  | 'actuacion'
  | 'calculado'
  | 'texto';

export interface FuenteTemporal {
  campo: string;
  tipo: FuenteTemporalTipo;
  origen: string;
  valor: string | number;
}

export interface ConflictoTemporal {
  campo: string;
  descripcion: string;
  valorCalculado?: string;
  valorEncontrado?: string;
}

export interface HechosTemporalesCanonicos {
  fechaBoleto?: string; // DD/MM/YYYY
  fechaBoletoIso?: string; // YYYY-MM-DD
  plazoDias?: number;
  fechaLimite?: string; // DD/MM/YYYY
  fechaLimiteIso?: string; // YYYY-MM-DD
  fechaTentativa?: string; // DD/MM/YYYY
  fechaTentativaIso?: string; // YYYY-MM-DD
  excesoDias?: number;
  excedePlazo: boolean;
  advertencia?: string;
  fuentes: FuenteTemporal[];
  conflictos: ConflictoTemporal[];
}

export interface ExtraerHechosInput {
  caseRecord?: {
    id?: string;
    title?: string | null;
    metadata?: Record<string, any> | null;
  } | null;
  aiOutputs?: any[] | null;
  eventos?: any[] | null;
}

const REGEX_BOLETO =
  /(?:fecha\s+(?:de\s+(?:emisi[oó]n|firma|celebraci[oó]n|suscripci[oó]n)\s+(?:del?\s+)?)?boleto(?:\s+de\s+compraventa)?|boleto(?:\s+de\s+compraventa)?\s+(?:emitido|firmado|celebrado|suscripto)(?:\s+el)?|fecha\s+del?\s+boleto(?:\s+de\s+compraventa)?)/i;

const REGEX_LIMITE =
  /(?:plazo\s+m[aá]ximo\s+contractual\s+(?:para\s+escriturar)?|fecha\s+l[ií]mite\s+contractual|l[ií]mite\s+contractual(?:\s+para\s+escriturar)?|fecha\s+l[ií]mite)/i;

const REGEX_TENTATIVA =
  /(?:fecha\s+tentativa\s+(?:de\s+escritura|de\s+escrituraci[oó]n|del?\s+acto)?|tentativa\s+de\s+escritura|fecha\s+estimada\s+de\s+escritura|fecha\s+de\s+otorgamiento|fecha\s+tentativa)/i;

const REGEX_PLAZO_DIAS =
  /(?<!supera[^\d]{1,30})(?<!excede[^\d]{1,30})(?<!exceso[^\d]{1,30})(?<!por\s+)\b(\d{2,3})\s*d[ií]as\s+corridos/i;

const REGEX_PLAZO_GENERICO =
  /(?:plazo|t[eé]rmino)(?:\s+m[aá]ximo)?(?:\s+contractual)?(?:\s+para\s+escriturar)?(?:\s+de|:)?\s*(\d{1,3})\s*d[ií]as/i;

const REGEX_EXCESO_DIAS =
  /(?:supera|excede)(?:\s+el\s+plazo|\s+el\s+l[ií]mite)?(?:\s+contractual)?\s+por\s+(\d{1,2})\s*d[ií]as(?:\s+corridos)?/i;

/**
 * Extrae y concilia determinísticamente los hechos temporales a partir de las fuentes en memoria.
 */
export function extraerHechosTemporalesLegajo(input: ExtraerHechosInput): HechosTemporalesCanonicos {
  const fuentes: FuenteTemporal[] = [];
  const conflictos: ConflictoTemporal[] = [];

  const meta = input.caseRecord?.metadata ?? {};

  let fechaBoletoParsed: { iso: string; ar: string } | null = null;
  let plazoDias: number | undefined;
  let fechaLimiteParsed: { iso: string; ar: string } | null = null;
  let fechaTentativaParsed: { iso: string; ar: string } | null = null;
  let excesoDiasExtraido: number | undefined;

  // 1. Metadata explícita
  if (meta.fecha_boleto) {
    const p = parsearFechaCualquiera(meta.fecha_boleto);
    if (p) {
      fechaBoletoParsed = p;
      fuentes.push({ campo: 'fechaBoleto', tipo: 'metadata', origen: 'metadata.fecha_boleto', valor: p.ar });
    }
  }

  if (meta.plazo_dias && Number(meta.plazo_dias) > 0) {
    plazoDias = Math.floor(Number(meta.plazo_dias));
    fuentes.push({ campo: 'plazoDias', tipo: 'metadata', origen: 'metadata.plazo_dias', valor: plazoDias });
  } else if (meta.plazo_escrituracion_dias && Number(meta.plazo_escrituracion_dias) > 0) {
    plazoDias = Math.floor(Number(meta.plazo_escrituracion_dias));
    fuentes.push({ campo: 'plazoDias', tipo: 'metadata', origen: 'metadata.plazo_escrituracion_dias', valor: plazoDias });
  }

  if (meta.fecha_limite || meta.fecha_limite_contractual) {
    const p = parsearFechaCualquiera(meta.fecha_limite || meta.fecha_limite_contractual);
    if (p) {
      fechaLimiteParsed = p;
      fuentes.push({ campo: 'fechaLimite', tipo: 'metadata', origen: 'metadata.fecha_limite', valor: p.ar });
    }
  }

  if (meta.fecha_otorgamiento || meta.fecha_tentativa) {
    const p = parsearFechaCualquiera(meta.fecha_otorgamiento || meta.fecha_tentativa);
    if (p) {
      fechaTentativaParsed = p;
      fuentes.push({
        campo: 'fechaTentativa',
        tipo: 'metadata',
        origen: meta.fecha_otorgamiento ? 'metadata.fecha_otorgamiento' : 'metadata.fecha_tentativa',
        valor: p.ar,
      });
    }
  }

  // 2. aiOutputs (ordenados por created_at desc)
  const sortedOutputs: any[] = [];
  if (Array.isArray(input.aiOutputs)) {
    sortedOutputs.push(
      ...[...input.aiOutputs].sort(
        (a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime()
      )
    );
  }

  for (const out of sortedOutputs) {
    const rj = out?.result_json as any;
    const outType = String(out?.output_type || '');

    // 2.1 document_analysis -> fechas_plazos
    if (outType === 'document_analysis' || Array.isArray(rj?.fechas_plazos)) {
      const fechas = Array.isArray(rj?.fechas_plazos) ? rj.fechas_plazos : [];
      for (const fp of fechas) {
        const desc = String(fp?.descripcion || '').trim();
        const descLower = desc.toLowerCase();

        // Excluir antecedentes y certificados viejos
        if (descLower.includes('antecedente') || descLower.includes('certificado')) continue;

        // Boleto
        if (!fechaBoletoParsed) {
          const esBoleto =
            descLower.includes('boleto') &&
            !descLower.includes('límite') &&
            !descLower.includes('limite') &&
            !descLower.includes('tentativa') &&
            !descLower.includes('otorgamiento') &&
            !descLower.includes('vencimiento');
          if (esBoleto) {
            const p = parsearFechaCualquiera(fp?.fecha) || parsearFechaCualquiera(fp?.evidencia_textual);
            if (p) {
              fechaBoletoParsed = p;
              fuentes.push({ campo: 'fechaBoleto', tipo: 'document_analysis', origen: 'document_analysis:' + desc, valor: p.ar });
            }
          }
        }

        // Límite
        if (!fechaLimiteParsed) {
          const esLimite =
            descLower.includes('límite') ||
            descLower.includes('limite') ||
            (descLower.includes('plazo') && (descLower.includes('máximo') || descLower.includes('maximo') || descLower.includes('contractual')));
          if (esLimite) {
            const p = parsearFechaCualquiera(fp?.fecha) || parsearFechaCualquiera(fp?.evidencia_textual);
            if (p) {
              fechaLimiteParsed = p;
              fuentes.push({ campo: 'fechaLimite', tipo: 'document_analysis', origen: 'document_analysis:' + desc, valor: p.ar });
            }
          }
        }

        // Tentativa
        if (!fechaTentativaParsed) {
          const esTentativa =
            descLower.includes('tentativa') ||
            descLower.includes('estimada') ||
            descLower.includes('otorgamiento');
          if (esTentativa && !descLower.includes('límite') && !descLower.includes('limite')) {
            const p = parsearFechaCualquiera(fp?.fecha) || parsearFechaCualquiera(fp?.evidencia_textual);
            if (p) {
              fechaTentativaParsed = p;
              fuentes.push({ campo: 'fechaTentativa', tipo: 'document_analysis', origen: 'document_analysis:' + desc, valor: p.ar });
            }
          }
        }
      }
    }

    // 2.2 case_summary -> puntos_clave, riesgos_alertas, resumen_general
    if (outType === 'case_summary' || rj?.puntos_clave || rj?.riesgos_alertas) {
      const puntos = Array.isArray(rj?.puntos_clave) ? rj.puntos_clave.map(String) : [];
      for (const punto of puntos) {
        if (!fechaBoletoParsed && REGEX_BOLETO.test(punto)) {
          const p = parsearFechaCualquiera(punto);
          if (p) {
            fechaBoletoParsed = p;
            fuentes.push({ campo: 'fechaBoleto', tipo: 'case_summary', origen: 'case_summary.puntos_clave', valor: p.ar });
          }
        }

        if (!fechaLimiteParsed && REGEX_LIMITE.test(punto)) {
          const p = parsearFechaCualquiera(punto);
          if (p) {
            fechaLimiteParsed = p;
            fuentes.push({ campo: 'fechaLimite', tipo: 'case_summary', origen: 'case_summary.puntos_clave', valor: p.ar });
          }
        }

        if (!fechaTentativaParsed && REGEX_TENTATIVA.test(punto)) {
          const p = parsearFechaCualquiera(punto);
          if (p) {
            fechaTentativaParsed = p;
            fuentes.push({ campo: 'fechaTentativa', tipo: 'case_summary', origen: 'case_summary.puntos_clave', valor: p.ar });
          }
        }

        if (!plazoDias) {
          const mPlazo = punto.match(REGEX_PLAZO_DIAS) || punto.match(REGEX_PLAZO_GENERICO);
          if (mPlazo) {
            const num = parseInt(mPlazo[1], 10);
            if (num > 0) {
              plazoDias = num;
              fuentes.push({ campo: 'plazoDias', tipo: 'case_summary', origen: 'case_summary.puntos_clave', valor: num });
            }
          }
        }
      }

      const alertas = Array.isArray(rj?.riesgos_alertas) ? rj.riesgos_alertas.map(String) : [];
      for (const alerta of alertas) {
        if (excesoDiasExtraido === undefined) {
          const mExceso = alerta.match(REGEX_EXCESO_DIAS);
          if (mExceso) {
            excesoDiasExtraido = parseInt(mExceso[1], 10);
          }
        }
      }

      const resumenGen = String(rj?.resumen_general || '');
      if (!fechaBoletoParsed && REGEX_BOLETO.test(resumenGen)) {
        const p = parsearFechaCualquiera(resumenGen);
        if (p) {
          fechaBoletoParsed = p;
          fuentes.push({ campo: 'fechaBoleto', tipo: 'case_summary', origen: 'case_summary.resumen_general', valor: p.ar });
        }
      }
      if (!fechaLimiteParsed && REGEX_LIMITE.test(resumenGen)) {
        const p = parsearFechaCualquiera(resumenGen);
        if (p) {
          fechaLimiteParsed = p;
          fuentes.push({ campo: 'fechaLimite', tipo: 'case_summary', origen: 'case_summary.resumen_general', valor: p.ar });
        }
      }
      if (!fechaTentativaParsed && REGEX_TENTATIVA.test(resumenGen)) {
        const p = parsearFechaCualquiera(resumenGen);
        if (p) {
          fechaTentativaParsed = p;
          fuentes.push({ campo: 'fechaTentativa', tipo: 'case_summary', origen: 'case_summary.resumen_general', valor: p.ar });
        }
      }
      if (!plazoDias) {
        const mPlazo = resumenGen.match(REGEX_PLAZO_DIAS) || resumenGen.match(REGEX_PLAZO_GENERICO);
        if (mPlazo) {
          const num = parseInt(mPlazo[1], 10);
          if (num > 0) {
            plazoDias = num;
            fuentes.push({ campo: 'plazoDias', tipo: 'case_summary', origen: 'case_summary.resumen_general', valor: num });
          }
        }
      }
    }
  }

  // 3. Eventos (Agenda o case_events)
  if (Array.isArray(input.eventos)) {
    for (const ev of input.eventos) {
      const texto = `${ev?.titulo || ev?.title || ''} ${ev?.detalle || ev?.description || ''} ${ev?.tipo || ev?.event_type || ''}`.toLowerCase();
      if (texto.includes('antecedente') || texto.includes('certificado')) continue;

      if (!fechaBoletoParsed && texto.includes('boleto') && !texto.includes('límite') && !texto.includes('tentativa')) {
        const p = parsearFechaCualquiera(ev?.fecha || ev?.event_date);
        if (p) {
          fechaBoletoParsed = p;
          fuentes.push({ campo: 'fechaBoleto', tipo: 'agenda', origen: 'evento:' + (ev?.titulo || 'boleto'), valor: p.ar });
        }
      }

      if (!fechaLimiteParsed && (texto.includes('límite') || texto.includes('limite'))) {
        const p = parsearFechaCualquiera(ev?.fecha || ev?.event_date);
        if (p) {
          fechaLimiteParsed = p;
          fuentes.push({ campo: 'fechaLimite', tipo: 'agenda', origen: 'evento:' + (ev?.titulo || 'limite'), valor: p.ar });
        }
      }

      if (!fechaTentativaParsed && (texto.includes('tentativa') || texto.includes('estimada') || texto.includes('otorgamiento'))) {
        const p = parsearFechaCualquiera(ev?.fecha || ev?.event_date);
        if (p) {
          fechaTentativaParsed = p;
          fuentes.push({ campo: 'fechaTentativa', tipo: 'agenda', origen: 'evento:' + (ev?.titulo || 'tentativa'), valor: p.ar });
        }
      }
    }
  }

  // 4. Fallback textual en dump completo si algo sigue faltando
  const dump = JSON.stringify([
    sortedOutputs.map((a) => a?.result_json ?? a?.content ?? ''),
    input.eventos?.map((e) => `${e?.titulo || e?.title} ${e?.detalle || e?.description}`),
  ]);

  if (!fechaBoletoParsed) {
    const m = dump.match(new RegExp(`${REGEX_BOLETO.source}[^\\d]{1,60}?(\\d{1,2}\\s+de\\s+[a-z]+\\s+del?\\s+\\d{4}|\\d{2}/\\d{2}/\\d{4}|\\d{4}-\\d{2}-\\d{2})`, 'i'));
    if (m) {
      const p = parsearFechaCualquiera(m[1]);
      if (p) {
        fechaBoletoParsed = p;
        fuentes.push({ campo: 'fechaBoleto', tipo: 'texto', origen: 'texto:boleto', valor: p.ar });
      }
    }
  }

  if (!fechaLimiteParsed) {
    const m = dump.match(new RegExp(`${REGEX_LIMITE.source}[^\\d]{1,60}?(\\d{1,2}\\s+de\\s+[a-z]+\\s+del?\\s+\\d{4}|\\d{2}/\\d{2}/\\d{4}|\\d{4}-\\d{2}-\\d{2})`, 'i'));
    if (m) {
      const p = parsearFechaCualquiera(m[1]);
      if (p) {
        fechaLimiteParsed = p;
        fuentes.push({ campo: 'fechaLimite', tipo: 'texto', origen: 'texto:limite', valor: p.ar });
      }
    }
  }

  if (!fechaTentativaParsed) {
    const m = dump.match(new RegExp(`${REGEX_TENTATIVA.source}[^\\d]{1,60}?(\\d{1,2}\\s+de\\s+[a-z]+\\s+del?\\s+\\d{4}|\\d{2}/\\d{2}/\\d{4}|\\d{4}-\\d{2}-\\d{2})`, 'i'));
    if (m) {
      const p = parsearFechaCualquiera(m[1]);
      if (p) {
        fechaTentativaParsed = p;
        fuentes.push({ campo: 'fechaTentativa', tipo: 'texto', origen: 'texto:tentativa', valor: p.ar });
      }
    }
  }

  if (!plazoDias) {
    const m = dump.match(REGEX_PLAZO_DIAS) || dump.match(REGEX_PLAZO_GENERICO);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num > 0) {
        plazoDias = num;
        fuentes.push({ campo: 'plazoDias', tipo: 'texto', origen: 'texto:plazo', valor: num });
      }
    }
  }

  // 5. Reconciliación determinística (Reglas A, B, C, D, E)
  // Regla B: fechaBoleto + fechaLimite explícita (sin plazoDias) => deducir plazoDias
  if (fechaBoletoParsed && fechaLimiteParsed && !plazoDias) {
    const diff = diferenciaDiasCorridos(fechaBoletoParsed.iso, fechaLimiteParsed.iso);
    if (diff > 0) {
      plazoDias = diff;
      fuentes.push({
        campo: 'plazoDias',
        tipo: 'calculado',
        origen: 'diferenciaDiasCorridos(boleto, limite)',
        valor: diff,
      });
    }
  }

  // Regla A: fechaBoleto + plazoDias => fechaLimiteCalculada
  if (fechaBoletoParsed && plazoDias) {
    const limiteCalculadoIso = sumarDiasCorridos(fechaBoletoParsed.iso, plazoDias);
    const limiteCalculadoAr = formatIsoToAr(limiteCalculadoIso);

    if (fechaLimiteParsed) {
      if (fechaLimiteParsed.iso === limiteCalculadoIso) {
        // Coincidencia perfecta
        fuentes.push({
          campo: 'fechaLimite',
          tipo: 'calculado',
          origen: 'sumarDiasCorridos(boleto, plazoDias)',
          valor: limiteCalculadoAr,
        });
      } else {
        // Conflicto: registrar trazabilidad y priorizar cálculo de plazo
        conflictos.push({
          campo: 'fechaLimite',
          descripcion: 'Discrepancia entre fecha límite explícita y calculada por plazo de boleto',
          valorCalculado: limiteCalculadoAr,
          valorEncontrado: fechaLimiteParsed.ar,
        });
        fechaLimiteParsed = { iso: limiteCalculadoIso, ar: limiteCalculadoAr };
      }
    } else {
      fechaLimiteParsed = { iso: limiteCalculadoIso, ar: limiteCalculadoAr };
      fuentes.push({
        campo: 'fechaLimite',
        tipo: 'calculado',
        origen: 'sumarDiasCorridos(boleto, plazoDias)',
        valor: limiteCalculadoAr,
      });
    }
  }

  // Regla C: fechaLimite + fechaTentativa => excesoDias, excedePlazo
  let excedePlazo = false;
  let excesoDias = 0;
  let advertencia: string | undefined;

  if (fechaLimiteParsed && fechaTentativaParsed) {
    const diff = diferenciaDiasCorridos(fechaLimiteParsed.iso, fechaTentativaParsed.iso);
    if (diff > 0) {
      excedePlazo = true;
      excesoDias = diff;
      const diasPlazoTxt = plazoDias ? `${plazoDias} días corridos` : 'contractual';
      advertencia = `La fecha tentativa de escritura (${fechaTentativaParsed.ar}) excede el plazo máximo de ${diasPlazoTxt}, cuyo límite es el ${fechaLimiteParsed.ar}.`;
    } else {
      excedePlazo = false;
      excesoDias = 0;
    }
  } else if (excesoDiasExtraido !== undefined && excesoDiasExtraido > 0) {
    excesoDias = excesoDiasExtraido;
    excedePlazo = true;
  }

  return {
    fechaBoleto: fechaBoletoParsed?.ar,
    fechaBoletoIso: fechaBoletoParsed?.iso,
    plazoDias,
    fechaLimite: fechaLimiteParsed?.ar,
    fechaLimiteIso: fechaLimiteParsed?.iso,
    fechaTentativa: fechaTentativaParsed?.ar,
    fechaTentativaIso: fechaTentativaParsed?.iso,
    excesoDias,
    excedePlazo,
    advertencia,
    fuentes,
    conflictos,
  };
}

/**
 * Carga desde la base de datos todos los artefactos relevantes de un legajo y extrae
 * sus hechos temporales canónicos.
 */
export async function cargarHechosTemporalesLegajo(
  supabase: SupabaseClient,
  organizationId: string,
  caseId: string
): Promise<HechosTemporalesCanonicos> {
  const [caseRes, aiRes, eventsRes, agendaRes] = await Promise.all([
    supabase
      .from('cases')
      .select('id, title, metadata')
      .eq('id', caseId)
      .eq('organization_id', organizationId)
      .maybeSingle(),
    supabase
      .from('ai_outputs')
      .select('id, document_id, output_type, result_json, content, created_at')
      .eq('case_id', caseId)
      .eq('organization_id', organizationId)
      .in('output_type', ['document_analysis', 'case_summary'])
      .order('created_at', { ascending: false }),
    supabase
      .from('case_events')
      .select('event_date, event_type, title, description')
      .eq('case_id', caseId)
      .eq('organization_id', organizationId)
      .order('event_date', { ascending: true }),
    supabase
      .from('agenda_plazos')
      .select('id, titulo, fecha, detalle, categoria')
      .eq('case_id', caseId)
      .eq('organization_id', organizationId),
  ]);

  const caseRecord = caseRes.data ?? null;
  const aiOutputs = aiRes.data ?? [];
  const eventos = [
    ...(eventsRes.data ?? []).map((e) => ({
      fecha: String(e.event_date),
      tipo: String(e.event_type || 'actuacion'),
      titulo: String(e.title || ''),
      detalle: String(e.description || ''),
    })),
    ...(agendaRes.data ?? []).map((a) => ({
      fecha: String(a.fecha),
      tipo: String(a.categoria || 'agenda'),
      titulo: String(a.titulo || ''),
      detalle: String(a.detalle || ''),
    })),
  ];

  return extraerHechosTemporalesLegajo({
    caseRecord,
    aiOutputs,
    eventos,
  });
}
