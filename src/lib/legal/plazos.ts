import { LegalJurisdiction, LEGAL_CALENDARS } from './config';

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function esDiaHabilJudicial(d: Date, jurisdiccion: LegalJurisdiction): boolean {
  const dow = d.getDay(); // 0 domingo, 6 sábado
  if (dow === 0 || dow === 6) return false;
  const iso = toISODate(d);
  const cal = LEGAL_CALENDARS[jurisdiccion];
  if (!cal || cal.coverage !== 'verified') return false; // Fail-safe
  if (cal.holidays.includes(iso)) return false;
  if (cal.judicialRecesses.some(f => iso >= f.desde && iso <= f.hasta)) return false;
  return true;
}

// Parsea 'YYYY-MM-DD' como fecha local (evita desfase de zona horaria)
export function parseISODate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Días corridos (calendario)
export function sumarDiasCorridos(inicio: Date, dias: number): Date {
  const r = new Date(inicio);
  r.setDate(r.getDate() + dias);
  return r;
}

// Días hábiles judiciales
export function sumarDiasHabiles(inicio: Date, dias: number, jurisdiccion: LegalJurisdiction): Date {
  const r = new Date(inicio);
  let contados = 0;
  while (contados < dias) {
    r.setDate(r.getDate() + 1);
    if (esDiaHabilJudicial(r, jurisdiccion)) contados++;
  }
  return r;
}

// ── Art. 158 CPCCN — ampliación de plazos por distancia ──
export function diasAmpliacionPorDistancia(km: number): number {
  if (!Number.isFinite(km) || km <= 0) return 0;
  const enteros = Math.floor(km / 200);
  const resto = km % 200;
  return enteros + (resto >= 100 ? 1 : 0);
}

export type ResultadoVencimiento =
  | {
      ok: false;
      motivo:
        | 'jurisdiccion_requerida'
        | 'calendario_no_disponible'
        | 'anio_no_cubierto'
        | 'fecha_invalida'
        | 'dias_invalidos';
    }
  | {
      ok: true;
      vencimiento: string; // AAAA-MM-DD
      jurisdiccion: LegalJurisdiction;
      calendarioAnio: number;
      fuente: string;
      advertencia: string;
      diasHabiles: number;
      diasAmpliacion: number;
      diasTotales: number;
      cuentaDesde: string;
      pasos: string[];
    };

export function calcularVencimientoProcesal(args: {
  fechaNotificacion: string;
  diasHabiles: number;
  jurisdiccion?: LegalJurisdiction;
  kmDistancia?: number;
}): ResultadoVencimiento {
  if (!args.jurisdiccion) {
    return { ok: false, motivo: 'jurisdiccion_requerida' };
  }
  const cal = LEGAL_CALENDARS[args.jurisdiccion];
  if (!cal || cal.coverage !== 'verified') {
    return { ok: false, motivo: 'calendario_no_disponible' };
  }
  const inicio = parseISODate(args.fechaNotificacion);
  if (!inicio) {
    return { ok: false, motivo: 'fecha_invalida' };
  }
  if (!Number.isFinite(args.diasHabiles) || args.diasHabiles <= 0) {
    return { ok: false, motivo: 'dias_invalidos' };
  }

  const anioInicio = inicio.getFullYear();
  if (anioInicio !== cal.year) {
    return { ok: false, motivo: 'anio_no_cubierto' };
  }

  const ampliacion = diasAmpliacionPorDistancia(args.kmDistancia ?? 0);
  const total = args.diasHabiles + ampliacion;

  const primerDia = sumarDiasHabiles(inicio, 1, args.jurisdiccion);
  const vencimiento = sumarDiasHabiles(inicio, total, args.jurisdiccion);

  const anioFin = vencimiento.getFullYear();
  if (anioFin !== cal.year) {
    return { ok: false, motivo: 'anio_no_cubierto' };
  }

  const pasos: string[] = [];
  pasos.push(`Notificación: ${toISODate(inicio)}.`);
  pasos.push(`El plazo empieza a correr el día hábil siguiente: ${toISODate(primerDia)}.`);
  pasos.push(`Plazo legal: ${args.diasHabiles} días hábiles.`);
  if (ampliacion > 0) {
    pasos.push(`Ampliación por distancia (${args.kmDistancia} km): +${ampliacion} día(s).`);
  }
  pasos.push(`Se cuentan ${total} días hábiles salteando fines de semana, feriados y ferias judiciales de esta jurisdicción.`);
  pasos.push(`Vencimiento: ${toISODate(vencimiento)}.`);

  return {
    ok: true,
    vencimiento: toISODate(vencimiento),
    jurisdiccion: args.jurisdiccion,
    calendarioAnio: cal.year,
    fuente: cal.sourceUrl,
    advertencia: 'Estimación orientativa: verificá el calendario del tribunal antes de presentar',
    diasHabiles: args.diasHabiles,
    diasAmpliacion: ampliacion,
    diasTotales: total,
    cuentaDesde: toISODate(primerDia),
    pasos,
  };
}
