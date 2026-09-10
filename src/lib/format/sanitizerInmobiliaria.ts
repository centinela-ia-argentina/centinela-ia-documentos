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
    .replace(/\bdel expediente\b/gi, (m) => m[0] === 'D' ? 'De la operación' : 'de la operación')
    .replace(/\bal expediente\b/gi, (m) => m[0] === 'A' ? 'A la operación' : 'a la operación')
    .replace(/\bel expediente\b/gi, (m) => m[0] === 'E' ? 'La operación' : 'la operación')
    .replace(/\bun expediente\b/gi, (m) => m[0] === 'U' ? 'Una operación' : 'una operación')
    .replace(/\bese expediente\b/gi, (m) => m[0] === 'E' ? 'Esa operación' : 'esa operación')
    .replace(/\blos expedientes\b/gi, (m) => m[0] === 'L' ? 'Las operaciones' : 'las operaciones')
    .replace(/\blibro de expedientes\b/gi, 'registro de operaciones')
    .replace(/\bdel legajo\b/gi, (m) => m[0] === 'D' ? 'De la operación' : 'de la operación')
    .replace(/\bal legajo\b/gi, (m) => m[0] === 'A' ? 'A la operación' : 'a la operación')
    .replace(/\bel legajo\b/gi, (m) => m[0] === 'E' ? 'La operación' : 'la operación')
    .replace(/\bun legajo\b/gi, (m) => m[0] === 'U' ? 'Una operación' : 'una operación')
    .replace(/\bese legajo\b/gi, (m) => m[0] === 'E' ? 'Esa operación' : 'esa operación')
    .replace(/\blos legajos\b/gi, (m) => m[0] === 'L' ? 'Las operaciones' : 'las operaciones')
    .replace(/\bexpedientes\b/gi, (m) => m[0] === 'E' ? 'Operaciones' : 'operaciones')
    .replace(/\bexpediente\b/gi, (m) => m[0] === 'E' ? 'Operación' : 'operación')
    .replace(/\blegajos\b/gi, (m) => m[0] === 'L' ? 'Operaciones' : 'operaciones')
    .replace(/\blegajo\b/gi, (m) => m[0] === 'L' ? 'Operación' : 'operación')
    .replace(/\b(la operación(?: [^.]+?)?) fue archivado\b/gi, '$1 fue archivada');
}

export function contieneTerminosJudicialesInapropiados(texto: string): boolean {
  if (!texto) return false;
  const regex = /\b(expediente\/legajo\/operación|expediente \/ legajo|expedientes?|legajos?|autos|fojas?|juzgado|tribunal|fuero)\b/i;
  return regex.test(texto);
}
