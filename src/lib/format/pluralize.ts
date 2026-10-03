/**
 * Utilidades centralizadas para formateo plural gramatical en español.
 * Elimina construcciones no profesionales con sufijos entre paréntesis como documento(s) o analizado(s).
 */

export function plural(count: number, singular: string, plural: string): string {
  const n = Math.abs(count);
  return n === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

export function pluralDocumento(n: number): string {
  return plural(n, 'documento', 'documentos');
}

export function pluralDocumentoAnalizado(n: number): string {
  return plural(n, 'documento analizado', 'documentos analizados');
}

export function pluralDocumentoVencido(n: number): string {
  return plural(n, 'documento vencido', 'documentos vencidos');
}

export function pluralDocumentoPorVencer(n: number): string {
  return plural(n, 'documento por vencer', 'documentos por vencer');
}

export function pluralOperacion(n: number): string {
  return plural(n, 'operación', 'operaciones');
}

export function pluralHito(n: number): string {
  return plural(n, 'hito', 'hitos');
}

export function pluralMovimiento(n: number): string {
  return plural(n, 'movimiento', 'movimientos');
}

export function pluralDia(n: number): string {
  return plural(n, 'día', 'días');
}

export function pluralArchivo(n: number): string {
  return plural(n, 'archivo', 'archivos');
}
