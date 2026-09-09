/**
 * Utilidades de sanitización y normalización de textos para Inmobiliaria.
 * Evita la aparición de terminología judicial/notarial descontextualizada
 * (expediente, legajo, autos, fojas, UMA, JUS) en vistas y outputs inmobiliarios.
 */

const JUDICIAL_TERMS_REGEX = /\b(expediente\/legajo\/operación|expediente \/ legajo|expedientes?|legajos?|autos|fojas?|juzgado|tribunal|fuero)\b/gi;

export function sanitizeTextoInmobiliario(texto: string): string {
  if (!texto) return '';

  return texto
    .replace(/expediente\/legajo\/operaci[oó]n/gi, 'operación')
    .replace(/expediente\s*\/\s*legajo/gi, 'operación')
    .replace(/\bdel expediente\b/gi, 'de la operación')
    .replace(/\bal expediente\b/gi, 'a la operación')
    .replace(/\bel expediente\b/gi, 'la operación')
    .replace(/\bun expediente\b/gi, 'una operación')
    .replace(/\blibro de expedientes\b/gi, 'registro de operaciones')
    .replace(/\bexpedientes\b/gi, 'operaciones')
    .replace(/\bexpediente\b/gi, 'operación')
    .replace(/\blegajos\b/gi, 'operaciones')
    .replace(/\blegajo\b/gi, 'operación');
}

export function contieneTerminosJudicialesInapropiados(texto: string): boolean {
  if (!texto) return false;
  const regex = /\b(expediente\/legajo\/operación|expediente \/ legajo|expedientes?|legajos?|autos|fojas?|juzgado|tribunal|fuero)\b/i;
  return regex.test(texto);
}
