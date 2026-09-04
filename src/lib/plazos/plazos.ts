// Utilidades para clasificar las fechas detectadas por la IA.
// Objetivo: distinguir plazos procesales y operativos reales de fechas
// meramente informativas o contables (nacimientos, recibos de sueldo, comprobantes, facturas).

export type DateType =
  | 'procedural_deadline'
  | 'hearing'
  | 'limitation'
  | 'contractual_deadline'
  | 'document_expiration'
  | 'informational'
  | 'issue_date'
  | 'payment_date';

export const ACTIONABLE_DATE_TYPES: readonly DateType[] = [
  'procedural_deadline',
  'hearing',
  'limitation',
  'contractual_deadline',
  'document_expiration',
] as const;

export const NON_ACTIONABLE_DATE_TYPES: readonly DateType[] = [
  'informational',
  'issue_date',
  'payment_date',
] as const;

const PATRONES_FECHA_INFORMATIVA = [
  /nacimiento/i,
  /nacid[oa]s?/i,
  /fecha\s+de\s+nac/i,
  /f\.?\s*nac\b/i,
  /ingreso\s+laboral/i,
  /fecha\s+de\s+ingreso/i,
  /incorporaci[oó]n/i,
];

const PATRONES_AUDIENCIA = [
  /\b(?:audiencia|comparecencia|vista\s+de\s+causa|testimonial|absoluci[oó]n|pericial)\b/i,
];

const PATRONES_PRESCRIPCION = [
  /\b(?:prescripci[oó]n|caducidad)\b/i,
];

const PATRONES_PROCESAL = [
  /\b(?:traslado|contestaci[oó]n|apelaci[oó]n|recurso|expresi[oó]n\s+de\s+agravios|c[eé]dula|intimaci[oó]n|plazo\s+procesal|alegato|memorial)\b/i,
  /\b(?:traslado\s+(?:de\s+)?demanda|notificaci[oó]n\s+(?:de\s+(?:la\s+)?)?demanda|c[eé]dula\s+(?:de\s+)?demanda|contestar\s+demanda|contestaci[oó]n\s+(?:de\s+)?demanda|plazo\s+(?:para\s+)?contestar\s+demanda|interposici[oó]n\s+de\s+demanda|ampliaci[oó]n\s+de\s+demanda)\b/i,
];

const PATRONES_DEMANDA_NO_PROCESAL = [
  /\bdemanda\s+de\s+(?:servicios|bienes|productos|mercado|empleo|consumo)\b/i,
  /\bcurva\s+de\s+demanda\b/i,
  /\boferta\s+y\s+demanda\b/i,
];

const PATRONES_VENCIMIENTO_DOC = [
  /vencimiento\s+(?:de\s+)?(?:certificado|poder|mandato|documento|dni|licencia|registro|garant[ií]a|habilitaci[oó]n)/i,
  /vigencia\s+(?:de\s+)?(?:certificado|poder|mandato|documento)/i,
];

const PATRONES_FECHA_EMISION = [
  /\bemisi[oó]n\b/i,
  /\bexpedici[oó]n\b/i,
  /fecha\s+de\s+(?:celebraci[oó]n|otorgamiento|firma|boleto|escritura|t[ií]tulo)/i,
  /t[ií]tulo antecedente/i,
  /^fecha(?: del)? boleto/i,
  /\b(?:boleto|escritura)\b/i,
  /\b(?:certificado\s+)?(?:catastral|dominio|inhibiciones?)\b/i,
];

const PATRONES_FECHA_PAGO = [
  /\b(?:recibo|pago|cobro|sueldo|salario|remuneraci[oó]n|haberes|dep[oó]sito|factura|comprobante|ticket)\b/i,
  /per[ií]odo\s+liquidado/i,
  /fecha\s+de\s+(?:pago|cobro|dep[oó]sito|transferencia|liquidaci[oó]n)/i,
];

const PATRONES_CONTRACTUAL = [
  /\b(?:vencimiento\s+contrato|fin\s+de\s+contrato|plazo\s+locativo|t[eé]rmino\s+contractual)\b/i,
  /\b(?:vencimiento|vence|vigencia|tentativa)\b/i,
];

/** Clasifica una fecha según su descripción y tipo sugerido. */
export function clasificarFecha(descripcion?: string | null, tipoSugerido?: string | null): DateType {
  const d = (descripcion || '').trim();

  // Descarte explícito de frases genéricas no procesales que contienen "demanda"
  if (d && PATRONES_DEMANDA_NO_PROCESAL.some((re) => re.test(d))) {
    return 'informational';
  }

  if (tipoSugerido && (ACTIONABLE_DATE_TYPES as readonly string[]).includes(tipoSugerido)) {
    const isExplicitlyActionable =
      d &&
      (PATRONES_PRESCRIPCION.some((re) => re.test(d)) ||
        PATRONES_AUDIENCIA.some((re) => re.test(d)) ||
        PATRONES_PROCESAL.some((re) => re.test(d)) ||
        PATRONES_VENCIMIENTO_DOC.some((re) => re.test(d)));

    if (!isExplicitlyActionable && d && (esFechaPago(d) || esFechaNacimiento(d))) {
      return esFechaNacimiento(d) ? 'informational' : 'payment_date';
    }
    return tipoSugerido as DateType;
  }
  if (tipoSugerido && (NON_ACTIONABLE_DATE_TYPES as readonly string[]).includes(tipoSugerido)) {
    return tipoSugerido as DateType;
  }

  if (!d) return 'informational';

  if (PATRONES_FECHA_INFORMATIVA.some((re) => re.test(d))) return 'informational';
  if (PATRONES_AUDIENCIA.some((re) => re.test(d))) return 'hearing';
  if (PATRONES_PRESCRIPCION.some((re) => re.test(d))) return 'limitation';
  if (PATRONES_PROCESAL.some((re) => re.test(d))) return 'procedural_deadline';
  if (PATRONES_VENCIMIENTO_DOC.some((re) => re.test(d))) return 'document_expiration';
  if (PATRONES_FECHA_EMISION.some((re) => re.test(d))) return 'issue_date';
  if (PATRONES_FECHA_PAGO.some((re) => re.test(d))) return 'payment_date';
  if (PATRONES_CONTRACTUAL.some((re) => re.test(d))) return 'contractual_deadline';

  return 'informational';
}

/** Devuelve true si la descripción corresponde a una fecha de nacimiento. */
export function esFechaNacimiento(descripcion?: string | null): boolean {
  if (!descripcion) return false;
  return PATRONES_FECHA_INFORMATIVA.some((re) => re.test(descripcion));
}

/** Devuelve true si la descripción corresponde a una fecha de emisión/otorgamiento pasada. */
export function esFechaEmision(descripcion?: string | null): boolean {
  if (!descripcion) return false;
  return PATRONES_FECHA_EMISION.some((re) => re.test(descripcion));
}

/** Devuelve true si la descripción corresponde a una fecha de recibo, sueldo, pago o comprobante. */
export function esFechaPago(descripcion?: string | null): boolean {
  if (!descripcion) return false;
  return PATRONES_FECHA_PAGO.some((re) => re.test(descripcion));
}

/** Determina si una fecha es accionable según su tipo y/o descripción. */
export function isActionableDate(tipo?: DateType | string | null, descripcion?: string | null): boolean {
  const tipoEfectivo = clasificarFecha(descripcion, tipo);
  return (ACTIONABLE_DATE_TYPES as readonly string[]).includes(tipoEfectivo);
}

export interface FechaExtraida {
  fecha: string;
  descripcion: string;
  tipo: DateType;
  confianza: 'alta' | 'media' | 'baja';
  evidencia_textual?: string;
  requiere_revision: boolean;
  documento_origen?: string;
}

/**
 * Evalúa si una fecha extraída es apta para activar vencimientos procesales (Radar, Agenda, expires_at).
 * Requiere tipo accionable, descartando baja confianza o indicación de requerir revisión profesional.
 */
export function evaluarFechaAccionable(fecha?: {
  descripcion?: string | null;
  fecha?: string | null;
  tipo?: string | null;
  confianza?: 'alta' | 'media' | 'baja' | string | null;
  requiere_revision?: boolean | null;
  documento_origen?: string | null;
} | null): boolean {
  if (!fecha || !fecha.descripcion) return false;
  if (fecha.confianza === 'baja') return false;
  if (fecha.requiere_revision === true) return false;
  return isActionableDate(fecha.tipo, fecha.descripcion);
}

/** Un plazo es "accionable" (para la cronología) si NO es una fecha meramente informativa o de pago y no tiene baja confianza/requiere revisión. */
export function esPlazoAccionable(plazo?: {
  descripcion?: string | null;
  fecha?: string | null;
  tipo?: string | null;
  confianza?: string | null;
  requiere_revision?: boolean | null;
}): boolean {
  return evaluarFechaAccionable(plazo);
}

/** Un plazo entra al Radar (vencimientos, plazos operativos) si es accionable. */
export function esPlazoRadar(titulo: string, tipo?: string | null): boolean {
  if (!titulo) return false;
  return isActionableDate(tipo, titulo);
}
