export type ChecklistProgress = {
  total: number;
  fulfilled: number;
  missing: number;
  /** Ítems aplicables con estado nulo, vacío o no reconocido. */
  unknownCount: number;
  percent: number;
  /**
   * Completo solo si hay ítems aplicables, ninguno pendiente confirmado
   * y ninguno con estado desconocido. Un estado no reconocido no se
   * interpreta ni como cumplido ni como pendiente confirmado.
   */
  isComplete: boolean;
  hasUnknown: boolean;
};

const FULFILLED_STATUSES = new Set(['received', 'reviewed']);
const MISSING_STATUSES = new Set(['pending', 'rejected']);

export function summarizeChecklistStatuses(statuses: string[]): ChecklistProgress {
  const relevantStatuses = statuses.filter((s) => s !== 'not_required');
  const total = relevantStatuses.length;

  const fulfilled = relevantStatuses.filter((s) => FULFILLED_STATUSES.has(s)).length;
  const missing = relevantStatuses.filter((s) => MISSING_STATUSES.has(s)).length;
  const unknownCount = total - fulfilled - missing;

  const percent = total > 0 ? Math.round((fulfilled / total) * 100) : 0;
  const isComplete = total > 0 && missing === 0 && unknownCount === 0;

  return { total, fulfilled, missing, unknownCount, percent, isComplete, hasUnknown: unknownCount > 0 };
}
