/**
 * Utilidades canónicas puras para fechas y aritmética de plazos en días corridos.
 * Módulo puro sin dependencias externas para evitar ciclos de importación.
 */

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

/** Formatea una fecha ISO (YYYY-MM-DD) a DD/MM/YYYY */
export function formatIsoToAr(iso: string): string {
  const clean = iso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return iso;
  const [y, m, d] = clean.split('-');
  return `${d}/${m}/${y}`;
}

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
