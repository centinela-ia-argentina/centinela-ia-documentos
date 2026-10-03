export type ExpiryStatus = 'sin_vencimiento' | 'vigente' | 'por_vencer' | 'vencido';

export const EXPIRY_WARNING_DAYS = 30;

export function getDaysUntilExpiry(expiresAt?: string | null, referenceDate: Date = new Date()): number | null {
  if (!expiresAt) return null;

  let clean = expiresAt.trim().slice(0, 10);
  const arMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (arMatch) {
    clean = `${arMatch[3]}-${arMatch[2].padStart(2, '0')}-${arMatch[1].padStart(2, '0')}`;
  }

  const targetDate = new Date(`${clean}T00:00:00`);
  if (isNaN(targetDate.getTime())) return null;

  const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const refMidnight = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  const diffTime = targetMidnight.getTime() - refMidnight.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getDocumentExpiryStatus(expiresAt?: string | null, referenceDate: Date = new Date()): ExpiryStatus {
  if (!expiresAt) return 'sin_vencimiento';

  const days = getDaysUntilExpiry(expiresAt, referenceDate);
  if (days === null) return 'sin_vencimiento';

  if (days < 0) return 'vencido';
  if (days <= EXPIRY_WARNING_DAYS) return 'por_vencer';
  
  return 'vigente';
}

export function expiryStatusLabel(status: ExpiryStatus): string {
  switch (status) {
    case 'sin_vencimiento': return 'Sin vencimiento';
    case 'vigente': return 'Vigente';
    case 'por_vencer': return 'Por vencer';
    case 'vencido': return 'Vencido';
    default: return 'Sin vencimiento';
  }
}

export function getExpiryBadgeStyles(status: ExpiryStatus): { className: string } {
  switch (status) {
    case 'vencido':
      return { className: 'bg-rose-50 text-rose-700 border border-rose-200' };
    case 'por_vencer':
      return { className: 'bg-amber-50 text-amber-800 border border-amber-200' };
    case 'vigente':
      return { className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
    case 'sin_vencimiento':
    default:
      return { className: 'bg-slate-100 text-slate-500 border border-slate-200' };
  }
}
