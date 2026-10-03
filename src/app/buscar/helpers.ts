export function escaparFiltroPostgrest(termino: string): string {
  return termino
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}
