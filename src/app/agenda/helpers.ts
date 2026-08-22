export function normalizeDateLocal(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  const str = dateStr.trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  try {
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return null;

    const formatter = new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(d);
    let y = '', m = '', day = '';
    for (const p of parts) {
      if (p.type === 'year') y = p.value;
      if (p.type === 'month') m = p.value;
      if (p.type === 'day') day = p.value;
    }
    if (y && m && day) return `${y}-${m}-${day}`;
    return null;
  } catch {
    return null;
  }
}

export function normalizeTitle(title: string): string {
  return title
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function validateTime(timeStr: string | null): string | null {
  if (!timeStr) return null;
  const str = timeStr.trim();
  if (!str) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(str);
  if (!match) throw new Error('Hora inválida. Debe ser HH:MM (00:00 a 23:59)');
  return str;
}
