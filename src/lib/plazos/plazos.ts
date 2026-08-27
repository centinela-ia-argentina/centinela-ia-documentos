// Utilidades para clasificar las fechas detectadas por la IA.
// Objetivo: distinguir plazos accionables (vencimientos, emisiones) de
// fechas meramente informativas (ej. fechas de nacimiento).

const PATRONES_FECHA_INFORMATIVA = [
  /nacimiento/i,
  /nacid[oa]s?/i,
  /fecha\s+de\s+nac/i,
  /f\.?\s*nac\b/i,
];

const PATRONES_FECHA_EMISION = [
  /\bemisio[nó]\b/i,
  /\bexpedici[oó]n\b/i,
  /fecha\s+de\s+(?:celebraci[oó]n|otorgamiento|firma|boleto|escritura|t[ií]tulo)/i,
  /t[ií]tulo antecedente/i,
  /^fecha(?: del)? boleto/i,
  /\b(?:boleto|escritura)\b/i,
  /\b(?:certificado\s+)?(?:catastral|dominio|inhibiciones?)\b/i,
];

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

/** Un plazo es "accionable" (para la cronología) si NO es una fecha meramente informativa. */
export function esPlazoAccionable(plazo?: {
  descripcion?: string | null;
  fecha?: string | null;
}): boolean {
  return !esFechaNacimiento(plazo?.descripcion);
}

/** Un plazo entra al Radar (vencimientos, plazos) si es accionable y NO es de emisión. */
export function esPlazoRadar(titulo: string): boolean {
  if (!titulo) return false;
  if (esFechaNacimiento(titulo)) return false;
  if (/\b(?:vencimiento|vence|vigencia|plazo|tentativa)\b/i.test(titulo)) return true;
  if (esFechaEmision(titulo)) return false;
  
  // By default, if it's just the name of a document without "vencimiento" or "vigencia", it's probably its emission date.
  if (/\b(?:boleto|escritura|catastral|dominio|inhibiciones?)\b/i.test(titulo)) return false;
  
  return true;
}
